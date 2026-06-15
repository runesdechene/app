# Envoyer des Couronnes à un joueur (récompense manuelle admin)

> Spec — 2026-06-15
> Réutilise le moteur récompense+email UGC (spec 2026-05-26, mig 175).

## Problème

Aujourd'hui, créditer des Couronnes à un joueur n'est possible qu'**automatiquement**
(validation de photo/avis communautaire via `moderate_submission` / `moderate_review`).
On veut pouvoir **récompenser un joueur à volonté** depuis le hub : choisir un montant,
écrire le **motif** de la récompense, créditer ses Couronnes, et lui envoyer un **email
Resend** lui expliquant pourquoi il est récompensé.

Décision (2026-06-15) : **option A** — bouton sur la page du joueur (`UserDetail`),
atteinte via la recherche `Users` existante. Pas de page dédiée (éviter de dupliquer la
recherche). **Pas de plafond** sur l'envoi manuel (un don admin est volontaire).

## Architecture

Quatre couches, moteur calqué sur la Brique 1 UGC :

```
Hub UserDetail ──rpc──> award_crowns_manual ──> user_crowns (+montant, SANS cap)
                                            └──> INSERT notifications(type='crowns_awarded')
                                                   └─trigger email_on_notification─> send-email (Resend)
                                                   └─fetch app─> NotificationPanel (in-app)
```

Canal **distinct** des récompenses auto : ne touche **ni** `contributions_count`, **ni** la
Gloire. La ligne `notifications` sert d'historique (destinataire, montant, motif, date).

## 1. SQL — `migration 255_award_crowns_manual.sql`

Nouvelle RPC admin :

```sql
CREATE OR REPLACE FUNCTION public.award_crowns_manual(
  p_user_id text,
  p_amount  int,
  p_reason  text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

Comportement :
- `IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;`
- Valide `p_amount > 0` (`RAISE EXCEPTION 'amount_must_be_positive'`) et
  `btrim(coalesce(p_reason,'')) <> ''` (`RAISE EXCEPTION 'reason_required'`).
- Vérifie que le user existe (`RAISE EXCEPTION 'user_not_found'` sinon).
- Crédite **sans plafond** :
  `INSERT INTO user_crowns (user_id, balance, updated_at) VALUES (p_user_id, p_amount, now())
   ON CONFLICT (user_id) DO UPDATE SET balance = public.user_crowns.balance + p_amount,
   updated_at = now()` (pas de `LEAST(500, …)`).
- Insère la notif :
  `INSERT INTO notifications (recipient_id, type, data)
   VALUES (p_user_id, 'crowns_awarded',
           jsonb_build_object('crowns', p_amount, 'reason', btrim(p_reason)))`.
- Retourne `jsonb_build_object('balance', <nouveau solde>)`.
- `GRANT EXECUTE ... TO authenticated;` (la garde admin filtre).

Workflow d'application : voir `docs/db/migrations-workflow.md` — numéro séquentiel
(prochain libre après 254), `migration-preview.mjs`, `db push --dry-run` puis `db push`.

## 2. Edge function — `supabase/functions/send-email/index.ts`

Le handler ne traite aujourd'hui que `contribution_approved`. Ajouter :
- Une fonction `renderCrownsAwarded(firstName: string, crowns: number, reason: string)`
  retournant `{ subject, html }`, même charte parchemin que `renderContributionApproved`
  (médaillon `+X Couronnes`, CTA "Ouvrir l'application"), avec un bloc affichant le
  **motif** (« Pour : <reason> »).
- Dans `serve`, remplacer le court-circuit `if (body.type !== 'contribution_approved') return ok()`
  par un routage : `contribution_approved` → template existant ; `crowns_awarded` → nouveau
  template (lit `data.crowns` + `data.reason`) ; tout autre type → `return ok()`.
- Le lookup user (`email_address`, `first_name`) et l'appel Resend restent partagés.

Config déjà en place en prod (`resend_api_key`, `email_from`, `email_trigger_secret`,
`edge_function_send_email_url`). **Redéploiement de la fonction nécessaire** :
`npx supabase functions deploy send-email`.

## 3. Hub — `apps/hub/src/components/UserDetail.tsx`

Nouvel encart **« Envoyer des Couronnes »** sous la grille `ud-cards` :
- `input type="number"` montant (min 1) + `input type="text"` motif (requis) + bouton **Envoyer**.
- `window.confirm(...)` avant l'appel (crédite ET envoie un email réel).
- État local `sending`, `awardError` ; bouton désactivé si `sending` ou montant invalide ou motif vide.
- Appel `supabase.rpc('award_crowns_manual', { p_user_id, p_amount, p_reason })`.
- Sur succès : reset des champs + `fetchAll()` (refetch → le solde affiché se met à jour).
- Sur erreur : afficher `awardError`.
- Styles : réutiliser les classes `ud-*` existantes + quelques classes dédiées si besoin
  (CSS hub global, fichier de styles existant des pages `ud-`).

## 4. App — rendu de la notif (`apps/explore-web`)

- `src/stores/notificationStore.ts` :
  - Ajouter `'crowns_awarded'` à l'union `Notification['type']`.
  - Ajouter à l'interface `data` : `crowns?: number` et `reason?: string`.
- `src/components/notifications/NotificationPanel.tsx` :
  - `TYPE_ICONS.crowns_awarded = '🪙'`.
  - `formatMessage` : `case 'crowns_awarded': return d.reason ? \`Tu as reçu ${d.crowns ?? 0} 🪙 — ${d.reason}\` : \`Tu as reçu ${d.crowns ?? 0} 🪙\``.
  - Pas dans `AVATAR_NOTIF_TYPES` (pas d'acteur).
- `src/lib/notificationTarget.ts` : **aucun changement** — vérifié, `crowns_awarded` ne
  commence pas par `expedition_` et n'a pas de `placeId`, donc `resolveNotificationTarget`
  retourne déjà `{ kind: 'none' }` (clic in-app = no-op).

## Sécurité / robustesse

- RPC `SECURITY DEFINER` + garde `_is_admin()` : seuls les admins peuvent créditer.
- Montant strictement positif (pas de retrait via cette RPC).
- Idempotence : non requise (un clic = un don volontaire) ; le bouton se désactive
  pendant l'envoi pour éviter le double-clic accidentel.
- L'email échoue silencieusement côté edge function (déjà le cas) → le crédit reste acquis
  même si l'email casse ; la notif in-app reste visible.

## Hors périmètre (YAGNI)

- Pas de page dédiée, pas de mode "email en attente" (un don n'a de sens que pour un compte existant).
- Pas de retrait de Couronnes (montant positif uniquement).
- Pas de table d'audit séparée (la ligne `notifications` fait foi).
- Pas de push (le type n'est pas dans la liste poussée ; email + in-app suffisent).
- Pas de presets de montant (champ libre).

## Fichiers touchés

- `supabase/migrations/255_award_crowns_manual.sql` (nouveau)
- `supabase/functions/send-email/index.ts`
- `apps/hub/src/components/UserDetail.tsx` (+ CSS existant si besoin)
- `apps/explore-web/src/stores/notificationStore.ts`
- `apps/explore-web/src/components/notifications/NotificationPanel.tsx`
