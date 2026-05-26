# Hub — Redesign section Photos (master-détail) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter tâche par tâche. Steps en cases à cocher (`- [ ]`).

**Goal:** Refondre la modération photos du hub en un écran master-détail pratique (file + panneau détail), sans perte de fonctionnalité, en découpant `Photos.tsx` (~920 l.) en composants ciblés.

**Architecture:** `Photos.tsx` devient un **conteneur** (état + fetch + toutes les mutations Supabase + sélection + filtres) qui orchestre des composants présentationnels sous `apps/hub/src/components/photos/`. Le détail s'adapte au statut (modération pour `pending`, curation+produit pour `approved`). Styles dans un `Photos.css` co-localisé (classes préfixées `mod-`), cohérent avec le thème parchemin du hub. Aucun changement backend.

**Tech Stack:** React 18 + Vite + TS strict, Supabase JS (RPCs existantes), JSZip (ZIP), lib `shopifyProducts` (proxy GraphQL/REST Admin 2026-01).

**Spec de référence (design validé + maquettes) :** `docs/superpowers/specs/2026-05-26-hub-photos-redesign-design.md`. Le découpage des zones (barre / liste / détail / curation photo-par-photo / recherche produit avec prix) suit les maquettes validées par Uriel.

**Vérification (lire avant de commencer) :** le hub n'a **pas de runner de tests**. Chaque tâche se vérifie par `tsc --noEmit` (exit 0, zéro régression de type) + revue visuelle au déploiement. Commande typecheck (toujours la même) :
`cd "C:/Users/uriel/Desktop/DEVs/app (Runes de Chêne)/apps/hub" && ./node_modules/.bin/tsc --noEmit`

**Règle anti-régression :** garder TOUS les handlers/RPCs existants (`moderate_submission`, `delete_submission`, `set_submission_image_status`, `create_photo_tag`/`delete_photo_tag`/`add_tag_to_submission`/`remove_tag_from_submission`, `update_submission_message`, picker `set_submission_image_shopify_product`/`set_submission_image_media`/`clear_submission_image_shopify_product`, ZIP, lightbox). **Retirer de l'UI** uniquement : le champ libre `product_worn` au niveau soumission (`update_submission_product_worn`, `startEditingProduct`/`saveProductWorn`, `editingProductId/Text`) et l'état `expandedId` (curation désormais inline). `buildDownloadName` ne référence plus `product_worn`.

---

## Carte des fichiers

**Créés (sous `apps/hub/src/components/photos/`) :**
- `types.ts` — types partagés (`PhotoStatus`, `SubmitterRole`, `SubmissionImage`, `PhotoTag`, `PhotoSubmission`) + `isVideoUrl`
- `PhotosToolbar.tsx` — filtres statut/rôle/tags, recherche, bouton « Gérer les tags », bloc téléchargement ZIP
- `SubmissionList.tsx` — file master (lignes vignette · nom · statut · méta), sélection
- `SubmissionDetail.tsx` — panneau détail (en-tête, visu photo-par-photo, message/tags/badges, barre d'actions adaptative)
- `ImageCurator.tsx` — une photo : Garder/Archiver + picker produit (recherche prix) + download (état picker local)
- `TagManager.tsx` — créer/supprimer des tags (extrait)
- `Lightbox.tsx` — visionneuse (extrait)
- `Photos.css` — styles master-détail (classes `mod-*`), importé par le conteneur

**Modifiés :**
- `apps/hub/src/components/Photos.tsx` — devient le conteneur (état/fetch/mutations/sélection), importe `./photos/Photos.css`
- `apps/hub/src/lib/shopifyProducts.ts` — `searchShopifyProducts` renvoie le prix (`ShopifyProductHit.price`)

**Inchangés :** App.css (les anciennes classes `.photo-card` restent inertes ; nettoyage hors périmètre), backend (aucune migration/RPC).

---

## Task 1 : Types partagés

**Files:** Create `apps/hub/src/components/photos/types.ts`

- [ ] **Step 1 : Créer le fichier de types** (copié 1:1 des interfaces actuelles de `Photos.tsx`, `product_worn` conservé pour compat données mais non utilisé en UI)

```typescript
// apps/hub/src/components/photos/types.ts
export type PhotoStatus = 'pending' | 'approved' | 'archived'
export type SubmitterRole = 'client' | 'ambassadeur' | 'partenaire'

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']
export const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))

export interface SubmissionImage {
  id: string
  image_url: string
  sort_order: number
  status: PhotoStatus
  size: string | null            // 'none' = aucun produit porté
  product_worn: string | null    // legacy, non affiché
  shopify_product_id: string | null
  shopify_product_handle: string | null
  shopify_product_title: string | null
  shopify_media_id: string | null
}

export interface PhotoTag { id: string; name: string }

export interface PhotoSubmission {
  id: string
  submitter_name: string
  submitter_email: string
  submitter_instagram: string | null
  submitter_role: SubmitterRole | null
  location_name: string | null
  location_zip: string | null
  departement: string | null
  quest_ref: string | null
  message: string | null
  product_size: string | null
  model_height_cm: number | null
  model_shoulder_width_cm: number | null
  consent_brand_usage: boolean
  status: PhotoStatus
  created_at: string
  reward_crowns: number | null
  product_worn: string | null    // legacy
  hub_submission_images: SubmissionImage[]
  tags: PhotoTag[]
}

export const STATUS_LABELS: Record<PhotoStatus, string> = { pending: 'En attente', approved: 'Validées', archived: 'Archivées' }
export const STATUS_COLORS: Record<PhotoStatus, string> = { pending: '#f59e0b', approved: '#22c55e', archived: '#6b7280' }
export const ROLE_LABELS: Record<SubmitterRole, string> = { client: 'Client', ambassadeur: 'Ambassadeur', partenaire: 'Partenaire' }
export const ROLE_COLORS: Record<SubmitterRole, string> = { client: '#6b7280', ambassadeur: '#b8860b', partenaire: '#7c2d2d' }
```
> Vérifier les valeurs exactes de `ROLE_LABELS`/`ROLE_COLORS` actuelles dans `Photos.tsx` et les recopier à l'identique.

- [ ] **Step 2 : Typecheck** — `tsc --noEmit` → exit 0 (le fichier seul ne casse rien).
- [ ] **Step 3 : Commit** — `git add apps/hub/src/components/photos/types.ts && git commit -m "refactor(hub): types partages photos extraits"`

---

## Task 2 : Prix dans la recherche produit

**Files:** Modify `apps/hub/src/lib/shopifyProducts.ts`

- [ ] **Step 1 : Étendre l'interface + la requête GraphQL + le mapping**

Dans `ShopifyProductHit`, ajouter `price: string | null` (déjà formaté pour affichage, ex. `"49 €"`).
Dans `searchShopifyProducts`, étendre la requête GraphQL pour récupérer le prix et le formater :

```typescript
export interface ShopifyProductHit {
  productId: string
  title: string
  handle: string
  imageUrl: string | null
  price: string | null   // ex. "49 €"
}

// ... dans searchShopifyProducts, remplacer la query par :
  const query = `{ products(first: 8, query: "title:*${escaped}*") { edges { node { legacyResourceId title handle featuredImage { url } priceRangeV2 { minVariantPrice { amount currencyCode } } } } } }`
// ... et le type de retour + le mapping :
  const json = await resp.json() as {
    data?: { products?: { edges?: Array<{ node: {
      legacyResourceId: string; title: string; handle: string;
      featuredImage: { url: string } | null;
      priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } } | null;
    } }> } }
  }
  const edges = json.data?.products?.edges ?? []
  return edges.map(e => {
    const mp = e.node.priceRangeV2?.minVariantPrice
    let price: string | null = null
    if (mp) {
      const amount = Number(mp.amount)
      price = Number.isFinite(amount)
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: mp.currencyCode || 'EUR', maximumFractionDigits: 0 }).format(amount)
        : null
    }
    return {
      productId: e.node.legacyResourceId,
      title: e.node.title,
      handle: e.node.handle,
      imageUrl: e.node.featuredImage?.url ?? null,
      price,
    }
  })
```

- [ ] **Step 2 : Typecheck** — `tsc --noEmit` → exit 0.
- [ ] **Step 3 : Commit** — `git add apps/hub/src/lib/shopifyProducts.ts && git commit -m "feat(hub): prix produit dans la recherche du picker"`

---

## Task 3 : Lightbox (extraction)

**Files:** Create `apps/hub/src/components/photos/Lightbox.tsx`

- [ ] **Step 1 : Composant présentationnel** (reprend la logique préc./suiv./fermer + clavier de `Photos.tsx`)

```typescript
// apps/hub/src/components/photos/Lightbox.tsx
import { useEffect } from 'react'
import { isVideoUrl, type SubmissionImage } from './types'

interface LightboxProps { images: SubmissionImage[]; index: number; onClose: () => void; onIndex: (i: number) => void }

export function Lightbox({ images, index, onClose, onIndex }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, images.length, onClose, onIndex])

  const cur = images[index]
  if (!cur) return null
  return (
    <div className="mod-lightbox" onClick={onClose}>
      <button className="mod-lightbox__close" onClick={onClose}>✕</button>
      <button className="mod-lightbox__nav mod-lightbox__prev" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length) }}>‹</button>
      {isVideoUrl(cur.image_url)
        ? <video src={cur.image_url} controls autoPlay onClick={(e) => e.stopPropagation()} />
        : <img src={cur.image_url} alt="" onClick={(e) => e.stopPropagation()} />}
      <button className="mod-lightbox__nav mod-lightbox__next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length) }}>›</button>
    </div>
  )
}
```

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "refactor(hub): composant Lightbox extrait"`

---

## Task 4 : TagManager (extraction)

**Files:** Create `apps/hub/src/components/photos/TagManager.tsx`

- [ ] **Step 1 : Composant** — extrait du bloc `tag-manager` actuel. Props :

```typescript
import type { PhotoTag } from './types'
interface TagManagerProps {
  tags: PhotoTag[]
  newTagName: string
  onNewTagName: (v: string) => void
  onCreate: () => void
  onDelete: (tagId: string) => void
  onClose: () => void
}
```
Rendu : liste des tags (pill + ✕ → `onDelete`), champ « Nouveau tag… » (Enter → `onCreate`), bouton Créer (désactivé si vide), bouton fermer. Classes `mod-tagmgr*`.

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "refactor(hub): composant TagManager extrait"`

---

## Task 5 : ImageCurator (cœur curation + picker prix)

**Files:** Create `apps/hub/src/components/photos/ImageCurator.tsx`

État **local** : `term`, `hits`, `busy`, `error`, `open` (picker ouvert). Recherche debouncée (300 ms) via `searchShopifyProducts`. Appelle les handlers async fournis par le parent (qui font le push/RPC). Affiche : aperçu (clic → `onOpenLightbox`), taille portée (`size`, « Aucun produit » si `none`), Garder/Archiver, et le picker (lié → 🏷 titre + Retirer ; sinon bouton Relier → champ recherche + résultats vignette·nom·**prix**), + download.

- [ ] **Step 1 : Props + composant**

```typescript
import { useEffect, useState } from 'react'
import { isVideoUrl, type SubmissionImage } from './types'
import { searchShopifyProducts, type ShopifyProductHit } from '../../lib/shopifyProducts'

interface ImageCuratorProps {
  image: SubmissionImage
  onOpenLightbox: () => void
  onSetStatus: (status: PhotoStatus) => void   // 'approved' | 'archived'
  onLink: (hit: ShopifyProductHit) => Promise<void>     // parent: push + RPCs (+ archivage sync-back gere ailleurs)
  onUnlink: () => Promise<void>
  onDownload: () => void
  busyExternally?: boolean
}
```
(`PhotoStatus` importé depuis `./types`.) Le composant gère `busy` local OR `busyExternally`. Logique recherche/erreur identique à l'actuelle (`Photos.tsx` `linkImageToProduct`/picker), mais déplacée ici ; `onLink`/`onUnlink` encapsulent les appels Supabase/Shopify côté parent (conteneur). Affichage prix : `{hit.price && <span className="mod-hit__price">{hit.price}</span>}`. Structure visuelle = maquette « approved-detail » validée.

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "feat(hub): composant ImageCurator (curation + picker prix)"`

---

## Task 6 : SubmissionList (file master)

**Files:** Create `apps/hub/src/components/photos/SubmissionList.tsx`

- [ ] **Step 1 : Props + composant**

```typescript
import { isVideoUrl, STATUS_COLORS, type PhotoSubmission } from './types'
interface SubmissionListProps {
  submissions: PhotoSubmission[]
  selectedId: string | null
  onSelect: (id: string) => void
}
```
Rendu : pour chaque soumission, une ligne `mod-row` (surlignée si `selectedId`) : vignette (1re image, vidéo → `<video muted>`), nom, méta (nb fichiers, `#tags`, ✓ si `consent_brand_usage`), pastille couleur `STATUS_COLORS[status]`, date courte. Clic → `onSelect(id)`. Liste scrollable (`mod-list`).

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "feat(hub): composant SubmissionList (file master)"`

---

## Task 7 : SubmissionDetail (panneau adaptatif)

**Files:** Create `apps/hub/src/components/photos/SubmissionDetail.tsx`

Panneau de la soumission sélectionnée. État **local** : `activeImageIdx` (visu photo-par-photo), édition message (`editingMessage`, `messageText`), dropdown tag ouvert. Reçoit la soumission + tous les handlers du conteneur. Structure = maquettes validées (layout-b-detail + approved-detail) :
- En-tête : nom + badge rôle, email, instagram, lieu/département/quête, date, badge statut (`STATUS_COLORS`), « Diffusion OK » si consentement, bouton « Tout télécharger ».
- **Visu** : grande image courante (`hub_submission_images[activeImageIdx]`, clic → lightbox) + strip de vignettes (clic → change `activeImageIdx`).
- **Curation** : `<ImageCurator>` pour la photo courante (et/ou liste des photos selon place — défaut : ImageCurator de la photo courante sous la grande visu).
- Badges morpho (`product_size`, `model_height_cm` → « 183 cm », `model_shoulder_width_cm`), message éditable (`update_submission_message`), tags (ajout via dropdown / retrait).
- **Barre d'actions ancrée, adaptative** (voir Step 1).

- [ ] **Step 1 : Props + barre adaptative**

```typescript
interface SubmissionDetailProps {
  submission: PhotoSubmission
  allTags: PhotoTag[]
  crowns: number
  onCrowns: (n: number) => void
  onModerate: (status: PhotoStatus, crowns?: number) => void
  onDelete: () => void
  onSaveMessage: (msg: string | null) => void
  onAddTag: (tagId: string) => void
  onRemoveTag: (tagId: string) => void
  onSetImageStatus: (imageId: string, status: PhotoStatus) => void
  onLinkImage: (imageId: string, hit: ShopifyProductHit) => Promise<void>
  onUnlinkImage: (imageId: string) => Promise<void>
  onOpenLightbox: (index: number) => void
  onDownloadSubmission: () => void
  onDownloadImage: (index: number) => void
}
```
Barre adaptative (rendu selon `submission.status`) :
```tsx
{submission.status === 'pending' && (
  <div className="mod-actionbar">
    <span>🪙</span>
    <input type="number" min={0} value={crowns} onChange={e => onCrowns(Math.max(0, parseInt(e.target.value || '0', 10)))} className="mod-crowninput" />
    <button className="mod-btn mod-btn--approve" onClick={() => onModerate('approved', crowns)}>Valider +{crowns}</button>
    <button className="mod-btn mod-btn--archive" onClick={() => onModerate('archived')}>Archiver</button>
    <button className="mod-btn mod-btn--danger" onClick={onDelete}>Supprimer</button>
  </div>
)}
{submission.status === 'approved' && (
  <div className="mod-actionbar">
    <button className="mod-btn mod-btn--archive" onClick={() => onModerate('archived')}>Archiver</button>
    <button className="mod-btn mod-btn--danger" onClick={onDelete}>Supprimer</button>
  </div>
)}
{submission.status === 'archived' && (
  <div className="mod-actionbar">
    <span>🪙</span>
    <input type="number" min={0} value={crowns} onChange={e => onCrowns(Math.max(0, parseInt(e.target.value || '0', 10)))} className="mod-crowninput" />
    <button className="mod-btn mod-btn--approve" onClick={() => onModerate('approved', crowns)}>Re-valider +{crowns}</button>
    <button className="mod-btn mod-btn--danger" onClick={onDelete}>Supprimer</button>
  </div>
)}
```

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "feat(hub): composant SubmissionDetail (panneau adaptatif)"`

---

## Task 8 : PhotosToolbar

**Files:** Create `apps/hub/src/components/photos/PhotosToolbar.tsx`

- [ ] **Step 1 : Props + composant** (extrait de la barre actuelle + recherche)

```typescript
interface PhotosToolbarProps {
  filter: PhotoStatus | 'all'; onFilter: (f: PhotoStatus | 'all') => void
  roleFilter: 'all' | SubmitterRole; onRoleFilter: (r: 'all' | SubmitterRole) => void
  tagFilter: 'all' | string; onTagFilter: (t: 'all' | string) => void
  tags: PhotoTag[]
  search: string; onSearch: (s: string) => void
  pendingCount: number
  onToggleTagManager: () => void
  downloadSince: string; onDownloadSince: (v: string) => void
  downloadCount: { subs: number; files: number }
  isDownloading: boolean; downloadProgress: string; onDownloadZip: () => void
}
```
Rendu : segmenté statut (badge « En attente · N » = `pendingCount`), chips rôle, chips tags, champ recherche, « Gérer les tags », bloc ZIP (date + compteur + bouton + clear), lien « Ouvrir le formulaire photos ↗ ». Classes `mod-toolbar*`.

- [ ] **Step 2 : Typecheck** → exit 0. **Step 3 : Commit** — `git commit -m "feat(hub): composant PhotosToolbar"`

---

## Task 9 : Conteneur Photos.tsx (refonte + câblage)

**Files:** Modify `apps/hub/src/components/Photos.tsx`

- [ ] **Step 1 : Refondre le conteneur**
  - Importer les types depuis `./photos/types`, les composants, et `./photos/Photos.css`.
  - **Conserver** : fetch des submissions + `allTags`, et TOUS les handlers de mutation (moderate, deleteSubmission, setImageStatus **avec sync-back archivage** via `unlink` interne, tag CRUD, saveMessage, ZIP, picker `link/unlink`), `crownsFor`/`setCrownInput`.
  - **Ajouter** : `const [selectedId, setSelectedId] = useState<string | null>(null)` et `const [search, setSearch] = useState('')`. `filteredSubmissions` intègre le filtre recherche (`submitter_name`/`submitter_email` `includes(search.toLowerCase())`). Sélection auto du 1er élément si `selectedId` absent/hors liste après filtrage.
  - **Supprimer** : `expandedId`, `editingProductId/Text`, `startEditingProduct`, `saveProductWorn` (et l'appel `update_submission_product_worn`). Retirer `product_worn` de `buildDownloadName`.
  - Rendu : `<div className="mod">` → `<PhotosToolbar .../>` + `{showTagManager && <TagManager .../>}` + `<div className="mod-split"><SubmissionList .../><SubmissionDetail submission={selected} .../></div>` + `{lightbox && <Lightbox .../>}`. État vide / loading / `fetchError` (bannière) gérés.
  - `linkImage(imageId, hit)` / `unlinkImage(imageId)` : déplacer la logique existante `linkImageToProduct`/`unlinkImageFromProduct` ici, exposées aux enfants ; `setImageStatus(subId, imageId, status)` garde le sync-back (`if status==='archived' → unlink`).

- [ ] **Step 2 : Typecheck** — `tsc --noEmit` → exit 0 (résoudre tous les imports/props).
- [ ] **Step 3 : Commit** — `git commit -m "refactor(hub): Photos.tsx conteneur master-detail (cablage composants)"`

---

## Task 10 : Styles Photos.css

**Files:** Create `apps/hub/src/components/photos/Photos.css` (importé en Task 9)

- [ ] **Step 1 : Styles master-détail, cohérents thème parchemin du hub**
  - Layout : `.mod` (page), `.mod-toolbar` (flex wrap), `.mod-split` (grid `minmax(280px, 32%) 1fr`, gap, hauteur `calc(100vh - X)`, colonnes scrollables).
  - `.mod-list` / `.mod-row` (carte ligne, état `.is-selected` bord oxblood), pastille statut.
  - `.mod-detail` (panneau), `.mod-viewer` (grande image + `.mod-strip` vignettes), `.mod-curator`, `.mod-hit` (résultat produit : vignette + nom + `.mod-hit__price`).
  - `.mod-actionbar` (ancrée bas, `position:sticky; bottom:0`), `.mod-btn--approve/archive/danger`, `.mod-crowninput`.
  - `.mod-tagmgr*`, `.mod-lightbox*`, badges (`.mod-badge`, couleurs statut/rôle).
  - Palette : réutiliser les teintes hub (parchemin/encre) ; accents statut (#f59e0b/#22c55e/#6b7280) et oxblood (#7c2d2d). Responsive : sous ~860px, `.mod-split` en 1 colonne, détail en overlay (`.mod-detail.is-open`).
  - Le détail visuel se peaufine à l'écran (Task 11).

- [ ] **Step 2 : Build** — `cd "C:/.../apps/hub" && pnpm build` → succès (tsc + vite).
- [ ] **Step 3 : Commit** — `git commit -m "feat(hub): styles Photos.css (master-detail parchemin)"`

---

## Task 11 : Build, déploiement, revue visuelle, itération

**Files:** aucun (vérif + déploiement).

- [ ] **Step 1 : Build complet** — `cd "C:/.../apps/hub" && pnpm build` → exit 0.
- [ ] **Step 2 : Déployer** — `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`.
- [ ] **Step 3 : Revue visuelle réelle** sur `hub.runesdechene.com` :
  - Filtrer En attente → sélectionner → curer les photos → relier un produit (résultats avec **prix**) → Valider (+Couronnes).
  - Filtrer Validées → naviguer photo-par-photo (grande visu + strip + lightbox) → relier/retirer un produit.
  - Vérifier : recherche nom/email, tags (CRUD + filtre), ZIP par date, archivage retire bien la photo de Shopify, suppression.
- [ ] **Step 4 : Itérer** le visuel selon le retour d'Uriel (palette/densité/espacements) — commits `style(hub): ...` au fil de l'eau.

---

## Self-review (rempli à la rédaction)

**1. Couverture du spec :** D1 master-détail → Tasks 6/7/9. D2 curation inline (drop expandedId) → Tasks 5/7/9. D3 barre adaptative → Task 7 Step 1. D4 recherche → Tasks 8/9. D5 retrait product_worn legacy → Task 9 Step 1. D6 cohérence parchemin → Task 10. D7 découpage composants → Tasks 1,3-9. D8 responsive → Task 10. D9 détail adaptatif + visu photo-par-photo + prix → Tasks 2,5,7. Checklist anti-régression (§3) → couverte par « conserver » Task 9 + composants. ✓

**2. Placeholders :** les contrats (prop interfaces) et la logique nouvelle (prix, recherche, barre adaptative, sélection) sont en code exact ; le JSX/CSS de mise en page réalise les **maquettes validées** (référencées) et se vérifie au déploiement — choix assumé (pas de runner de tests, itération visuelle), pas de « TODO ».

**3. Cohérence des types :** types centralisés dans `photos/types.ts` (Task 1), `ShopifyProductHit.price` ajouté Task 2 et consommé Tasks 5/7, handlers nommés identiquement entre conteneur (Task 9) et props enfants (Tasks 5-8).

**Note exécution :** tâches très séquentielles (les composants convergent vers le conteneur Task 9). En subagent-driven, exécuter dans l'ordre 1→11 ; Task 9 ne typecheck qu'une fois 1-8 livrés.
