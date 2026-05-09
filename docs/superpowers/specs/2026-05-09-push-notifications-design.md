# Push Notifications V1 — Design

**Date :** 2026-05-09
**Statut :** Validé en brainstorming, prêt pour plan d'implémentation
**Auteurs :** Uriel + XO

## Pourquoi

Les push notifs sont identifiées comme **levier #1 de rétention** dans la boussole stratégique RdC (3 raisons : rituel, lien, savoir — cf. mémoire `project_boussole_3_raisons.md`). Aujourd'hui, l'utilisateur doit ouvrir l'app pour découvrir qu'il a un message dans une expédition, que son énigme du jour est dispo, ou que son lieu a été contesté. Il oublie. La rétention vient des **raisons de revenir**, et un push bien placé est la version mécanisée d'une raison de revenir.

## Boussole appliquée à V1

Les 5 triggers retenus couvrent les 3 plaisirs :

| Trigger | Plaisir | Catégorie |
|---|---|---|
| Énigme du jour disponible | Rituel | Important |
| Message dans expédition | Lien | Important |
| Lieu contesté / repris | Lien | Important |
| Bientôt level-up (à ≤ 50 gloire) | Lien (statut) + retour | Récap |
| Récap hebdo nouveaux lieux | Savoir + lien | Récap |

Tout autre type de notif existant (`court_*`, `expedition_invited`, `level_up` final, etc.) reste **in-app uniquement** en V1. On élargit plus tard, type par type, sur retour utilisateur.

## Architecture en 3 sous-systèmes

```
┌─────────────────┐         ┌──────────────────┐         ┌────────────────┐
│  FRONT (PWA)    │         │  SUPABASE DB     │         │  EDGE FUNCTION │
│                 │         │                  │         │   send-push    │
│ • permission    │ writes  │ push_subscript.  │  reads  │                │
│ • subscribe     ├────────▶│ (user_id, keys)  │◀────────┤ • web-push lib │
│ • SW push hdlr  │         │                  │         │ • VAPID auth   │
│ • UI settings   │         │ notifications    │         │ • cleanup 410  │
└─────────────────┘         │ (table existante)│  POST   └────────────────┘
                            │                  │  ▲             │
                            │ users +2 cols    │  │             ▼
                            │                  │  │       Web Push API
                            │ DB trigger       │──┘             │
                            │ pg_cron (hebdo)  │                ▼
                            └──────────────────┘         Navigateur user
```

**Principe central** : la table `notifications` reste **la source unique de vérité**. Tout push correspond à exactement 1 row dans `notifications`. La cloche notifs in-app et le push sont toujours synchrones — le user clique le push, ouvre l'app, retrouve le même contenu dans la cloche.

### Flow événement-driven (3 triggers sur 5)

1. RPC métier insère row dans `notifications` (déjà existant, aucun changement)
2. Trigger SQL `AFTER INSERT ON notifications` → `pg_net.http_post` async vers Edge Function
3. Edge Function lit `push_subscriptions` du destinataire, filtre selon `users.push_*_enabled`, envoie via web-push lib

### Flow scheduled (2 triggers sur 5)

1. `pg_cron` job tourne (énigme du jour : 12h30 Europe/Paris DST-safe, lundi 8h UTC pour récap hebdo, quotidien 17h UTC pour level-up)
2. Calcule la cohorte cible en SQL (avec garde-fous anti-spam baked-in)
3. INSERT dans `notifications` → trigger habituel envoie le push

## Schéma DB

### Table `push_subscriptions` (nouvelle)

```sql
CREATE TABLE push_subscriptions (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON push_subscriptions(user_id);
```

Un user peut avoir plusieurs subs (téléphone + desktop). Une sub appartient à un seul user (au moment du subscribe).

### Colonnes `users`

```sql
ALTER TABLE users
  ADD COLUMN push_important_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN push_recap_enabled     boolean NOT NULL DEFAULT true;
```

Les noms exacts (table, FK type, etc.) seront vérifiés au moment du plan via le graph SQL — la baseline RdC utilise `users.id` en `text`, pas UUID (cf. mémoire `feedback_never_invent_db_columns_workflow.md`).

### Trigger d'envoi

```sql
CREATE FUNCTION trigger_push_on_notification() RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url     := <edge_function_url>,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || <service_role_key>,
      'Content-Type', 'application/json'
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'recipient_id',    NEW.recipient_id,
      'type',            NEW.type,
      'data',            NEW.data
    )
  );
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_on_notification();
```

Le trigger ne fait que reposter à l'Edge Function. Toute la logique de filtrage / format / envoi est dans l'Edge Function — plus facile à patcher / tester / débugger.

### Cron jobs `pg_cron`

`pg_cron` est déjà actif (cf. mig 109 archive expéditions).

**Récap hebdo** — lundi 8h UTC :

```sql
SELECT cron.schedule(
  'weekly_new_places_recap',
  '0 8 * * 1',
  $$
    WITH new_places AS (
      SELECT name FROM places
      WHERE created_at >= now() - interval '7 days'
        AND private = false AND masked = false
      ORDER BY created_at DESC LIMIT 100
    ),
    sample AS (
      SELECT (SELECT count(*) FROM new_places) AS n,
             (SELECT string_agg(name, ', ')
                FROM (SELECT name FROM new_places LIMIT 3) s) AS sample_names
    )
    INSERT INTO notifications (recipient_id, type, data)
    SELECT u.id, 'weekly_new_places_recap',
           jsonb_build_object('count', sample.n, 'sample_names_csv', sample.sample_names)
      FROM users u, sample
     WHERE sample.n >= 3
       AND u.push_recap_enabled = true;
  $$
);
```

**Level-up imminent** — quotidien 17h UTC (~18h CET) :

```sql
SELECT cron.schedule(
  'level_up_imminent_check',
  '0 17 * * *',
  $$
    INSERT INTO notifications (recipient_id, type, data)
    SELECT u.id, 'level_up_imminent',
           jsonb_build_object(
             'gloire_diff', t.next_threshold - u.gloire,
             'next_title',  t.next_title
           )
      FROM users u
      CROSS JOIN LATERAL (
        SELECT threshold AS next_threshold, name AS next_title
          FROM titles
         WHERE threshold > u.gloire
         ORDER BY threshold ASC
         LIMIT 1
      ) t
     WHERE (t.next_threshold - u.gloire) BETWEEN 1 AND 50
       AND u.last_seen_at < now() - interval '24 hours'
       AND u.push_recap_enabled = true
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.recipient_id = u.id
            AND n.type = 'level_up_imminent'
            AND n.created_at > now() - interval '7 days'
       );
  $$
);
```

**Garde-fous anti-spam baked-in** :
- Récap : seuil min 3 nouveaux lieux, pré-filtre `push_recap_enabled` au niveau SQL
- Level-up : skip les actifs (24h), max 1×/7j par user, fenêtre "à portée" 1-50 gloire

Les noms de colonnes exacts (`gloire`, `last_seen_at`, table `titles`, etc.) seront vérifiés au moment du plan via le graph SQL.

## Front (PWA + UI)

### Nouveaux fichiers

```
apps/explore-web/src/
├─ lib/
│  └─ pushNotifications.ts        # subscribe / unsubscribe / sync / pushSupportStatus
├─ hooks/
│  └─ useEnsurePushPermission.ts  # déclenchable au bon moment "well-timed"
├─ components/notifications/
│  ├─ PushPermissionModal.tsx     # wording adapté au contexte
│  ├─ IOSInstallGuideModal.tsx    # mini-guide standalone
│  └─ PushSettings.tsx            # 2 toggles dans le menu Profil
└─ sw-push.ts                     # custom Service Worker (push + notificationclick)
```

### Service Worker

On bascule `vite-plugin-pwa` du mode `generateSW` actuel vers `injectManifest` mode pour gérer notre code custom (push + notificationclick) en plus de la précachée Workbox. Deux events :

- `push` → `self.registration.showNotification(title, { body, icon, badge, data: { url } })`
- `notificationclick` → focus la tab existante avec cet URL ou en ouvre une nouvelle

### Hook `useEnsurePushPermission`

Pièce centrale UX. Appelable depuis n'importe quel composant à un moment "well-timed" :

```ts
const ensurePush = useEnsurePushPermission()

// au submit énigme :
await submitEnigma(...)
ensurePush({
  reason: 'daily_enigma',
  title: 'Veux-tu être prévenu chaque jour ?',
  body: 'On te ping quand ton énigme du jour est prête.',
})
```

Logique :
1. Si déjà subscribed → noop
2. Si déjà refusé une fois (`localStorage.push_denied_at`) → noop (jamais re-prompter automatique)
3. Si iOS Safari non-standalone → ouvre `IOSInstallGuideModal`
4. Sinon → ouvre `PushPermissionModal` avec le wording fourni → si OK, lance `subscribeUser()`

### Where on appelle `ensurePush` en V1

- Après submit `DailyEnigma` (énigme résolue) → "ping toi quand ton énigme est prête demain"
- Après création / rejoin d'une `Expedition` → "ping toi quand un compagnon écrit"

Optionnel V1 (à valider au moment du plan) :
- Après revendication d'un lieu → "ping toi si quelqu'un le conteste"

### Détection iOS

```ts
export function pushSupportStatus(): 'native' | 'ios-needs-install' | 'unsupported' {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
                || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                         || (navigator as any).standalone === true
    if (!isStandalone) return 'ios-needs-install'
    if (!('PushManager' in window)) return 'unsupported'  // iOS < 16.4
    return 'native'
  }
  if ('PushManager' in window && 'Notification' in window) return 'native'
  return 'unsupported'
}
```

### `IOSInstallGuideModal`

Modale en 4 étapes visuelles :
1. Touche le bouton **Partager** Safari (icône)
2. **"Ajouter à l'écran d'accueil"** (icône ⊕)
3. Confirme avec **Ajouter** (en haut à droite)
4. Lance l'app depuis ton écran d'accueil

Stockage local `localStorage.ios_install_prompt_dismissed_at` :
- "Plus tard" → on n'embête pas avant 14 jours
- "J'ai compris" → on n'embête plus tant qu'on n'est pas en mode standalone

### `PushSettings.tsx` (dans menu Profil)

```
Notifications
  ☑ Importantes      Énigme du jour, messages d'expédition, lieu contesté
  ☑ Récap & moments  Avant un palier de niveau, nouveaux lieux de la semaine
```

Toggle off → l'Edge Function filtre. La sub navigateur reste active (pas besoin de re-prompter si le user re-active).

### `pushNotifications.ts` — surface API

```ts
export async function subscribeUser(userId: string): Promise<PushSubscription | null>
export async function unsubscribeUser(): Promise<void>
export async function syncSubscription(userId: string): Promise<void>
export function pushSupportStatus(): 'native' | 'ios-needs-install' | 'unsupported'
```

`syncSubscription` est appelée au boot après login : vérifie que la sub locale = sub en DB, gère endpoint changé (FCM rotation), re-attribution propre si changement de compte sur le même navigateur.

### Sécurité / privacy

- **Pas de PII dans le payload push.** Juste un titre lisible + body court. Le user clique → l'app ouvre la tab et fetch le détail authentifié.
- VAPID **public key** embarquée dans le bundle (public par design)
- VAPID **private key** uniquement dans Supabase secrets, jamais exposée côté client

## Edge Function `send-push`

**Fichier** : `supabase/functions/send-push/index.ts`
**Runtime** : Deno (Supabase Edge), avec `npm:web-push` import et `npm:@supabase/supabase-js`

### Surface

```
POST /send-push
Authorization: Bearer <SERVICE_ROLE_KEY>
Body: { notification_id: int, recipient_id: text, type: text, data: jsonb }
Response: 200 ok (silencieux si filtré, succès si envoyé, partial si certaines subs ont échoué)
```

### Logique

```ts
serve(async (req) => {
  const { notification_id, recipient_id, type, data } = await req.json()

  // 1. Catégorisation (mapping centralisé)
  const category = CATEGORY_BY_TYPE[type]
  if (category === 'silent' || !category) return ok()  // pas de push V1

  // 2. Préférences user
  const { data: user } = await supabase
    .from('users')
    .select('push_important_enabled, push_recap_enabled')
    .eq('id', recipient_id)
    .single()
  if (category === 'important' && !user.push_important_enabled) return ok()
  if (category === 'recap'     && !user.push_recap_enabled)     return ok()

  // 3. Subscriptions actives
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', recipient_id)
  if (!subs?.length) return ok()

  // 4. Format payload (centralisé par type)
  const payload = formatPayload(type, data)

  // 5. Envoi parallèle, cleanup 410
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(toWebPushSub(sub), JSON.stringify(payload), {
        TTL: 86400,
        urgency: category === 'important' ? 'high' : 'normal',
        vapidDetails: VAPID_DETAILS,
      })
      await supabase.from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else if (err.statusCode === 429) {
        console.warn('rate_limited', err)
      } else {
        console.error('push_failed', err)
      }
    }
  }))

  return ok()
})
```

### Catégorie par type (mapping V1)

```ts
const CATEGORY_BY_TYPE: Record<string, 'important' | 'recap' | 'silent'> = {
  daily_enigma_ready:       'important',
  expedition_message:       'important',
  place_contested:          'important',
  place_reclaimed:          'important',
  level_up_imminent:        'recap',
  weekly_new_places_recap:  'recap',
  // tous les autres types existants → 'silent' (in-app uniquement)
}
```

### `formatPayload(type, data)`

Dispatch par type, mapping vers `{ title, body, url }`. Centralisé dans `_shared/payloads.ts` pour test unitaire et retouche facile. Wording sobre, ligne éditoriale Voie 3 :

| Type | Title | Body | URL |
|---|---|---|---|
| `daily_enigma_ready` | "Ton énigme du jour" | "Le coffre t'attend." | `/?enigma=daily` |
| `expedition_message` | "Message — {expedition_name}" | "{author} : {preview}" | `/?expedition={id}` |
| `place_contested` | "{place_name} est contesté" | "Garde tes Couronnes ou retire-toi." | `/?placeId={id}` |
| `place_reclaimed` | "{place_name} t'a échappé" | "Reviens contester quand tu seras prêt." | `/?placeId={id}` |
| `level_up_imminent` | "Plus que {gloire_diff} avant {next_title}" | "Reviens jouer une énigme." | `/?enigma=daily` |
| `weekly_new_places_recap` | "{count} nouveaux lieux cette semaine" | "{sample_names_csv}…" | `/?layer=new` |

### Secrets Supabase

- `VAPID_PUBLIC_KEY` (aussi exposée au front via env build-time)
- `VAPID_PRIVATE_KEY` (Edge Function only)
- `VAPID_SUBJECT` (`mailto:contact@runesdechene.com`)

### Idempotence

Si le trigger SQL retente (improbable mais possible avec pg_net), on réenvoie le push. Web Push API tolère. Pas de cache `notification_id` traités en V1, on ajoute si bug observé.

### Logging V1 minimal

`console.log/warn/error` dans Edge Function (visible dans les logs Supabase dashboard). Pas de table `push_log` en V1.

## Erreurs & edge cases

| Cas | Comportement |
|---|---|
| User refuse la permission | `localStorage.push_denied_at` enregistré. Jamais re-prompt automatique. Settings reste accessible. |
| Sub navigateur expirée (410 Gone) | Edge Function DELETE de la sub. Re-subscribe automatique au prochain login si `Notification.permission === 'granted'`. |
| User connecté sur 2 appareils | 2 rows dans `push_subscriptions`, push envoyé aux deux. Cohérent. |
| User se déconnecte | `unsubscribeUser()` → DELETE local + DELETE en DB filtré par endpoint. |
| Changement de compte sur même navigateur | `syncSubscription()` au login détecte que l'endpoint actuel n'est pas associé à ce user_id → re-attribution propre. |
| SW ancien sans handler push | `vite-plugin-pwa` mode `autoUpdate` force le SW à refresh. Premier launch après deploy = nouveau SW. |
| Notif pendant que l'app est ouverte | SW envoie quand même la notif système. Pas de filtrage V1 — l'user voit la notif ET sa cloche s'incrémente. À surveiller, filtrage en V2 si bruyant. |
| Réseau coupé au moment du push | TTL 86400 — le serveur push retente jusqu'à 24h. Edge Function n'a rien à faire. |
| pg_net qui timeout | Async, le trigger SQL ne bloque pas l'INSERT initial. La notif in-app est créée même si le push échoue. |
| Chrome iOS (WebKit) | `pushSupportStatus()` retourne `'unsupported'`. Silence, pas de message. |

## Hors scope V1 (à NE PAS implémenter)

- Quiet hours / "ne pas déranger entre Xh et Yh"
- Click tracking analytics
- A/B test du wording
- Notification grouping / threading custom (le navigateur le fait déjà)
- Push silencieux (data-only) pour sync background
- Granularité fine (5 toggles individuels) — on reste à 2
- Push depuis le Hub admin (broadcast manuel) — utile mais V2
- Localisation EN/autre langue — tout en français V1
- Migration des autres types (`court_*`, `expedition_invited`, `level_up` final, etc.) vers du push — silent par défaut, on élargit plus tard

## Tests

- **Manuel E2E desktop** : install PWA Chrome → opt-in via énigme → trigger énigme → vérifier réception
- **Manuel E2E iOS** : Safari → modale install → Ajouter à l'écran d'accueil → relancer → opt-in → vérifier réception
- **Unit Edge Function** : tester `formatPayload(type, data)` pour chaque type, mock `web-push`, vérifier filtrage par catégorie
- **Pas de E2E automatisé V1** — coût > bénéfice à ce stade

## Déploiement

1. Migrations SQL (table + colonnes + trigger + 2 cron jobs) — appliquées via `pnpm dlx supabase db push`
2. Génération VAPID keys (script one-shot, output dans secrets Supabase + variable env build front)
3. Deploy Edge Function : `supabase functions deploy send-push --no-verify-jwt`
4. Build + deploy front Netlify normal
5. Test manuel sur prod avec compte de test

## Métriques de succès post-V1

À observer pendant ~2 semaines avant de décider d'une V2 :

- Taux d'opt-in : users avec ≥1 push subscription / users actifs 7j
- Taux de retention D+7 chez opted-in vs non-opted-in
- Taux de retour quand un push est envoyé (clic ÷ réception)
- Plaintes user "trop de notifs" via support

## Décisions clés et raisonnements

| Décision | Raison |
|---|---|
| Self-hosted Supabase Edge Function (pas OneSignal) | Indépendance plateforme, secrets restent chez nous, pas de prix qui change demain |
| `notifications` reste source unique de vérité | Cohérence in-app ↔ push automatique, pas de divergence possible |
| Trigger SQL minimal, logique dans Edge Function | Plus facile à patcher / tester / débugger qu'en SQL |
| Opt-in well-timed (pas premier launch) | Taux d'acceptation 3-5x supérieur. Hook réutilisable, wording adapté au contexte. |
| 2 toggles (Important / Récap) | KISS, mais protection contre le "tout-ou-rien" qui fait perdre 100% du user |
| iOS modale install douce, pas harceler | Honnête, pédagogique, max 1× tous les 14j |
| 5 triggers V1, le reste reste in-app | Évite de saturer V1, on élargit type par type sur retour |
| Pas de PII dans le payload | Privacy + le user clique pour le détail authentifié |
| Pas de logs persistés V1 | Console suffit, on ajoute si bug observé |
