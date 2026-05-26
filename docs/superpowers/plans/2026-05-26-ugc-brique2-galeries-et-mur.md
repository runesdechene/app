# UGC Brique 2 — Galeries fiches produit + Mur « Le Mouvement » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relier les photos UGC approuvées à de vrais produits Shopify (picker, pas de champ libre) pour les pousser dans le carrousel natif des fiches produit, et publier un mur « Le Mouvement » indexable sur `app.runesdechene.com/mouvement`.

**Architecture:** Deux flux indépendants partageant une migration. **Flux écriture (hub)** : un picker interroge Shopify en direct via le `shopify-proxy` existant ; relier une image pousse l'image dans la galerie native du produit (REST `products/{id}/images.json`) et mémorise l'ID image pour pouvoir la retirer. **Flux lecture (seo-pages)** : une vue SQL `movement_wall_photos` projette les photos approuvées+consenties ; un générateur statique produit `dist/mouvement/index.html` (HTML SEO), servi sous `app.runesdechene.com/mouvement` via rewrite Netlify 200.

**Tech Stack:** Supabase Postgres (migration SQL + RPC `SECURITY DEFINER` + vue), React 18 + Vite (hub, `Photos.tsx`), Netlify Function `shopify-proxy` (Admin API REST 2026-01 + GraphQL), seo-pages (Node/TS pur, template literals), Netlify redirects.

**Approche de vérification (lire avant de commencer) :** Le hub et seo-pages n'ont **aucun runner de tests** (pas de script `test` dans les `package.json`). On ne fabrique donc pas de faux tests unitaires. Chaque tâche est vérifiée par des **preuves concrètes** : requêtes SQL (via le MCP Supabase ou `psql`), reproduction `curl` de l'API PostgREST/Shopify, `tsc --noEmit`, et `pnpm build`. C'est la même méthode que celle utilisée pour diagnostiquer le bug de la page utilisateurs.

**Secrets / contexte d'environnement :**
- Projet Supabase : ref `ukpapqssgsxirsgmcvof`. URL/anon dans `.env` racine (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Service key seo-pages : `SUPABASE_SERVICE_KEY`.
- Shopify : shop `runes-de-chene.myshopify.com`, Admin API `2026-01`, token côté serveur (`SHOPIFY_ACCESS_TOKEN`) déjà configuré sur le hub Netlify ; le proxy `/.netlify/functions/shopify-proxy` exige `Authorization: Bearer <session admin>`.

---

## Carte des fichiers

**Créés :**
- `supabase/migrations/178_ugc_brique2_product_link.sql` — colonnes + RPCs + vue
- `apps/hub/src/lib/shopifyProducts.ts` — recherche produits (GraphQL) + push/suppression image (REST) via le proxy
- `apps/seo-pages/src/lib/movement.ts` — data-layer du mur (lecture `movement_wall_photos`)
- `apps/seo-pages/src/templates/movement-page.ts` — page manifeste + grille du mur (HTML complet)

**Modifiés :**
- `apps/hub/src/components/Photos.tsx` — picker produit par image (remplace l'input texte), boutons Relier/Retirer, sync-back à l'archivage
- `apps/seo-pages/src/build.ts` — génération de `dist/mouvement/index.html`
- `apps/explore-web/netlify.toml` — rewrite `/mouvement` → site seo-pages

**Manuel (hors code, étape finale) :**
- Shopify Admin : redirection URL `301 /pages/ils-nous-portent → /mouvement` + lien d'entrée vers la page

---

## Phase 0 — Migration (socle partagé)

### Task 1 : Migration 178 — colonnes, RPCs, vue

**Files:**
- Create: `supabase/migrations/178_ugc_brique2_product_link.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 178_ugc_brique2_product_link.sql
-- UGC Brique 2 : lien photo -> produit Shopify (galeries fiches produit) + vue du mur.

-- 1. Colonnes de liaison produit, par image (curation au niveau image, cf. Brique 1bis-A)
alter table public.hub_submission_images
  add column if not exists shopify_product_id     text,
  add column if not exists shopify_product_handle text,
  add column if not exists shopify_product_title  text,
  add column if not exists shopify_media_id        text;

comment on column public.hub_submission_images.shopify_product_id is
  'ID produit Shopify (legacyResourceId numerique) — cle de jointure et de push';
comment on column public.hub_submission_images.shopify_media_id is
  'ID de l image produit Shopify renvoye au push (REST products/{id}/images.json) — null = non poussee';

-- 2. RPC : lier une image a un produit Shopify (remplace le champ libre product_worn)
create or replace function public.set_submission_image_shopify_product(
  p_image_id  uuid,
  p_product_id text,
  p_handle     text,
  p_title      text
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_product_id     = nullif(btrim(p_product_id), ''),
         shopify_product_handle = nullif(btrim(p_handle), ''),
         shopify_product_title  = nullif(btrim(p_title), '')
   where id = p_image_id;
end; $$;

-- 3. RPC : enregistrer l ID image Shopify apres un push reussi
create or replace function public.set_submission_image_media(
  p_image_id uuid,
  p_media_id text
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_media_id = nullif(btrim(p_media_id), '')
   where id = p_image_id;
end; $$;

-- 4. RPC : delier (apres suppression cote Shopify)
create or replace function public.clear_submission_image_shopify_product(
  p_image_id uuid
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_product_id     = null,
         shopify_product_handle = null,
         shopify_product_title  = null,
         shopify_media_id        = null
   where id = p_image_id;
end; $$;

-- 5. Vue lecture seule du mur : photos approuvees + consentement diffusion (lue par seo-pages, service key)
create or replace view public.movement_wall_photos as
select
  i.id                     as image_id,
  i.image_url,
  i.shopify_product_handle,
  i.shopify_product_title,
  s.submitter_name,
  s.submitter_instagram,
  s.message,
  s.created_at
from public.hub_submission_images i
join public.hub_photo_submissions s on s.id = i.submission_id
where i.status = 'approved'
  and s.status = 'approved'
  and s.consent_brand_usage = true;
```

- [ ] **Step 2 : Appliquer la migration**

Via le MCP Supabase `apply_migration` (name: `ugc_brique2_product_link`, query = contenu du fichier), OU `npx supabase db push` si CLI lié. Projet ref : `ukpapqssgsxirsgmcvof`.

- [ ] **Step 3 : Vérifier colonnes + vue (preuve)**

Exécuter (MCP `execute_sql`) :
```sql
select count(*) as wall_rows from public.movement_wall_photos;
select column_name from information_schema.columns
 where table_schema='public' and table_name='hub_submission_images'
   and column_name like 'shopify_%' order by column_name;
```
Attendu : 4 colonnes `shopify_media_id, shopify_product_handle, shopify_product_id, shopify_product_title` ; `wall_rows` = nombre de photos déjà approuvées+consenties (≥ 0, sans erreur).

- [ ] **Step 4 : Vérifier les RPCs**

```sql
select proname from pg_proc
 where pronamespace='public'::regnamespace
   and proname in ('set_submission_image_shopify_product','set_submission_image_media','clear_submission_image_shopify_product')
 order by proname;
```
Attendu : les 3 noms.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/178_ugc_brique2_product_link.sql
git commit -m "feat(db): mig 178 — lien photo->produit Shopify + vue movement_wall_photos"
```
Note : le post-commit hook lance `scripts/graphify-sql.py` (rebuild du graphe SQL).

---

## Phase A — Flux écriture (hub : picker + push)

### Task 2 : Lib d'accès Shopify produits

**Files:**
- Create: `apps/hub/src/lib/shopifyProducts.ts`

Pattern d'appel proxy de référence : `apps/hub/src/components/ShopifySync.tsx:34-45` (Bearer via `supabase.auth.getSession()`, endpoint relatif à `/admin/api/2026-01/`).

- [ ] **Step 1 : Écrire la lib**

```typescript
// apps/hub/src/lib/shopifyProducts.ts
// Recherche produits (GraphQL Admin) + push/suppression d'image (REST Admin), via le proxy admin-authed.
import { supabase } from './supabase'

const SHOP = 'runes-de-chene.myshopify.com'

export interface ShopifyProductHit {
  productId: string   // legacyResourceId numerique (ex: "7845123")
  title: string
  handle: string
  imageUrl: string | null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const jwt = session?.access_token
  if (!jwt) throw new Error('Session expiree, reconnecte-toi')
  return { Authorization: `Bearer ${jwt}` }
}

function proxyUrl(endpoint: string): string {
  return `/.netlify/functions/shopify-proxy?endpoint=${encodeURIComponent(endpoint)}&shop=${SHOP}`
}

/** Recherche les produits dont le titre contient `term` (GraphQL: bon pour la recherche partielle). */
export async function searchShopifyProducts(term: string): Promise<ShopifyProductHit[]> {
  const clean = term.trim()
  if (clean.length < 2) return []
  const escaped = clean.replace(/"/g, '\\"')
  const query = `{ products(first: 8, query: "title:*${escaped}*") { edges { node { legacyResourceId title handle featuredImage { url } } } } }`

  const resp = await fetch(proxyUrl('graphql.json'), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!resp.ok) throw new Error(`Recherche produit: HTTP ${resp.status}`)
  const json = await resp.json() as {
    data?: { products?: { edges?: Array<{ node: { legacyResourceId: string; title: string; handle: string; featuredImage: { url: string } | null } }> } }
  }
  const edges = json.data?.products?.edges ?? []
  return edges.map(e => ({
    productId: e.node.legacyResourceId,
    title: e.node.title,
    handle: e.node.handle,
    imageUrl: e.node.featuredImage?.url ?? null,
  }))
}

/** Pousse une image (URL publique) dans la galerie native d'un produit. Retourne l'ID image Shopify. */
export async function pushImageToProduct(productId: string, imageUrl: string, alt: string): Promise<string> {
  const resp = await fetch(proxyUrl(`products/${productId}/images.json`), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { src: imageUrl, alt } }),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Push image: HTTP ${resp.status} — ${txt.slice(0, 200)}`)
  }
  const json = await resp.json() as { image?: { id?: number } }
  const id = json.image?.id
  if (!id) throw new Error('Push image: reponse Shopify sans image.id')
  return String(id)
}

/** Supprime une image precedemment poussee. Idempotent: un 404 (deja supprimee) est tolere. */
export async function deleteProductImage(productId: string, mediaId: string): Promise<void> {
  const resp = await fetch(proxyUrl(`products/${productId}/images/${mediaId}.json`), {
    method: 'DELETE',
    headers: { ...(await authHeader()) },
  })
  if (!resp.ok && resp.status !== 404) {
    const txt = await resp.text()
    throw new Error(`Suppression image: HTTP ${resp.status} — ${txt.slice(0, 200)}`)
  }
}
```

- [ ] **Step 2 : Vérifier que le proxy accepte `graphql.json` en POST (preuve, terminal)**

Reproduire l'appel GraphQL hors-app (le proxy exige un Bearer admin ; en l'absence de session JWT côté terminal, vérifier au minimum que l'endpoint REST images est joignable via un produit réel en lecture). Vérification réelle complète = Step de la Task 3 dans l'app. Ici, valider la compilation :

Run: `cd apps/hub && ./node_modules/.bin/tsc --noEmit`
Expected: aucune erreur dans `shopifyProducts.ts`.

- [ ] **Step 3 : Commit**

```bash
git add apps/hub/src/lib/shopifyProducts.ts
git commit -m "feat(hub): lib Shopify produits (recherche GraphQL + push/delete image REST)"
```

### Task 3 : Picker produit par image dans Photos.tsx

**Files:**
- Modify: `apps/hub/src/components/Photos.tsx`

Contexte : l'interface image est `SubmissionImage` (`Photos.tsx:11-18`). L'input texte actuel est `Photos.tsx:741-745` (`<input className="img-product" ...>` + `setImageProduct`). Les soumissions sont chargées via un `.select('... hub_submission_images(...) ...')` (rechercher `hub_submission_images(` dans le fichier).

- [ ] **Step 1 : Étendre l'interface image + le select de chargement**

Dans l'interface `SubmissionImage`, ajouter après `product_worn` :
```typescript
  shopify_product_id: string | null
  shopify_product_handle: string | null
  shopify_product_title: string | null
  shopify_media_id: string | null
```
Dans le `.select(...)` qui charge `hub_submission_images(...)`, ajouter ces 4 colonnes à la liste des champs de l'embed (à côté de `id, ..., status, size, product_worn`).

- [ ] **Step 2 : Ajouter l'état + les handlers du picker (dans le composant `Photos`)**

Ajouter les imports en tête :
```typescript
import { searchShopifyProducts, pushImageToProduct, deleteProductImage, type ShopifyProductHit } from '../lib/shopifyProducts'
```
Ajouter l'état local (près des autres `useState`) :
```typescript
const [pickerImageId, setPickerImageId] = useState<string | null>(null)   // image dont le picker est ouvert
const [pickerTerm, setPickerTerm] = useState('')
const [pickerHits, setPickerHits] = useState<ShopifyProductHit[]>([])
const [pickerBusy, setPickerBusy] = useState(false)
const [pickerError, setPickerError] = useState<string | null>(null)
```
Recherche debouncée :
```typescript
useEffect(() => {
  if (!pickerImageId) return
  const t = setTimeout(async () => {
    try {
      setPickerError(null)
      setPickerHits(await searchShopifyProducts(pickerTerm))
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : String(e))
    }
  }, 300)
  return () => clearTimeout(t)
}, [pickerTerm, pickerImageId])
```
Relier (push + persistance) :
```typescript
const linkImageToProduct = async (subId: string, imageId: string, hit: ShopifyProductHit) => {
  const sub = submissions.find(s => s.id === subId)
  const img = sub?.hub_submission_images.find(i => i.id === imageId)
  if (!sub || !img) return
  setPickerBusy(true)
  setPickerError(null)
  try {
    const alt = sub.submitter_name || 'Communaute Runes de Chene'   // D6: nom de la personne
    const mediaId = await pushImageToProduct(hit.productId, img.image_url, alt)
    await supabase.rpc('set_submission_image_shopify_product', {
      p_image_id: imageId, p_product_id: hit.productId, p_handle: hit.handle, p_title: hit.title,
    })
    await supabase.rpc('set_submission_image_media', { p_image_id: imageId, p_media_id: mediaId })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({
      ...s,
      hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? {
        ...i, shopify_product_id: hit.productId, shopify_product_handle: hit.handle,
        shopify_product_title: hit.title, shopify_media_id: mediaId,
      } : i),
    })))
    setPickerImageId(null); setPickerTerm(''); setPickerHits([])
  } catch (e) {
    setPickerError(e instanceof Error ? e.message : String(e))
  } finally {
    setPickerBusy(false)
  }
}
```
Retirer (suppression Shopify + nettoyage) :
```typescript
const unlinkImageFromProduct = async (subId: string, imageId: string) => {
  const sub = submissions.find(s => s.id === subId)
  const img = sub?.hub_submission_images.find(i => i.id === imageId)
  if (!sub || !img || !img.shopify_product_id) return
  setPickerBusy(true)
  setPickerError(null)
  try {
    if (img.shopify_media_id) await deleteProductImage(img.shopify_product_id, img.shopify_media_id)
    await supabase.rpc('clear_submission_image_shopify_product', { p_image_id: imageId })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({
      ...s,
      hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? {
        ...i, shopify_product_id: null, shopify_product_handle: null, shopify_product_title: null, shopify_media_id: null,
      } : i),
    })))
  } catch (e) {
    setPickerError(e instanceof Error ? e.message : String(e))
  } finally {
    setPickerBusy(false)
  }
}
```

- [ ] **Step 3 : Remplacer l'input texte par l'UI picker**

Remplacer le bloc `<input className="img-product" placeholder="Produit porté (tag hub)" ... onBlur={setImageProduct} />` (`Photos.tsx:741-745`) par :
```tsx
{img.shopify_product_id ? (
  <div className="img-product-linked">
    <span title={`Relie a ${img.shopify_product_title}`}>🏷 {img.shopify_product_title}</span>
    <button type="button" className="img-product-unlink" disabled={pickerBusy}
      onClick={() => unlinkImageFromProduct(sub.id, img.id)}>Retirer ✕</button>
  </div>
) : pickerImageId === img.id ? (
  <div className="img-product-picker">
    <input autoFocus className="img-product" placeholder="Chercher un produit..."
      value={pickerTerm} onChange={e => setPickerTerm(e.target.value)} disabled={pickerBusy} />
    {pickerError && <div className="img-product-error">{pickerError}</div>}
    <ul className="img-product-results">
      {pickerHits.map(hit => (
        <li key={hit.productId}>
          <button type="button" disabled={pickerBusy} onClick={() => linkImageToProduct(sub.id, img.id, hit)}>
            {hit.imageUrl && <img src={hit.imageUrl} alt="" width={28} height={28} />}
            <span>{hit.title}</span>
          </button>
        </li>
      ))}
    </ul>
    <button type="button" className="img-product-cancel"
      onClick={() => { setPickerImageId(null); setPickerTerm(''); setPickerHits([]) }}>Annuler</button>
  </div>
) : (
  <button type="button" className="img-product-link-btn"
    onClick={() => { setPickerImageId(img.id); setPickerTerm(''); setPickerHits([]); setPickerError(null) }}>
    🔗 Relier à un produit
  </button>
)}
```

- [ ] **Step 4 : Supprimer le code mort `setImageProduct`**

Si `setImageProduct` (`Photos.tsx:182-191`) n'est plus référencé après le remplacement, le supprimer (règle hub « pas de code mort »). Garder `update_submission_product_worn`/`saveProductWorn` au niveau soumission (hors périmètre, inchangé).

- [ ] **Step 5 : Typecheck (preuve)**

Run: `cd apps/hub && ./node_modules/.bin/tsc --noEmit`
Expected: exit 0, aucune erreur.

- [ ] **Step 6 : Vérification fonctionnelle réelle (preuve, dans l'app)**

`pnpm --filter hub dev` (port 3001), page Photos. Sur une image approuvée : « Relier à un produit » → taper un nom → la liste Shopify apparaît → cliquer. Puis vérifier en base :
```sql
select shopify_product_id, shopify_product_handle, shopify_product_title, shopify_media_id
from public.hub_submission_images where shopify_product_id is not null limit 5;
```
Attendu : une ligne renseignée. Vérifier aussi dans l'admin Shopify que l'image apparaît dans la galerie du produit avec le `alt` = nom du contributeur. Puis « Retirer ✕ » → l'image disparaît de Shopify et les 4 colonnes repassent à null.

- [ ] **Step 7 : Commit**

```bash
git add apps/hub/src/components/Photos.tsx
git commit -m "feat(hub): picker produit Shopify par image + push/retrait galerie native"
```

### Task 4 : Sync-back à l'archivage d'une image

**Files:**
- Modify: `apps/hub/src/components/Photos.tsx`

Contexte : le changement de statut d'image passe par `set_submission_image_status` (recherche `set_submission_image_status` dans le fichier — handler qui archive/approuve une image).

- [ ] **Step 1 : Supprimer de Shopify quand on archive une image reliée**

Dans le handler qui appelle `set_submission_image_status`, avant (ou après succès de) la mise à jour, si la nouvelle valeur est `'archived'` et que l'image a un `shopify_product_id` + `shopify_media_id`, appeler le retrait :
```typescript
// si on archive une image deja poussee sur une fiche produit, la retirer de Shopify
if (newStatus === 'archived' && img.shopify_product_id) {
  await unlinkImageFromProduct(subId, imageId)
}
```
(`unlinkImageFromProduct` défini en Task 3 ; il gère le `DELETE` + `clear_submission_image_shopify_product` + l'état local.)

- [ ] **Step 2 : Typecheck (preuve)**

Run: `cd apps/hub && ./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Vérification réelle**

Dans l'app : relier une image à un produit, puis l'archiver → vérifier dans Shopify que l'image a disparu de la fiche, et en base que les colonnes `shopify_*` sont à null.

- [ ] **Step 4 : Commit**

```bash
git add apps/hub/src/components/Photos.tsx
git commit -m "feat(hub): archiver une photo la retire aussi de la fiche produit Shopify"
```

---

## Phase B — Flux lecture (mur « Le Mouvement » sur seo-pages)

### Task 5 : Data-layer du mur

**Files:**
- Create: `apps/seo-pages/src/lib/movement.ts`

Pattern de référence : `apps/seo-pages/src/lib/places.ts` (client service-key, requêtes paginées).

- [ ] **Step 1 : Écrire le data-layer**

```typescript
// apps/seo-pages/src/lib/movement.ts
import { supabase } from './supabase';

export interface WallPhoto {
  imageId: string;
  imageUrl: string;
  productHandle: string | null;
  productTitle: string | null;
  submitterName: string | null;
  submitterInstagram: string | null;
  message: string | null;
}

const PAGE_SIZE = 1000;

export async function getMovementWallPhotos(): Promise<WallPhoto[]> {
  const all: WallPhoto[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movement_wall_photos')
      .select('image_id, image_url, shopify_product_handle, shopify_product_title, submitter_name, submitter_instagram, message, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<Record<string, unknown>>) {
      all.push({
        imageId: r.image_id as string,
        imageUrl: r.image_url as string,
        productHandle: (r.shopify_product_handle as string | null) ?? null,
        productTitle: (r.shopify_product_title as string | null) ?? null,
        submitterName: (r.submitter_name as string | null) ?? null,
        submitterInstagram: (r.submitter_instagram as string | null) ?? null,
        message: (r.message as string | null) ?? null,
      });
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
```

- [ ] **Step 2 : Vérifier la lecture (preuve, terminal)**

Run:
```bash
cd apps/seo-pages && npx tsx -e "import('./src/lib/movement.ts').then(async m => { const p = await m.getMovementWallPhotos(); console.log('photos:', p.length, p[0]); })"
```
Expected: affiche un nombre de photos ≥ 0 et un objet `WallPhoto` (ou `undefined` si 0). Aucune erreur. (Nécessite `.env` seo-pages avec `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`.)

- [ ] **Step 3 : Commit**

```bash
git add apps/seo-pages/src/lib/movement.ts
git commit -m "feat(seo): data-layer du mur (lecture movement_wall_photos)"
```

### Task 6 : Template page « Le Mouvement »

**Files:**
- Create: `apps/seo-pages/src/templates/movement-page.ts`

Réutilise la charte (parchemin, Bebas/Cabin) ; pattern HTML/CSS inline et `escapeHtml` comme `apps/seo-pages/src/templates/gallery.ts:3-9`.

- [ ] **Step 1 : Écrire le template (HTML complet, manifeste + grille + lightbox)**

```typescript
// apps/seo-pages/src/templates/movement-page.ts
import type { WallPhoto } from '../lib/movement';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Copie de 1re intention (a affiner editorialement, ligne bonapartiste). Volontairement concrete, pas un placeholder.
const MANIFESTO_TITLE = 'Le Mouvement';
const MANIFESTO_LEAD = "Une marque, une carte, et celles et ceux qui partent a l'aventure.";
const MANIFESTO_BODY = "Runes de Chene n'est pas qu'une boutique : c'est une communaute en marche. Chaque piece portee devient une histoire, chaque lieu explore sur La Carte devient une conquete. Ce mur rassemble celles et ceux qui font vivre le Mouvement — leurs photos, leur terrain, leur style. Rejoins-les.";

function photoCard(p: WallPhoto): string {
  const credit = p.submitterInstagram
    ? `@${escapeHtml(p.submitterInstagram.replace(/^@/, ''))}`
    : (p.submitterName ? escapeHtml(p.submitterName) : '');
  const product = (p.productHandle && p.productTitle)
    ? `<a class="mv-card-product" href="https://runesdechene.com/products/${escapeHtml(p.productHandle)}">${escapeHtml(p.productTitle)}</a>`
    : '';
  return `<figure class="mv-card">
  <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.submitterName || 'Communaute Runes de Chene')}" loading="lazy" data-mv-img />
  <figcaption>${credit ? `<span class="mv-card-credit">${credit}</span>` : ''}${product}</figcaption>
</figure>`;
}

export function renderMovementPage(photos: WallPhoto[]): string {
  const grid = photos.map(photoCard).join('\n');
  const urls = JSON.stringify(photos.map(p => p.imageUrl));
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${MANIFESTO_TITLE} — Runes de Chêne</title>
<meta name="description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<link rel="canonical" href="https://app.runesdechene.com/mouvement" />
<meta property="og:title" content="${MANIFESTO_TITLE} — Runes de Chêne" />
<meta property="og:description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://app.runesdechene.com/mouvement" />
<link rel="preconnect" href="https://${(process.env.SUPABASE_URL || '').replace(/^https?:\/\//, '')}" />
<style>
  :root { --parchemin:#f7ede1; --encre:#4A3728; --accent:#833434; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--parchemin); color:var(--encre); font-family:'Cabin',system-ui,sans-serif; }
  .mv-hero { padding:18vh 24px 8vh; text-align:center; max-width:820px; margin:0 auto; }
  .mv-hero h1 { font-family:'Bebas Neue',Impact,sans-serif; font-size:clamp(48px,12vw,120px); margin:0 0 8px; letter-spacing:2px; }
  .mv-hero .lead { font-size:clamp(18px,3vw,26px); color:var(--accent); font-weight:600; margin:0 0 18px; }
  .mv-hero p { font-size:18px; line-height:1.6; }
  .mv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:6px; padding:24px; }
  .mv-card { margin:0; position:relative; overflow:hidden; border-radius:4px; background:#E8D5BE; }
  .mv-card img { width:100%; height:100%; aspect-ratio:3/4; object-fit:cover; display:block; cursor:pointer; }
  .mv-card figcaption { position:absolute; left:0; right:0; bottom:0; padding:8px 10px; display:flex; justify-content:space-between; gap:8px; font-size:12px; color:#fff; background:linear-gradient(transparent,rgba(0,0,0,.7)); }
  .mv-card-product { color:#fff; text-decoration:underline; }
  .mv-empty { text-align:center; padding:8vh 24px; color:#7D5A3C; }
  .mv-cta { display:block; text-align:center; padding:6vh 24px 10vh; }
  .mv-cta a { display:inline-block; background:var(--accent); color:#fff; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:700; }
  .mv-lightbox { position:fixed; inset:0; background:rgba(0,0,0,.9); display:none; align-items:center; justify-content:center; z-index:99; }
  .mv-lightbox.open { display:flex; }
  .mv-lightbox img { max-width:92vw; max-height:88vh; }
</style>
</head>
<body>
<section class="mv-hero">
  <h1>${MANIFESTO_TITLE}</h1>
  <p class="lead">${escapeHtml(MANIFESTO_LEAD)}</p>
  <p>${escapeHtml(MANIFESTO_BODY)}</p>
</section>
${photos.length > 0
  ? `<section class="mv-grid" data-mv-grid>\n${grid}\n</section>`
  : `<div class="mv-empty">Les premieres photos du Mouvement arrivent bientot.</div>`}
<div class="mv-cta"><a href="https://app.runesdechene.com">Rejoindre La Carte</a></div>
<div class="mv-lightbox" data-mv-lightbox><img src="" alt="" data-mv-lightbox-img /></div>
<script>
(function(){
  var urls = ${urls};
  var lb = document.querySelector('[data-mv-lightbox]');
  var lbImg = lb && lb.querySelector('[data-mv-lightbox-img]');
  document.querySelectorAll('[data-mv-img]').forEach(function(img, i){
    img.addEventListener('click', function(){ if(lbImg){ lbImg.src = urls[i]; lb.classList.add('open'); } });
  });
  if (lb) lb.addEventListener('click', function(){ lb.classList.remove('open'); });
})();
</script>
</body>
</html>`;
}
```

- [ ] **Step 2 : Typecheck (preuve)**

Run: `cd apps/seo-pages && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add apps/seo-pages/src/templates/movement-page.ts
git commit -m "feat(seo): template page manifeste + mur Le Mouvement"
```

### Task 7 : Générer `/mouvement` dans le build

**Files:**
- Modify: `apps/seo-pages/src/build.ts`

- [ ] **Step 1 : Brancher la génération de la page**

Ajouter les imports en tête (à côté des imports existants) :
```typescript
import { getMovementWallPhotos } from './lib/movement';
import { renderMovementPage } from './templates/movement-page';
```
Après l'écriture du sitemap (`apps/seo-pages/src/build.ts:57`, après `writeFile(join(DIST, 'sitemap.xml'), ...)`), ajouter :
```typescript
  // Page Le Mouvement (manifeste + mur UGC)
  const wallPhotos = await getMovementWallPhotos();
  await mkdir(join(DIST, 'mouvement'), { recursive: true });
  await writeFile(join(DIST, 'mouvement', 'index.html'), renderMovementPage(wallPhotos), 'utf-8');
  console.log(`Mouvement: ${wallPhotos.length} photos`);
```

- [ ] **Step 2 : Build complet (preuve)**

Run: `cd apps/seo-pages && pnpm build`
Expected: log `Mouvement: N photos` ; fichier `apps/seo-pages/dist/mouvement/index.html` créé.

- [ ] **Step 3 : Inspecter le HTML généré (preuve)**

Run: `cd apps/seo-pages && node -e "const h=require('fs').readFileSync('dist/mouvement/index.html','utf8'); console.log('title ok:', h.includes('<title>Le Mouvement'), '| cards:', (h.match(/mv-card/g)||[]).length)"`
Expected: `title ok: true` et un nombre de `mv-card` cohérent avec le nombre de photos.

- [ ] **Step 4 : Commit**

```bash
git add apps/seo-pages/src/build.ts
git commit -m "feat(seo): generer dist/mouvement/index.html au build"
```

### Task 8 : Rewrite Netlify `/mouvement`

**Files:**
- Modify: `apps/explore-web/netlify.toml`

- [ ] **Step 1 : Ajouter la règle (AVANT le fallback SPA `/*`)**

Insérer, juste avant le bloc `[[redirects]] from = "/*" to = "/index.html"` (`apps/explore-web/netlify.toml:27-30`) :
```toml
[[redirects]]
  from = "/mouvement"
  to = "https://rdc-seo-pages.netlify.app/mouvement"
  status = 200
  force = true
```

- [ ] **Step 2 : Vérifier l'ordre (preuve)**

Relire le fichier : la règle `/mouvement` doit précéder `/*`. (Netlify applique la première règle qui matche ; `/*` capturerait sinon `/mouvement`.)

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/netlify.toml
git commit -m "feat(explore-web): rewrite /mouvement vers le site seo-pages"
```

### Task 9 : Déploiement + redirection Shopify (manuel, vérifié)

**Files:** aucun (opérations de déploiement et configuration Shopify).

- [ ] **Step 1 : Déployer seo-pages**

```bash
cd apps/seo-pages && pnpm build && netlify deploy --prod --dir "$PWD/dist" --no-build
```
Vérifier : `https://rdc-seo-pages.netlify.app/mouvement` renvoie la page.

- [ ] **Step 2 : Déployer explore-web (pour activer le rewrite)**

```bash
cd apps/explore-web && pnpm build && netlify deploy --prod --dir "$PWD/dist" --no-build
```
Vérifier (preuve) : `curl -s -o /dev/null -w "%{http_code}\n" https://app.runesdechene.com/mouvement` → `200`, et la page affiche le manifeste + le mur.

- [ ] **Step 3 : Redirection Shopify + lien d'entrée (admin Shopify, manuel)**

Dans l'admin Shopify → Boutique en ligne → Navigation → Redirections d'URL : créer `301 /pages/ils-nous-portent → https://app.runesdechene.com/mouvement`. Ajouter un lien « Le Mouvement » dans le menu/section adéquate vers `https://app.runesdechene.com/mouvement`.
Vérifier : visiter l'ancienne URL redirige bien (301) vers la nouvelle.

- [ ] **Step 4 : Commit (note de complétion)**

Aucun fichier ; consigner l'état dans `apps/hub/CLAUDE.md` / `apps/seo-pages/CLAUDE.md` (section Brique 2) si souhaité, en commit séparé.

---

## Self-review (rempli à la rédaction)

**1. Couverture du spec :**
- D1 modèle 2 étages → vue `movement_wall_photos` (mur, toutes approuvées) + lien produit par image (fiches, curaté) : Tasks 1, 3, 5. ✓
- D2 push galerie native → Task 2 (`pushImageToProduct` REST) + Task 3. ✓
- D3 réversibilité via `shopify_media_id` → Task 1 (colonne + RPCs), Task 3 (Retirer), Task 4 (archivage). ✓
- D4 deux boutons explicites Relier/Retirer → Task 3 Step 3. ✓
- D5 picker (id/handle/title, pas de champ libre) → Tasks 1, 2, 3. ✓
- D6 `alt` = nom du contributeur → Task 3 (`alt = sub.submitter_name`), Task 6 (alt du mur). ✓
- D7 mur dans seo-pages `/mouvement` → Tasks 5-8. ✓
- D8 pas de RPC publique anon, vue lue au build → Task 1 (vue) + Task 5 (service key). ✓
- D9 fraîcheur nightly → réutilise le cron existant seo-pages (aucune tâche dédiée nécessaire). ✓
- D10 manifeste + 301 → Task 6 (manifeste) + Task 9 (301). ✓

**2. Placeholders :** copie du manifeste = texte de 1re intention concret (pas un TODO), explicitement à affiner. Aucun « TBD ».

**3. Cohérence des types :** `ShopifyProductHit` (Task 2) consommé tel quel en Task 3 ; `WallPhoto` (Task 5) consommé en Task 6 ; noms de colonnes/RPC alignés sur la migration Task 1.

**Note de découpage :** deux flux quasi indépendants (A : hub/écriture ; B : seo-pages/lecture) partageant la migration Task 1. Exécutables et déployables séparément après la Phase 0.
