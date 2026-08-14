# Compteur d'écoutes des Fragments audio — design

> 2026-08-14 · Périmètre : monorepo app (DB + Hub) + repo thème Shopify (voisin)

## Pourquoi

Le lecteur audio des Fragments existe depuis plusieurs drops et n'est mesuré par rien. Aucune
donnée ne dit si les voix off sont écoutées, ni jusqu'au bout. Or chaque Fragment a un coût de
production récurrent (enregistrement, narrateur). La question à trancher est simple : **est-ce
qu'on continue à payer la voix off à chaque drop ?**

Ce chantier produit la donnée qui répond à cette question. Rien d'autre.

## Ce qu'on mesure — et ce qu'on ne mesure pas

**Mesuré :**

- **Écoutes réelles** — un visiteur qui a dépassé le seuil d'engagement (voir plus bas), pas un
  `play` de curiosité de deux secondes.
- **Complétions** — écoute allée jusqu'au bout. C'est la colonne qui décide.
- **Surface** — `motif` (page collection) ou `produit` (fiche produit), pour savoir *où* les gens
  écoutent réellement.

**Non mesuré, et assumé :** le lien entre écoute et achat. Il faudrait relier une session
d'écoute à une session de commande Shopify — autre chantier, autre coût. Hors périmètre.

## Décisions actées

| Décision | Raison |
|---|---|
| **Hub uniquement, rien de visible sur la boutique** | Un compteur affichant « 3 écoutes » sur une fiche à 40 € est une preuve sociale faible : ça nuit plus que ça n'aide. |
| **Pas de bouton like** | Le taux de complétion est un meilleur signal : il ne demande rien au visiteur, personne ne peut le gonfler, et il porte sur 100 % des écoutes au lieu de quelques pourcents de cliqueurs. |
| **Clé = handle du métaobjet Illustration** | C'est l'objet qui porte le fichier audio. Identique sur les deux surfaces par construction. |
| **Pas de clé sur le tag `fragment:*`** | Déjà éprouvé et raté : migrations 251/252/253 ont dû rattraper les variations de casse et de séparateur des tags produit (Avalon tombait sur `null`). Ne pas y retourner. |
| **Un snippet partagé, pas une copie** | Le player et son tracking vivent dans un seul fichier, appelé par les deux surfaces. |
| **Aucune lecture publique de la table** | Les chiffres ne sortent pas. RPC d'écriture seule côté anon. |

### Écarté explicitement

- **Bouton like avec compteur public** — écarté le 2026-08-14. Ni maintenant ni plus tard sous
  cette forme : le compteur bas est le problème, pas le clic.
- **Compteur d'écoutes affiché sur la boutique, même sous seuil** — écarté avec le like.
- **Clé sur le tag produit `fragment:*`** — voir tableau ci-dessus.

## Résolution de l'Illustration

Le métaobjet Illustration est atteint différemment selon la surface. Les deux chemins existent
déjà dans le thème, aucun n'est à créer :

| Surface | Chemin | Déjà utilisé par |
|---|---|---|
| Page motif (`/collections/avalon`) | `collection.metafields.custom.illustrations.value` | `rdc_motif.liquid`, `snippets/illustration-card.liquid` |
| Fiche produit | `product.metafields.custom.illustration_produit.value` | `rdc_fragment-app.liquid`, `rdc_saga-motifs.liquid` |

La clé de comptage est `ill.system.handle`. Si `system.handle` revient vide, on retombe sur
`collection.handle` (surface motif) ou `product.handle` (surface produit) et on marque la ligne —
ça ne doit pas arriver, mais un trou silencieux serait pire qu'un trou visible.

## Base de données

Migration `340_fragment_audio_plays.sql`, poussée par `npx supabase db push --linked`
(canal unique — pas de MCP `apply_migration`, pas de dashboard).

### Table

```sql
create table public.fragment_audio_plays (
  id                  bigint generated always as identity primary key,
  illustration_handle text        not null,
  source              text        not null check (source in ('motif', 'produit')),
  session_id          text        not null,
  listened_seconds    integer     not null default 0,
  completed           boolean     not null default false,
  played_on           date        not null default (now() at time zone 'UTC')::date,
  created_at          timestamptz not null default now()
);
```

Types conformes aux règles du repo : `bigint identity` en PK, `text` sans longueur arbitraire,
`timestamptz`, `boolean` réel, énumération par `check` plutôt que par type enum.

### Dédoublonnage

```sql
create unique index fragment_audio_plays_unique_daily
  on public.fragment_audio_plays (session_id, illustration_handle, source, played_on);

create index fragment_audio_plays_handle_idx
  on public.fragment_audio_plays (illustration_handle, source);
```

Une ligne par (session, Illustration, surface, jour). Les événements successifs d'une même écoute
mettent la ligne à jour, ils n'en créent pas de nouvelle.

### Verrouillage

```sql
alter table public.fragment_audio_plays enable row level security;
alter table public.fragment_audio_plays force row level security;
revoke all on public.fragment_audio_plays from anon, authenticated;
```

**Aucune policy.** Ni `anon` ni `authenticated` ne touchent la table directement : tout passe par
les deux fonctions `security definer` ci-dessous. C'est le moindre privilège strict — une policy
d'insert anon serait une surface d'écriture ouverte pour rien.

### RPC d'écriture (anon)

```sql
create or replace function public.log_fragment_audio_play(
  p_illustration_handle text,
  p_source              text,
  p_session_id          text,
  p_listened_seconds    integer,
  p_completed           boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Entrées hostiles : on sort en silence, jamais d'erreur renvoyée au client.
  if coalesce(btrim(p_illustration_handle), '') = '' then return; end if;
  if p_source not in ('motif', 'produit') then return; end if;
  if length(coalesce(p_session_id, '')) not between 8 and 64 then return; end if;

  insert into public.fragment_audio_plays
    (illustration_handle, source, session_id, listened_seconds, completed)
  values
    (btrim(p_illustration_handle), p_source, p_session_id,
     greatest(coalesce(p_listened_seconds, 0), 0), coalesce(p_completed, false))
  on conflict (session_id, illustration_handle, source, played_on) do update set
    listened_seconds = greatest(fragment_audio_plays.listened_seconds, excluded.listened_seconds),
    completed        = fragment_audio_plays.completed or excluded.completed;
end;
$$;

grant execute on function public.log_fragment_audio_play(text, text, text, integer, boolean) to anon;
```

`greatest` et `or` : un événement tardif ne peut que faire monter le compteur, jamais le baisser.
Un `ended` suivi d'un rembobinage ne défait pas la complétion.

### RPC de lecture (Hub)

`get_fragment_audio_stats()` — agrégat par Illustration et par surface : écoutes, complétions,
taux. `stable`, `security definer`, exposée à `authenticated` uniquement.

⚠ **À vérifier avant d'écrire, pas à deviner** : le repo a un motif de garde staff installé par
les migrations 337 (`emails_staff_only`) et 338 (`users_admin_revoke_anon`). La RPC de lecture
doit reprendre ce motif exact plutôt que d'en inventer un. Lire ces deux migrations d'abord.

## Thème Shopify

### `snippets/fragment-audio.liquid` (nouveau)

Le lecteur et son tracking, en un seul endroit. Paramètres : `ill` (le métaobjet) et `source`
(`'motif'` ou `'produit'`).

Le `<audio controls preload="none">` natif est **conservé tel quel** — on n'écrit pas de player
maison, on écoute simplement ses événements.

**Seuil d'écoute** : `timeupdate` déclenche quand `currentTime` atteint le plus petit de 10 s ou
25 % de la durée. Un Fragment court n'est pas pénalisé, un Fragment long n'est pas compté sur une
amorce.

**Complétion** : événement `ended`.

**Envoi final** : `visibilitychange` (état `hidden`) pour capturer le temps écouté d'un visiteur
qui ferme l'onglet en cours de lecture. Envoi en `fetch(..., { keepalive: true })` — **pas**
`navigator.sendBeacon`, qui ne permet pas de poser les en-têtes `apikey` / `Authorization` que
PostgREST exige.

**Identité de session** : chaîne aléatoire posée dans `sessionStorage`. Combinée à l'index unique
quotidien, elle borne un visiteur à une écoute comptée par Fragment et par surface et par jour.
Un visiteur déterminé peut forger des identifiants — c'est accepté : la mesure sert à décider
d'une dépense de production, pas à établir un classement.

**URL et clé** : mêmes valeurs que `rdc_fragment-app.liquid` (URL Supabase + clé anon en réglages
de section avec valeur par défaut). Ne pas réinventer un canal.

### `sections/rdc_motif.liquid` (modifié)

Le bloc `rdcm__audio` (actuellement lignes ~577-594) est remplacé par un appel au snippet avec
`source: 'motif'`. Le rendu visuel ne change pas : mêmes classes CSS, même label, même avatar de
narrateur. Les réglages de section (`audio_enabled`, `audio_label`, `audio_field_key`,
`narrator_field_key`, `audio_avatar`, `audio_avatar_size`) restent où ils sont et sont passés au
snippet.

### `sections/lecture-fragment-v2.liquid` (modifié)

C'est le bloc « lire le Fragment » de la fiche produit — l'audio y est chez lui. Deux ajouts :

1. Résolution de l'Illustration via `product.metafields.custom.illustration_produit.value`
   (la section est aujourd'hui alimentée uniquement par les réglages du customizer, elle ne
   connaît aucun métaobjet).
2. Appel au snippet avec `source: 'produit'`, sous le texte du Fragment.

Si le métachamp est vide ou si l'Illustration ne porte pas de fichier audio, **rien ne s'affiche**
— même règle que sur la page motif.

> Note repérée en passant, **hors périmètre de ce chantier** : le récit du Fragment ne s'affiche
> pas sur la fiche produit parce que cette section est alimentée par le customizer et non par
> `son_histoire` du métaobjet. Le chemin de résolution ajouté ici rendrait le branchement trivial,
> mais c'est une autre décision — à ouvrir séparément.

## Hub

Nouvel écran `/shopify/fragments-audio`, à côté de `ShopifyUnlocks`. Client Supabase habituel
(`../lib/supabase`), pas de nouveau canal.

**Tableau principal**, une ligne par Fragment, **trié par taux de complétion décroissant** — c'est
la colonne qui décide, elle est en haut :

| Fragment | Écoutes | Complétions | Taux | dont page motif | dont fiche produit |
|---|---|---|---|---|---|

**Bandeau de couverture**, au-dessus du tableau. Trois compteurs, chacun cliquable pour dérouler
la liste :

- Illustrations **sans fichier audio** — les Fragments qui n'ont pas encore de voix off.
- Produits **sans `illustration_produit` renseigné** — un oubli au drop rend le bloc muet sans
  aucun signal. Requis via le proxy Admin GraphQL existant
  (`apps/hub/netlify/functions/shopify-proxy`, déjà utilisé par `lib/shopifyProducts.ts`).
- Fragments **à zéro écoute** depuis leur mise en ligne.

Ce bandeau est la compensation du choix de résolution par métachamp explicite : le trou se voit
au lieu de se découvrir six semaines plus tard.

## Périmètre — ce qui n'est PAS fait

- Aucun bouton like, aucun compteur visible côté boutique.
- Aucune corrélation écoute → achat.
- Aucun changement au rendu visuel du lecteur sur la page motif.
- Aucun branchement du récit `son_histoire` sur la fiche produit (voir note ci-dessus).
- Aucune rétroaction : les écoutes passées ne sont pas récupérables, la mesure part de zéro le
  jour du déploiement.

## Vérification

Rien n'est déclaré fait sans ces relevés :

1. **DB** — appliquer 340, puis appeler `log_fragment_audio_play` deux fois avec la même session
   et le même handle : une seule ligne, `listened_seconds` au maximum des deux, `completed`
   collant. Vérifier qu'un `select` direct sur la table en clé anon est **refusé**.
2. **Entrées hostiles** — `source` invalide, `session_id` de 2 caractères, handle vide : aucune
   ligne créée, aucune erreur remontée.
3. **Thème** — sur la page motif et sur une fiche produit : lancer l'audio, dépasser le seuil,
   laisser finir. Deux lignes en base, une par surface, `completed = true` sur les deux.
4. **Seuil** — lancer et couper à 3 s : aucune ligne.
5. **Hub** — les chiffres de l'écran correspondent aux lignes réellement en base.
6. **Régression visuelle** — la page motif est identique avant/après, capture à l'appui.

Déploiement : migration par `db push --linked`, thème poussé sur le repo Shopify voisin, Hub
déployé **manuellement** sur Netlify (pas d'auto-deploy Git).

## Fichiers touchés

**Monorepo app :**
- `supabase/migrations/340_fragment_audio_plays.sql` (nouveau)
- `apps/hub/src/components/FragmentsAudio.tsx` (nouveau)
- `apps/hub/src/App.tsx` (route)
- `apps/hub/src/components/Sidebar.tsx` (entrée de menu)

**Repo thème Shopify (voisin) :**
- `snippets/fragment-audio.liquid` (nouveau)
- `sections/rdc_motif.liquid` (le bloc audio devient un appel au snippet)
- `sections/lecture-fragment-v2.liquid` (résolution Illustration + appel au snippet)
