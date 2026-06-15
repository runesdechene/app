# Annonces — Bouton CTA + liens markdown

> Spec — 2026-06-15
> Étend le système d'annonces multicanal (spec 2026-06-05, mig 219).

## Problème

Les annonces (« Nouveautés ») affichées dans l'app n'ont aucun call-to-action.
Quand une nouvelle parle d'un produit ou d'un événement, le lecteur n'a pas de
chemin direct pour agir (acheter, précommander, en savoir plus). On veut, depuis
le Hub :

1. Coller un **lien** + choisir un **texte de bouton**, qui produit un **gros
   bouton CTA en fin de post** dans l'app.
2. Pouvoir aussi mettre des **liens inline dans le markdown** du corps.

## Modèle de données

Table `announcements` (mig 219) — deux nouvelles colonnes nullables :

- `cta_url text` — URL cible du bouton.
- `cta_label text` — libellé du bouton. Si `NULL`/vide → libellé par défaut côté app.

Le bouton n'est rendu que si `cta_url` est non-vide.

### Migration `220_announcements_cta.sql`

- `ALTER TABLE public.announcements ADD COLUMN cta_url text, ADD COLUMN cta_label text;`
- `DROP` de l'ancienne signature 7-args de `update_announcement`, puis recréation
  en 9-args avec `p_cta_url` + `p_cta_label`.
  - Validation légère : `cta_url` qui ne commence pas par `http://` ou `https://`
    (après trim) est stocké `NULL` — pas de bouton cassé / pas de `javascript:`.
  - `cta_label` vide est stocké `NULL`.
- `get_announcement_by_slug` et `list_announcements_admin` renvoient `RETURNS
  public.announcements` (ligne entière) → **aucun changement** : les colonnes
  remontent automatiquement.
- `list_published_announcements` (cartes liste) : inchangée, pas besoin du CTA.

## Hub — `apps/hub`

### `src/types/announcement.ts`
`Announcement + cta_url: string | null + cta_label: string | null`.

### `src/components/annonces/ComposerAnnonce.tsx` (onglet *Corps*)
Sous le textarea du corps, ajouter deux champs :

- **« Lien du bouton (CTA) »** — `input type="url"` lié à `ann.cta_url`.
- **« Texte du bouton »** — `input type="text"` lié à `ann.cta_label`,
  `placeholder="Découvrir"`.
- Aperçu live : si `cta_url` rempli, afficher un mini-bouton désactivé montrant
  `cta_label || 'Découvrir'`.

L'appel `update_announcement` existant reçoit `p_cta_url: ann.cta_url` et
`p_cta_label: ann.cta_label`.

## App — `apps/explore-web`

### `src/types/announcement.ts`
`AnnouncementDetail + cta_url: string | null + cta_label: string | null`.

### Nouveau `src/components/announcements/AnnouncementCta.tsx`
- Props : `{ url: string | null; label: string | null }`.
- Si `!url` → rend `null`.
- Sinon un `<a className="article-cta" href={url} target="_blank"
  rel="noopener noreferrer">{label?.trim() || 'Découvrir'} →</a>`.
- Ouverture en nouvel onglet : ces liens pointent vers la boutique, on ne sort
  pas l'utilisateur de la PWA.

### `ArticlePage.tsx` (mobile) + `ArticleModal.tsx` (desktop)
Monter `<AnnouncementCta url={item.cta_url} label={item.cta_label} />`
**après** `<article className="article-body">` et **avant**
`<AnnouncementSocial>` — c'est « la fin du poste », avant likes/commentaires.

### Liens markdown dans le corps — `src/lib/markdown.ts`
`marked` (gfm) rend déjà `[texte](url)`. Ajouter, au chargement du module, un
hook DOMPurify `afterSanitizeAttributes` : pour tout `<a>`, forcer
`target="_blank"` + `rel="noopener noreferrer"`. Hook enregistré une seule fois,
no-op en environnement node (tests) où DOMPurify n'est pas initialisé.

### CSS
- `.article-cta` dans `ArticlePage.css` (importé aussi par `ArticleModal`) : gros
  bouton thème, pleine largeur, marge au-dessus, état hover.
- `.article-body a` : couleur + soulignement pour rendre les liens inline visibles.

## Hors périmètre (YAGNI)

- Pas de CTA sur les cartes liste / home (liste = aperçu, pas d'action).
- Pas de CTA multi-boutons (un seul suffit).
- Pas de tracking de clics (peut venir plus tard).
- Pas de routes internes app pour le CTA (liens externes boutique en v1).

## Fichiers touchés

- `supabase/migrations/220_announcements_cta.sql` (nouveau)
- `apps/hub/src/types/announcement.ts`
- `apps/hub/src/components/annonces/ComposerAnnonce.tsx`
- `apps/explore-web/src/types/announcement.ts`
- `apps/explore-web/src/components/announcements/AnnouncementCta.tsx` (nouveau)
- `apps/explore-web/src/pages/ArticlePage.tsx`
- `apps/explore-web/src/components/announcements/ArticleModal.tsx`
- `apps/explore-web/src/lib/markdown.ts`
- `apps/explore-web/src/pages/ArticlePage.css`
