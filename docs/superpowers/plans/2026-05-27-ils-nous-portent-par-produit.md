# Bloc « Ils nous portent » par produit — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sous chaque fiche produit Shopify les photos communautaires « Communauté » de ce produit, chacune avec l'avis (message + 2 notes /5) hérité de son batch de soumission.

**Architecture:** Le Hub (Supabase) gagne 3 champs avis au niveau soumission + un flag `show_in_community` par photo, avec deux destinations indépendantes à la curation (« Photo produit » = push galerie, « Communauté » = bloc fiche). Une section Shopify calquée sur `community-photos.liquid` fetch un nouveau RPC anon par `product.handle` et rend le bloc. Spec de référence : `docs/superpowers/specs/2026-05-27-ils-nous-portent-par-produit-design.md`.

**Tech Stack:** PostgreSQL (Supabase migrations), React 18 + TypeScript (Hub, Vite, **pas de framework de test JS**), Liquid (thème Shopify Crépuscule). Vérifications : SQL via Supabase MCP, Hub via `pnpm dev` + observation, Liquid via thème d'aperçu Shopify.

**Note de conception (décision actée) :** on **découple** « relier à un produit » (association seule) de « Photo produit » (push galerie). Le comportement actuel pousse en galerie dès le lien ; après ce plan, relier n'associe que le produit, puis deux interrupteurs indépendants gèrent les destinations. Cela permet « Communauté sans galerie ».

---

## File Structure

**Repo `app (Runes de Chêne)` :**
- Create: `supabase/migrations/180_ugc_community_block.sql` — colonnes avis + flag + RPC.
- Modify: `apps/hub/src/components/StudioSubmit.tsx` — 2 notes + champ privé + relabel message + params RPC.
- Modify: `apps/hub/src/components/StudioSubmit.css` — styles étoiles (réutilise pattern existant).
- Modify: `apps/hub/src/components/photos/types.ts` — champs sur `SubmissionImage` + `PhotoSubmission`.
- Modify: `apps/hub/src/components/Photos.tsx` — découplage lien/push + handlers community.
- Modify: `apps/hub/src/components/photos/ImageCurator.tsx` — 2 interrupteurs destination.
- Modify: `apps/hub/src/components/photos/SubmissionDetail.tsx` — affichage notes + `team_note` privé + passage props.

**Repo `shopify (Runes de Chêne)` :**
- Create: `sections/rdc_ils-nous-portent-produit.liquid` — section bloc fiche produit.
- Modify: `templates/product.json` — ajout de la section sous le produit.

---

## Task 1 : Migration SQL (colonnes avis, flag, RPC)

**Files:**
- Create: `app (Runes de Chêne)/supabase/migrations/180_ugc_community_block.sql`

> Pas de test unitaire SQL : vérification via Supabase MCP (`execute_sql`) après application. La migration suit le style des mig 176/177/178 (drop+recreate des RPC avec DEFAULT pour rester rétro-compatible).

- [ ] **Step 1 : Écrire la migration**

Contenu complet du fichier :

```sql
-- 180_ugc_community_block.sql
-- Bloc "Ils nous portent" par produit : avis au niveau soumission (message public deja present
-- + 2 notes /5 + mot prive equipe) et flag d'affichage Communaute par photo.

-- 1. Avis au niveau batch (soumission)
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS rating_experience int,
  ADD COLUMN IF NOT EXISTS rating_products   int,
  ADD COLUMN IF NOT EXISTS team_note         text;  -- PRIVE : jamais expose publiquement

ALTER TABLE public.hub_photo_submissions DROP CONSTRAINT IF EXISTS hub_photo_submissions_rating_experience_check;
ALTER TABLE public.hub_photo_submissions DROP CONSTRAINT IF EXISTS hub_photo_submissions_rating_products_check;
ALTER TABLE public.hub_photo_submissions
  ADD CONSTRAINT hub_photo_submissions_rating_experience_check CHECK (rating_experience IS NULL OR (rating_experience BETWEEN 1 AND 5)),
  ADD CONSTRAINT hub_photo_submissions_rating_products_check   CHECK (rating_products   IS NULL OR (rating_products   BETWEEN 1 AND 5));

comment on column public.hub_photo_submissions.team_note is
  'PRIVE - mot pour l equipe, ne jamais exposer via RPC anon ni vers Shopify';

-- 2. Destination Communaute par photo
ALTER TABLE public.hub_submission_images
  ADD COLUMN IF NOT EXISTS show_in_community boolean NOT NULL DEFAULT false;

-- 3. create_photo_submission : + 3 params avis (drop ancienne signature puis recree avec DEFAULT)
DROP FUNCTION IF EXISTS public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id character varying, p_submitter_name text, p_submitter_email text, p_submitter_instagram text,
  p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL, p_message text DEFAULT NULL,
  p_consent_brand boolean DEFAULT false, p_consent_account boolean DEFAULT false, p_submitter_role text DEFAULT 'client',
  p_product_size text DEFAULT NULL, p_model_height_cm numeric DEFAULT NULL, p_model_shoulder_width_cm numeric DEFAULT NULL,
  p_departement text DEFAULT NULL, p_quest_ref text DEFAULT NULL,
  p_rating_experience int DEFAULT NULL, p_rating_products int DEFAULT NULL, p_team_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm,
    departement, quest_ref,
    rating_experience, rating_products, team_note
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), ''),
    p_rating_experience, p_rating_products, NULLIF(btrim(p_team_note), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text, int, int, text) TO anon, authenticated, service_role;

-- 4. Toggle destination Communaute (curation Hub)
CREATE OR REPLACE FUNCTION public.set_submission_image_community(p_image_id uuid, p_show boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images SET show_in_community = COALESCE(p_show, false) WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_community(uuid, boolean) TO anon, authenticated, service_role;

-- 5. clear_submission_image_shopify_product : reset AUSSI show_in_community (delier = sortir du bloc)
CREATE OR REPLACE FUNCTION public.clear_submission_image_shopify_product(p_image_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images
     SET shopify_product_id     = null,
         shopify_product_handle = null,
         shopify_product_title  = null,
         shopify_media_id       = null,
         show_in_community      = false
   WHERE id = p_image_id;
END; $$;

-- 6. Lecture publique (anon) du bloc par produit. N'EXPOSE PAS team_note ni email.
CREATE OR REPLACE FUNCTION public.get_community_photos_by_product(p_handle text)
RETURNS TABLE (
  submission_id uuid,
  image_url text,
  image_sort_order int,
  submitter_name text,
  submitter_instagram text,
  location_name text,
  location_zip text,
  message text,
  rating_experience int,
  rating_products int,
  created_at timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id, i.image_url, i.sort_order,
    s.submitter_name, s.submitter_instagram, s.location_name, s.location_zip,
    s.message, s.rating_experience, s.rating_products, s.created_at
  FROM public.hub_submission_images i
  JOIN public.hub_photo_submissions s ON s.id = i.submission_id
  WHERE i.show_in_community = true
    AND i.status = 'approved'
    AND s.status = 'approved'
    AND s.consent_brand_usage = true
    AND i.shopify_product_handle = NULLIF(btrim(p_handle), '')
  ORDER BY s.created_at DESC, i.sort_order ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_community_photos_by_product(text) TO anon, authenticated, service_role;
```

- [ ] **Step 2 : Appliquer la migration**

Appliquer via Supabase MCP `apply_migration` (name: `ugc_community_block`, query = contenu ci-dessus) OU via CLI locale selon le workflow `docs/db/migrations-workflow.md`.

- [ ] **Step 3 : Vérifier le schéma (Supabase MCP `execute_sql`)**

```sql
select column_name from information_schema.columns
where table_name='hub_photo_submissions' and column_name in ('rating_experience','rating_products','team_note');
select column_name from information_schema.columns
where table_name='hub_submission_images' and column_name='show_in_community';
```
Attendu : 3 lignes pour la 1re, 1 ligne pour la 2e.

- [ ] **Step 4 : Vérifier que le RPC public n'expose pas team_note**

```sql
select * from public.get_community_photos_by_product('un-handle-inexistant');
```
Attendu : 0 ligne, et la liste des colonnes retournées ne contient PAS `team_note` ni `submitter_email`.

- [ ] **Step 5 : Commit**

```bash
cd "app (Runes de Chêne)"
git add supabase/migrations/180_ugc_community_block.sql
git commit -m "feat(ugc): migration bloc Communaute par produit (notes avis + show_in_community + RPC)"
```

---

## Task 2 : Formulaire de soumission Hub (2 notes + mot privé + relabel)

**Files:**
- Modify: `app (Runes de Chêne)/apps/hub/src/components/StudioSubmit.tsx`
- Modify: `app (Runes de Chêne)/apps/hub/src/components/StudioSubmit.css`

> Vérification manuelle (pas de test JS) : `pnpm --filter hub dev`, parcourir le wizard, soumettre, vérifier en base via Supabase MCP.

- [ ] **Step 1 : Ajouter le state des nouveaux champs**

Dans `StudioSubmit.tsx`, après la ligne `const [message, setMessage] = useState('')` (~ligne 74), ajouter :

```tsx
  const [ratingExperience, setRatingExperience] = useState(0)
  const [ratingProducts, setRatingProducts] = useState(0)
  const [hoverExp, setHoverExp] = useState(0)
  const [hoverProd, setHoverProd] = useState(0)
  const [teamNote, setTeamNote] = useState('')
```

- [ ] **Step 2 : Passer les nouveaux params au RPC**

Dans l'appel `supabase.rpc('create_photo_submission', {...})` (~ligne 140), ajouter après `p_model_height_cm: parsedHeightCm,` :

```tsx
        p_rating_experience: ratingExperience || null,
        p_rating_products: ratingProducts || null,
        p_team_note: teamNote.trim() || null,
```

- [ ] **Step 3 : Étape 3 du wizard — relabel message + 2 notes + mot privé**

Remplacer le bloc de l'étape 3 (le `<label>Un mot sur ton shooting (optionnel)</label>` + textarea, ~lignes 294-296) par :

```tsx
              <label className="studio__label">Ton avis public (marque, expérience…) (optionnel)</label>
              <textarea className="studio__field" rows={4} maxLength={MAX_MESSAGE} value={message}
                onChange={(e) => setMessage(e.target.value)} placeholder="Ce que tu veux partager publiquement sur Runes de Chêne…" />

              <label className="studio__label">Comment fut votre expérience Runes de Chêne ?</label>
              <div className="studio__stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button"
                    className={`studio__star ${star <= (hoverExp || ratingExperience) ? 'on' : ''}`}
                    onClick={() => setRatingExperience(star === ratingExperience ? 0 : star)}
                    onMouseEnter={() => setHoverExp(star)} onMouseLeave={() => setHoverExp(0)}>★</button>
                ))}
              </div>

              <label className="studio__label">Comment appréciez-vous vos produits ?</label>
              <div className="studio__stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button"
                    className={`studio__star ${star <= (hoverProd || ratingProducts) ? 'on' : ''}`}
                    onClick={() => setRatingProducts(star === ratingProducts ? 0 : star)}
                    onMouseEnter={() => setHoverProd(star)} onMouseLeave={() => setHoverProd(0)}>★</button>
                ))}
              </div>

              <label className="studio__label">Un mot pour l'équipe ? <span style={{ opacity: .6 }}>(privé — ne sera jamais publié)</span></label>
              <textarea className="studio__field" rows={3} maxLength={MAX_MESSAGE} value={teamNote}
                onChange={(e) => setTeamNote(e.target.value)} placeholder="Message privé à l'équipe Runes de Chêne…" />
```

- [ ] **Step 4 : Styles étoiles**

Dans `StudioSubmit.css`, ajouter à la fin :

```css
.studio__stars { display: flex; gap: .25rem; margin: .15rem 0 .6rem; }
.studio__star { background: none; border: none; cursor: pointer; font-size: 1.8rem; line-height: 1; color: #c9c2b4; transition: color .12s; padding: 0; }
.studio__star.on { color: #e0a73d; }
```

- [ ] **Step 5 : Vérifier manuellement**

Run : `pnpm --filter hub dev`, ouvrir `/soumettre-contenu`, aller à l'étape 3, remplir avis + 2 notes + mot privé, finir le wizard et soumettre une photo de test. Puis Supabase MCP :
```sql
select message, rating_experience, rating_products, team_note from hub_photo_submissions order by created_at desc limit 1;
```
Attendu : les 4 valeurs saisies présentes.

- [ ] **Step 6 : Commit**

```bash
cd "app (Runes de Chêne)"
git add apps/hub/src/components/StudioSubmit.tsx apps/hub/src/components/StudioSubmit.css
git commit -m "feat(hub): notes experience/produits + mot prive equipe au formulaire de soumission"
```

---

## Task 3 : Types Hub (champs avis + flag)

**Files:**
- Modify: `app (Runes de Chêne)/apps/hub/src/components/photos/types.ts`

- [ ] **Step 1 : Ajouter `show_in_community` à `SubmissionImage`**

Dans l'interface `SubmissionImage`, après `shopify_media_id: string | null` :

```ts
  show_in_community: boolean
```

- [ ] **Step 2 : Ajouter les champs avis à `PhotoSubmission`**

Dans l'interface `PhotoSubmission`, après `reward_crowns: number | null` :

```ts
  rating_experience: number | null
  rating_products: number | null
  team_note: string | null
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

Run : `pnpm --filter hub build` (ou `tsc --noEmit` dans `apps/hub`). Attendu : pas d'erreur de type liée à ces champs (les getters `get_photo_submissions`/`get_submission_images_batch` renvoient déjà ces colonnes via `SETOF` table).

- [ ] **Step 4 : Commit**

```bash
cd "app (Runes de Chêne)"
git add apps/hub/src/components/photos/types.ts
git commit -m "feat(hub): types show_in_community + notes avis sur les soumissions"
```

---

## Task 4 : Curation Hub (découplage lien/push + interrupteurs destinations + affichage avis)

**Files:**
- Modify: `app (Runes de Chêne)/apps/hub/src/components/Photos.tsx`
- Modify: `app (Runes de Chêne)/apps/hub/src/components/photos/ImageCurator.tsx`
- Modify: `app (Runes de Chêne)/apps/hub/src/components/photos/SubmissionDetail.tsx`

> Découplage : `linkImage` n'associe plus que le produit (plus de push auto). Deux interrupteurs : « Photo produit » (push/retire galerie) et « Communauté » (flag).

- [ ] **Step 1 : `Photos.tsx` — découpler `linkImage` (association seule)**

Remplacer le corps de `linkImage` (~lignes 333-347) par :

```tsx
  const linkImage = async (subId: string, imageId: string, hit: ShopifyProductHit) => {
    await supabase.rpc('set_submission_image_shopify_product', { p_image_id: imageId, p_product_id: hit.productId, p_handle: hit.handle, p_title: hit.title })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_product_id: hit.productId, shopify_product_handle: hit.handle, shopify_product_title: hit.title } : i) }) ))
  }
```

- [ ] **Step 2 : `Photos.tsx` — ajouter `setPhotoProduit` (push/retire galerie)**

Juste après `linkImage`, ajouter :

```tsx
  const setPhotoProduit = async (subId: string, imageId: string, on: boolean) => {
    const sub = submissions.find(s => s.id === subId)
    const img = sub?.hub_submission_images.find(i => i.id === imageId)
    if (!sub || !img || !img.shopify_product_id) return
    if (on) {
      const alt = buildImageAlt(sub.submitter_name, sub.model_height_cm, img.size)
      const mediaId = await pushImageToProduct(img.shopify_product_id, img.image_url, alt)
      await supabase.rpc('set_submission_image_media', { p_image_id: imageId, p_media_id: mediaId })
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_media_id: mediaId } : i) }) ))
    } else {
      if (img.shopify_media_id) await deleteProductImage(img.shopify_product_id, img.shopify_media_id)
      await supabase.rpc('set_submission_image_media', { p_image_id: imageId, p_media_id: '' })
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_media_id: null } : i) }) ))
    }
  }
```

- [ ] **Step 3 : `Photos.tsx` — ajouter `setImageCommunity`**

Après `setPhotoProduit`, ajouter :

```tsx
  const setImageCommunity = async (subId: string, imageId: string, on: boolean) => {
    await supabase.rpc('set_submission_image_community', { p_image_id: imageId, p_show: on })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, show_in_community: on } : i) }) ))
  }
```

- [ ] **Step 4 : `Photos.tsx` — `unlinkImage` reset community en state**

Dans `unlinkImage` (~ligne 355), remplacer la mise à jour de state finale par (ajout de `show_in_community: false`) :

```tsx
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_product_id: null, shopify_product_handle: null, shopify_product_title: null, shopify_media_id: null, show_in_community: false } : i) }) ))
```

- [ ] **Step 5 : `Photos.tsx` — passer les nouvelles props à `SubmissionDetail`**

Dans le JSX `<SubmissionDetail ... />` (~ligne 398), ajouter ces props après `onUnlinkImage` :

```tsx
              onSetPhotoProduit={(imageId, on) => setPhotoProduit(selected.id, imageId, on)}
              onSetCommunity={(imageId, on) => setImageCommunity(selected.id, imageId, on)}
```

- [ ] **Step 6 : `SubmissionDetail.tsx` — props + affichage avis/team_note**

Dans `SubmissionDetailProps`, après `onUnlinkImage: (imageId: string) => Promise<void>` :

```tsx
  onSetPhotoProduit: (imageId: string, on: boolean) => Promise<void>
  onSetCommunity: (imageId: string, on: boolean) => Promise<void>
```

Dans le `<ImageCurator ... />` (~ligne 83-91), ajouter après `onUnlink` :

```tsx
          onSetPhotoProduit={(on) => props.onSetPhotoProduit(active.id, on)}
          onSetCommunity={(on) => props.onSetCommunity(active.id, on)}
```

Dans la zone `mod-detail__contact` (après la ligne `created_at`, ~ligne 56), ajouter l'affichage des notes :

```tsx
            {sub.rating_experience && <span>Expérience : {'★'.repeat(sub.rating_experience)}{'☆'.repeat(5 - sub.rating_experience)}</span>}
            {sub.rating_products && <span>Produits : {'★'.repeat(sub.rating_products)}{'☆'.repeat(5 - sub.rating_products)}</span>}
```

Après le bloc message (`</p>` de `mod-detail__msg`, ~ligne 114), ajouter le mot privé :

```tsx
      {sub.team_note && (
        <p className="mod-detail__msg" style={{ borderLeft: '3px solid #e0a73d', paddingLeft: '.6rem', fontStyle: 'italic' }} title="Privé — non publié">
          🔒 {sub.team_note}
        </p>
      )}
```

- [ ] **Step 7 : `ImageCurator.tsx` — interrupteurs « Photo produit » + « Communauté »**

Dans `ImageCuratorProps`, après `onUnlink: () => Promise<void>` :

```tsx
  onSetPhotoProduit: (on: boolean) => Promise<void>
  onSetCommunity: (on: boolean) => Promise<void>
```

Mettre à jour la déstructuration (~ligne 18) : `onUnlink, onDownload` → `onUnlink, onSetPhotoProduit, onSetCommunity, onDownload`.

Remplacer le bloc `image.shopify_product_id ? ( ... )` (~lignes 61-65, la partie « linked ») par :

```tsx
        {image.shopify_product_id ? (
          <div className="mod-curator__linked">
            <span title={`Relié à ${image.shopify_product_title}`}>🏷 {image.shopify_product_title}</span>
            <div className="mod-curator__dest">
              <label className="mod-curator__toggle">
                <input type="checkbox" checked={image.shopify_media_id != null} disabled={busy}
                  onChange={async e => { setBusy(true); setError(null); try { await onSetPhotoProduit(e.target.checked) } catch (er) { setError(er instanceof Error ? er.message : String(er)) } finally { setBusy(false) } }} />
                Photo produit (galerie)
              </label>
              <label className="mod-curator__toggle">
                <input type="checkbox" checked={image.show_in_community} disabled={busy}
                  onChange={async e => { setBusy(true); setError(null); try { await onSetCommunity(e.target.checked) } catch (er) { setError(er instanceof Error ? er.message : String(er)) } finally { setBusy(false) } }} />
                Communauté (bloc fiche)
              </label>
            </div>
            <button className="mod-curator__unlink" disabled={busy} onClick={doUnlink}>Retirer ✕</button>
          </div>
        ) : open ? (
```

- [ ] **Step 8 : Vérifier compilation + comportement**

Run : `pnpm --filter hub build`. Attendu : aucune erreur de type.
Run : `pnpm --filter hub dev`, page Photos → une soumission approuvée → relier une photo à un produit (n'auto-pousse plus en galerie), cocher « Photo produit » (vérifie l'image apparaît dans la galerie Shopify du produit), cocher « Communauté ». Vérifier en base :
```sql
select shopify_product_handle, shopify_media_id, show_in_community from hub_submission_images where id = '<image_id>';
```
Attendu : handle renseigné ; `shopify_media_id` non-null si « Photo produit » coché ; `show_in_community` = true si « Communauté » coché.

- [ ] **Step 9 : Commit**

```bash
cd "app (Runes de Chêne)"
git add apps/hub/src/components/Photos.tsx apps/hub/src/components/photos/ImageCurator.tsx apps/hub/src/components/photos/SubmissionDetail.tsx
git commit -m "feat(hub): decouple lien/push galerie + interrupteurs Photo produit / Communaute + affichage avis"
```

---

## Task 5 : Section Shopify `rdc_ils-nous-portent-produit.liquid`

**Files:**
- Create: `shopify (Runes de Chêne)/sections/rdc_ils-nous-portent-produit.liquid`

> Pas de test Liquid local : vérification sur thème d'aperçu Shopify. On part de `sections/community-photos.liquid` (déjà en prod) qu'on clone et adapte. DRY : réutiliser tout le CSS/markup grid+carrousel+lightbox.

- [ ] **Step 1 : Créer le fichier à partir de `community-photos.liquid`**

Copier intégralement `sections/community-photos.liquid` vers `sections/rdc_ils-nous-portent-produit.liquid`, puis appliquer les changements ci-dessous (Steps 2-6). Toutes les classes CSS `community-photos*` sont conservées telles quelles (réutilisation directe du style existant).

- [ ] **Step 2 : Paramètres JS — handle produit au lieu du tag**

Dans le `<script>`, remplacer les déclarations de variables (les lignes `var TAG_NAME = ...`) par le handle du produit courant :

```js
    var SUPABASE_URL = {{ section.settings.supabase_url | json }};
    var SUPABASE_KEY = {{ section.settings.supabase_anon_key | json }};
    var PRODUCT_HANDLE = {{ product.handle | json }};
    var SECTION_ID = {{ section.id | json }};
```

- [ ] **Step 3 : Garde de configuration**

Remplacer la condition `if (!SUPABASE_URL || !SUPABASE_KEY || !TAG_NAME) {` par :

```js
    if (!SUPABASE_URL || !SUPABASE_KEY || !PRODUCT_HANDLE) {
```

- [ ] **Step 4 : Appel RPC par produit**

Remplacer l'appel `fetch(SUPABASE_URL + '/rest/v1/rpc/get_approved_photos_by_tag', {...})` et son body par :

```js
    fetch(SUPABASE_URL + '/rest/v1/rpc/get_community_photos_by_product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      body: JSON.stringify({ p_handle: PRODUCT_HANDLE })
    })
```

- [ ] **Step 5 : Mapping des lignes (groupement par soumission + notes)**

Remplacer le bloc `data.forEach(function(row) { ... })` (groupement par submission) par celui-ci, qui groupe sur `submission_id` et capte les 2 notes :

```js
      var submissions = {};
      data.forEach(function(row) {
        if (!submissions[row.submission_id]) {
          submissions[row.submission_id] = {
            id: row.submission_id,
            name: row.submitter_name,
            instagram: row.submitter_instagram,
            location: row.location_name || '',
            location_zip: row.location_zip || '',
            message: row.message,
            rating_experience: row.rating_experience || 0,
            rating_products: row.rating_products || 0,
            created_at: row.created_at,
            images: []
          };
        }
        if (row.image_url) {
          submissions[row.submission_id].images.push({
            url: row.image_url,
            order: row.image_sort_order || 0
          });
        }
      });
```

- [ ] **Step 6 : Affichage des notes dans l'overlay**

Dans la construction de l'overlay (`html += '<div class="community-photos__overlay">';`), retirer le bloc `sub.product_worn` (inexistant ici) et ajouter, juste après le bloc `location`, l'affichage des étoiles :

```js
        function stars(n) { return n > 0 ? ('★'.repeat(n) + '☆'.repeat(5 - n)) : ''; }
        if (sub.rating_experience) {
          html += '<span class="community-photos__location">Expérience : ' + stars(sub.rating_experience) + '</span>';
        }
        if (sub.rating_products) {
          html += '<span class="community-photos__location">Produits : ' + stars(sub.rating_products) + '</span>';
        }
```

(La fonction `stars` doit être déclarée une seule fois en haut du `.forEach(function(sub){...})` — la placer avant le premier usage dans la boucle.) Supprimer aussi le listener `gridEl.addEventListener('click', ...)` lié à `community-photos__product` (le bouton produit n'existe plus ici).

- [ ] **Step 7 : Schéma — retirer `tag_name`, ajuster libellés**

Dans le `{% schema %}`, retirer le réglage `tag_name`. Mettre `"name": "RDC — Ils nous portent (produit)"`, titre par défaut « Ils nous portent », sous-titre « Ils portent ce produit ». Conserver `supabase_url`, `supabase_anon_key`, `columns_desktop`, `section_width`. Garder un `presets` avec le même `name`.

- [ ] **Step 8 : Vérifier sur thème d'aperçu**

Push sur un thème d'aperçu non publié :
```bash
cd "shopify (Runes de Chêne)"
shopify theme push --unpublished --theme="XO-apercu-inp" --store=runes-de-chene.myshopify.com
```
(La section n'apparaît pas encore tant que non ajoutée à un template — Task 6. Ce step vérifie surtout l'absence d'erreur de syntaxe Liquid au push.)

- [ ] **Step 9 : Commit**

```bash
cd "shopify (Runes de Chêne)"
git add sections/rdc_ils-nous-portent-produit.liquid
git commit -m "feat(galerie-produit): section Ils nous portent par produit (fetch RPC communaute)"
```

---

## Task 6 : Intégration au template produit + déploiement

**Files:**
- Modify: `shopify (Runes de Chêne)/templates/product.json`

- [ ] **Step 1 : Ajouter la section au template produit**

Dans `templates/product.json`, ajouter une entrée de section `rdc_ils-nous-portent-produit` dans `sections` avec ses settings (`supabase_url` = `https://ukpapqssgsxirsgmcvof.supabase.co`, `supabase_anon_key` = la clé anon utilisée par `community-photos` dans `templates/page.ils-nous-portent.json`), et l'ajouter dans `order` **après** la section produit principale (pour qu'elle s'affiche sous le produit). Exemple d'entrée :

```json
    "rdc_inp": {
      "type": "rdc_ils-nous-portent-produit",
      "settings": {
        "section_width": "page-width",
        "columns_desktop": 4,
        "title": "Ils nous portent",
        "subtitle": "Ils portent ce produit",
        "supabase_url": "https://ukpapqssgsxirsgmcvof.supabase.co",
        "supabase_anon_key": "<copier la cle anon depuis templates/page.ils-nous-portent.json>"
      }
    }
```
Puis ajouter `"rdc_inp"` à la fin du tableau `order`.

> Préférable : ajouter la section via l'éditeur de thème Shopify sur l'aperçu (drag sous le produit) plutôt qu'éditer le JSON à la main, pour respecter le format auto-généré. Si édité à la main, valider que le JSON reste valide.

- [ ] **Step 2 : Vérifier sur thème d'aperçu**

```bash
cd "shopify (Runes de Chêne)"
shopify theme push --unpublished --theme="XO-apercu-inp" --store=runes-de-chene.myshopify.com
```
Ouvrir `https://runes-de-chene.myshopify.com/products/<handle-avec-photos-communaute>?preview_theme_id=<id>` et vérifier : le bloc s'affiche sous le produit, avec photo(s) + 2 notes + message + nom/instagram/lieu ; sur un produit sans photo Communauté → bloc vide/masqué, pas d'erreur console.

- [ ] **Step 3 : Commit**

```bash
cd "shopify (Runes de Chêne)"
git add templates/product.json
git commit -m "feat(galerie-produit): ajoute le bloc Ils nous portent sous la fiche produit"
```

- [ ] **Step 4 : Déploiement live (après validation Uriel)**

```bash
cd "shopify (Runes de Chêne)"
shopify theme push --theme=180921794827 --only sections/rdc_ils-nous-portent-produit.liquid --only templates/product.json --nodelete --allow-live --store=runes-de-chene.myshopify.com
```
Supprimer le thème d'aperçu de test ensuite (`shopify theme delete --theme=<id> --force`).

---

## Self-Review (writing-plans)

**Spec coverage :**
- Migration (notes + team_note + show_in_community + RPC) → Task 1. ✅
- Formulaire 2 notes + mot privé + relabel message → Task 2. ✅
- Double destination curation (ET/OU) → Task 4 (découplage + 2 interrupteurs). ✅
- RPC public sans team_note → Task 1 step 4 (vérif explicite). ✅
- Section Shopify fetch par handle → Task 5. ✅
- Ajout au template produit, sous le produit → Task 6. ✅
- Cross-repo / déploiement live `--only` → Task 6 step 4. ✅

**Placeholder scan :** la clé anon Supabase est référencée comme « à copier depuis `templates/page.ils-nous-portent.json` » (valeur réelle présente dans le repo, non recopiée ici pour ne pas dupliquer un secret public dans la doc) — instruction concrète, pas un placeholder vague.

**Type consistency :** noms RPC (`set_submission_image_community`, `get_community_photos_by_product`), params (`p_show`, `p_handle`, `p_rating_experience/products`, `p_team_note`), colonnes (`show_in_community`, `rating_experience`, `rating_products`, `team_note`) et props React (`onSetPhotoProduit`, `onSetCommunity`) cohérents entre toutes les tâches. ✅

**No-test-harness :** assumé explicitement — SQL vérifié via Supabase MCP, Hub via build + run manuel, Liquid via thème d'aperçu. Pas de fausse étape « run les tests ».
