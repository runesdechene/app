# Brique 1bis-A — Données par-photo + récompense manuelle + UI modération hub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer la récompense UGC d'un montant fixe automatique à un **montant manuel fixé à la validation**, ajouter **statut + taille + produit par photo**, et **département / quête / reward_crowns** sur l'envoi, avec la refonte de l'UI de modération du hub.

**Architecture:** Une migration (176) ajoute les colonnes par-photo et par-envoi, redéfinit `moderate_submission`/`moderate_review` pour prendre un paramètre `p_crowns` (drop de l'ancienne signature puis recréation avec `DEFAULT NULL` → pas de crash pendant la bascule), et ajoute des RPC de curation par photo. Le hub (`Photos.tsx`, `Reviews.tsx`) gagne : garder/archiver + produit par photo, et un champ Couronnes à la validation de l'envoi.

**Tech Stack:** PostgreSQL/plpgsql (Supabase, via MCP `apply_migration`), React 18 + Vite + TS strict (hub). Vérif SQL via MCP `execute_sql` ; front via `npx tsc --noEmit` (⚠️ `pnpm build` = vite seul, ne type-check pas) + checklist manuelle.

## Référence — état courant (mig 175, appliqué/live)

`moderate_submission` courant (mig 175) :
```sql
CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user_id text; v_rewarded timestamptz; v_reward int; v_count int;
BEGIN
  UPDATE hub_photo_submissions SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;
  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(value::int,0) INTO v_reward FROM app_settings WHERE key='ugc_reward_crowns';
    SELECT contributions_count INTO v_count FROM users WHERE id=v_user_id;
    IF COALESCE(v_count,0)=0 THEN v_reward := v_reward + COALESCE((SELECT value::int FROM app_settings WHERE key='ugc_first_contribution_crowns'),0); END IF;
    IF v_reward>0 THEN INSERT INTO public.user_crowns(user_id,balance,updated_at) VALUES(v_user_id,LEAST(500,v_reward),now())
      ON CONFLICT(user_id) DO UPDATE SET balance=LEAST(500,public.user_crowns.balance+v_reward),updated_at=now(); END IF;
    UPDATE users SET contributions_count=contributions_count+1 WHERE id=v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at=now() WHERE id=p_submission_id;
    INSERT INTO notifications(recipient_id,type,data) VALUES(v_user_id,'contribution_approved',jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_reward));
  END IF; END; $$;
```
`moderate_review` courant : signature `(p_review_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)`, même logique de récompense sur `hub_review_submissions`, `kind='review'`.

`hub_submission_images` (baseline) : `id uuid, submission_id uuid, storage_path text, image_url text, sort_order int, created_at`. La RPC `get_submission_images_batch(uuid[])` fait `SELECT *` → les nouvelles colonnes remontent automatiquement.

`Photos.tsx` : `interface SubmissionImage { id; image_url; sort_order }`, `interface PhotoSubmission {...; hub_submission_images: SubmissionImage[] }`. Handler `moderate(subId, status)` → `supabase.rpc('moderate_submission',{p_submission_id, p_status})`. Actions par statut avec boutons « Valider / Archiver / Supprimer ».

## File Structure
- **Create** `supabase/migrations/176_ugc_studio_data_and_manual_reward.sql`
- **Modify** `apps/hub/src/components/Photos.tsx` — interfaces, state Couronnes, moderate(crowns), curation par photo, produit par photo, affichage size/dept/quête.
- **Modify** `apps/hub/src/components/Reviews.tsx` — champ Couronnes + appel `moderate_review` avec `p_crowns`.
- **Modify** `apps/hub/src/components/Photos.css` *(ou le CSS hub existant)* — styles des contrôles par photo + champ Couronnes (réutiliser les classes existantes au maximum).

---

### Task 1 : Migration 176 — schéma + récompense manuelle + RPC curation

**Files:** Create `supabase/migrations/176_ugc_studio_data_and_manual_reward.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 176_ugc_studio_data_and_manual_reward.sql
-- WHY : Brique 1bis-A. Recompense MANUELLE a la validation (remplace le montant fixe mig 175),
-- curation + produit + taille PAR PHOTO, et departement/quete/reward_crowns sur l'envoi.

-- ===== Schema : par photo =====
ALTER TABLE public.hub_submission_images
  ADD COLUMN IF NOT EXISTS size         text,            -- taille saisie ; 'none' = aucun produit porte ; NULL = non renseigne
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS product_worn text;            -- produit tague au hub, par photo
ALTER TABLE public.hub_submission_images DROP CONSTRAINT IF EXISTS hub_submission_images_status_check;
ALTER TABLE public.hub_submission_images
  ADD CONSTRAINT hub_submission_images_status_check CHECK (status IN ('pending','approved','archived'));

-- ===== Schema : par envoi =====
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS departement   text,
  ADD COLUMN IF NOT EXISTS quest_ref     text,
  ADD COLUMN IF NOT EXISTS reward_crowns int;
ALTER TABLE public.hub_review_submissions
  ADD COLUMN IF NOT EXISTS reward_crowns int;

-- ===== RPC : moderation photos, montant MANUEL (drop ancienne signature puis recree) =====
DROP FUNCTION IF EXISTS public.moderate_submission(uuid, text);
CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text, p_crowns int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_amount   int;
BEGIN
  UPDATE hub_photo_submissions SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(p_crowns, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_amount), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_amount), updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at = now(), reward_crowns = v_amount WHERE id = p_submission_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_amount));
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.moderate_submission(uuid, text, int) TO anon, authenticated, service_role;

-- ===== RPC : moderation avis, montant MANUEL =====
DROP FUNCTION IF EXISTS public.moderate_review(uuid, text, text);
CREATE OR REPLACE FUNCTION public.moderate_review(p_review_id uuid, p_status text, p_rejection_reason text DEFAULT NULL, p_crowns int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_amount   int;
BEGIN
  UPDATE hub_review_submissions SET status = p_status, moderated_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_review_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(p_crowns, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_amount), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_amount), updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_review_submissions SET rewarded_at = now(), reward_crowns = v_amount WHERE id = p_review_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','review','submission_id',p_review_id,'crowns',v_amount));
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.moderate_review(uuid, text, text, int) TO anon, authenticated, service_role;

-- ===== RPC : curation par photo (statut affichage) =====
CREATE OR REPLACE FUNCTION public.set_submission_image_status(p_image_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_status NOT IN ('pending','approved','archived') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;
  UPDATE hub_submission_images SET status = p_status WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_status(uuid, text) TO anon, authenticated, service_role;

-- ===== RPC : produit porte par photo (tague au hub) =====
CREATE OR REPLACE FUNCTION public.set_submission_image_product(p_image_id uuid, p_product text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images SET product_worn = NULLIF(btrim(p_product), '') WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_product(uuid, text) TO anon, authenticated, service_role;
```

- [ ] **Step 2 : Appliquer en prod** — via MCP `apply_migration` (project `ukpapqssgsxirsgmcvof`, name `176_ugc_studio_data_and_manual_reward`). Expected: `{"success":true}`.

- [ ] **Step 3 : Tester récompense manuelle + idempotence (execute_sql)**

```sql
SELECT public.create_user_from_submission('test-1bisA','del+1bisa@resend.dev','T',NULL); -- bonus bienvenue 20
INSERT INTO public.hub_photo_submissions (user_id,submitter_name,submitter_email,status)
VALUES ('test-1bisA','T','del+1bisa@resend.dev','pending') RETURNING id; -- noter <ID>
SELECT public.moderate_submission('<ID>','approved', 75);                 -- montant manuel 75
SELECT balance FROM public.user_crowns WHERE user_id='test-1bisA';        -- attendu 95 (20 + 75)
SELECT reward_crowns, rewarded_at IS NOT NULL AS rewarded FROM public.hub_photo_submissions WHERE id='<ID>'; -- 75, true
SELECT public.moderate_submission('<ID>','archived', 75);
SELECT public.moderate_submission('<ID>','approved', 999);                -- ne doit PAS re-payer
SELECT balance FROM public.user_crowns WHERE user_id='test-1bisA';        -- reste 95
```
Expected : balance 95 puis 95 (idempotent), `reward_crowns=75`.

- [ ] **Step 4 : Tester curation par photo**

```sql
INSERT INTO public.hub_submission_images (submission_id, storage_path, image_url, sort_order)
VALUES ('<ID>','x/y.webp','https://example/y.webp',0) RETURNING id; -- noter <IMG>
SELECT public.set_submission_image_status('<IMG>','approved');
SELECT public.set_submission_image_product('<IMG>','  Veste de lin  ');
SELECT status, product_worn FROM public.hub_submission_images WHERE id='<IMG>'; -- approved, 'Veste de lin' (trim)
```
Expected : `status='approved'`, `product_worn='Veste de lin'`.

- [ ] **Step 5 : Nettoyer**
```sql
DELETE FROM public.notifications WHERE recipient_id='test-1bisA';
DELETE FROM public.hub_submission_images WHERE submission_id IN (SELECT id FROM public.hub_photo_submissions WHERE user_id='test-1bisA');
DELETE FROM public.hub_photo_submissions WHERE user_id='test-1bisA';
DELETE FROM public.user_crowns WHERE user_id='test-1bisA';
DELETE FROM public.users WHERE id='test-1bisA';
```

- [ ] **Step 6 : Commit**
```bash
git add supabase/migrations/176_ugc_studio_data_and_manual_reward.sql
git commit -m "feat(ugc): recompense manuelle a la validation + donnees par-photo (mig 176)"
```

---

### Task 2 : `Photos.tsx` — types + état Couronnes

**Files:** Modify `apps/hub/src/components/Photos.tsx`

- [ ] **Step 1 : Étendre les interfaces** — remplacer l'interface `SubmissionImage` et compléter `PhotoSubmission` :

```tsx
interface SubmissionImage {
  id: string
  image_url: string
  sort_order: number
  status: 'pending' | 'approved' | 'archived'
  size: string | null            // valeur taille, 'none' = aucun produit porté, null = non renseigné
  product_worn: string | null    // produit tagué au hub, par photo
}
```
Dans `interface PhotoSubmission`, ajouter après `created_at: string` :
```tsx
  departement: string | null
  quest_ref: string | null
  reward_crowns: number | null
```

- [ ] **Step 2 : Ajouter l'état du montant Couronnes par envoi** — après les autres `useState` du composant `Photos` :
```tsx
  // Montant de Couronnes saisi à la validation, par soumission (défaut suggéré : 10)
  const [crownInput, setCrownInput] = useState<Record<string, number>>({})
  const crownsFor = (subId: string) => (crownInput[subId] ?? 10)
```

- [ ] **Step 3 : Vérifier le type-check**
Run: `cd apps/hub && npx tsc --noEmit 2>&1 | grep Photos.tsx || echo "Photos.tsx OK"`
Expected: `Photos.tsx OK` (les champs `status/size/product_worn` remontent déjà via `get_submission_images_batch` `SELECT *` ; le mapping d'enrichissement les conserve car il fait `...img`).

> Note : dans le `enriched`/`hub_submission_images` du fetch existant, vérifier que le map conserve les nouveaux champs. Le code actuel fait `.filter(img => img.submission_id === s.id)` sur le retour brut → les champs `status/size/product_worn` sont déjà présents, rien à changer côté fetch.

- [ ] **Step 4 : Commit**
```bash
git add apps/hub/src/components/Photos.tsx
git commit -m "feat(ugc): types par-photo + etat couronnes dans Photos.tsx"
```

---

### Task 3 : `Photos.tsx` — validation avec montant manuel

**Files:** Modify `apps/hub/src/components/Photos.tsx`

- [ ] **Step 1 : Modifier le handler `moderate`** — il prend désormais un montant optionnel :
```tsx
  const moderate = async (subId: string, status: PhotoStatus, crowns?: number) => {
    const { error } = await supabase.rpc('moderate_submission', {
      p_submission_id: subId,
      p_status: status,
      p_crowns: crowns ?? null,
    })
    if (!error) {
      if (filter !== 'all') {
        setSubmissions(prev => prev.filter(s => s.id !== subId))
      } else {
        setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status } : s))
      }
    }
  }
```

- [ ] **Step 2 : Remplacer le bloc d'actions `pending`** (le `{sub.status === 'pending' && (...)}`) par un champ Couronnes + Valider :
```tsx
              {sub.status === 'pending' && (
                <div className="photo-actions">
                  <div className="crown-validate">
                    <label>🪙</label>
                    <input
                      type="number" min={0} className="crown-input"
                      value={crownsFor(sub.id)}
                      onChange={(e) => setCrownInput(prev => ({ ...prev, [sub.id]: Math.max(0, parseInt(e.target.value || '0', 10)) }))}
                    />
                    <button className="btn-approve" onClick={() => moderate(sub.id, 'approved', crownsFor(sub.id))}>
                      Valider (+{crownsFor(sub.id)})
                    </button>
                  </div>
                  <button className="btn-archive" onClick={() => moderate(sub.id, 'archived')}>Archiver</button>
                  <button className="btn-reject" onClick={() => deleteSubmission(sub.id)}>Supprimer</button>
                </div>
              )}
```
*(Les blocs `approved` et `archived` restent inchangés — la récompense n'est versée qu'à la 1re validation, garde `rewarded_at`.)*

- [ ] **Step 3 : Ajouter les styles** — à la fin du CSS du hub (fichier de styles importé par `Photos.tsx`, ex. `index.css`/`App.css` du hub — vérifier l'import en tête de `Photos.tsx`) :
```css
.crown-validate { display: inline-flex; align-items: center; gap: 6px; }
.crown-input { width: 64px; padding: 6px 8px; border: 1px solid #c9b48a; border-radius: 6px; }
```

- [ ] **Step 4 : Type-check**
Run: `cd apps/hub && npx tsc --noEmit 2>&1 | grep Photos.tsx || echo "OK"`
Expected: OK.

- [ ] **Step 5 : Commit**
```bash
git add apps/hub/src/components/Photos.tsx apps/hub/src/<fichier-css-hub>
git commit -m "feat(ugc): validation avec montant Couronnes manuel (Photos.tsx)"
```

---

### Task 4 : `Photos.tsx` — curation + produit par photo

**Files:** Modify `apps/hub/src/components/Photos.tsx`

- [ ] **Step 1 : Handlers par photo** — ajouter près des autres handlers :
```tsx
  const setImageStatus = async (subId: string, imageId: string, status: SubmissionImage['status']) => {
    const { error } = await supabase.rpc('set_submission_image_status', { p_image_id: imageId, p_status: status })
    if (!error) {
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({
        ...s,
        hub_submission_images: s.hub_submission_images.map(img => img.id === imageId ? { ...img, status } : img),
      })))
    }
  }

  const setImageProduct = async (subId: string, imageId: string, product: string) => {
    const clean = product.trim() || null
    const { error } = await supabase.rpc('set_submission_image_product', { p_image_id: imageId, p_product: clean })
    if (!error) {
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({
        ...s,
        hub_submission_images: s.hub_submission_images.map(img => img.id === imageId ? { ...img, product_worn: clean } : img),
      })))
    }
  }

  const sizeLabel = (size: string | null) => size == null ? 'Taille non renseignée' : size === 'none' ? 'Aucun produit porté' : `Taille ${size}`
```

- [ ] **Step 2 : Bloc de contrôle par photo dans la grille étendue** — dans la section `expanded-images` (le `.map((img, idx) => ...)`), ajouter sous chaque `expanded-img-wrap` les contrôles :
```tsx
                      <div key={img.id} className="expanded-img-wrap">
                        {isVideoUrl(img.image_url)
                          ? <video src={img.image_url} muted playsInline onClick={() => openLightbox(sub.hub_submission_images, idx)} style={{ cursor: 'pointer' }} />
                          : <img src={img.image_url} alt="" onClick={() => openLightbox(sub.hub_submission_images, idx)} style={{ cursor: 'pointer' }} />
                        }
                        <div className="img-curate">
                          <span className="img-size">{sizeLabel(img.size)}</span>
                          <div className="img-curate-btns">
                            <button className={img.status === 'approved' ? 'on' : ''} onClick={() => setImageStatus(sub.id, img.id, 'approved')}>Garder</button>
                            <button className={img.status === 'archived' ? 'on' : ''} onClick={() => setImageStatus(sub.id, img.id, 'archived')}>Archiver</button>
                          </div>
                          <input
                            className="img-product" placeholder="Produit porté (tag hub)"
                            defaultValue={img.product_worn ?? ''}
                            onBlur={(e) => setImageProduct(sub.id, img.id, e.target.value)}
                          />
                        </div>
                        <button className="btn-download-img" onClick={() => downloadSingleImage(sub, img.image_url, idx)} title="Telecharger cette photo">↓</button>
                      </div>
```

- [ ] **Step 3 : Afficher département + quête sur la carte** — dans `photo-info`, après le bloc location, ajouter :
```tsx
                {sub.departement && <span className="photo-location">Département : {sub.departement}</span>}
                {sub.quest_ref && <span className="photo-quest">⚑ Quête : {sub.quest_ref}</span>}
```

- [ ] **Step 4 : Styles** — ajouter au CSS hub :
```css
.img-curate { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.img-size { font-size: 11px; color: #6b5; }
.img-curate-btns button { font-size: 11px; padding: 2px 6px; margin-right: 4px; border: 1px solid #c9b48a; border-radius: 4px; background: #fff; cursor: pointer; }
.img-curate-btns button.on { background: #2a2418; color: #fff; }
.img-product { font-size: 11px; padding: 3px 6px; border: 1px solid #c9b48a; border-radius: 4px; }
.photo-quest { font-size: 12px; color: #8a6d3b; }
```

- [ ] **Step 5 : Type-check**
Run: `cd apps/hub && npx tsc --noEmit 2>&1 | grep Photos.tsx || echo "OK"`
Expected: OK.

- [ ] **Step 6 : Commit**
```bash
git add apps/hub/src/components/Photos.tsx apps/hub/src/<fichier-css-hub>
git commit -m "feat(ugc): curation + produit par photo dans la moderation (Photos.tsx)"
```

---

### Task 5 : `Reviews.tsx` — montant manuel

**Files:** Modify `apps/hub/src/components/Reviews.tsx`

- [ ] **Step 1 : État Couronnes + handler** — ajouter l'état :
```tsx
  const [crownInput, setCrownInput] = useState<Record<string, number>>({})
  const crownsFor = (id: string) => (crownInput[id] ?? 10)
```
Modifier `moderate` :
```tsx
  const moderate = async (reviewId: string, status: ReviewStatus, crowns?: number) => {
    const { error } = await supabase.rpc('moderate_review', {
      p_review_id: reviewId, p_status: status, p_rejection_reason: null, p_crowns: crowns ?? null,
    })
    if (!error) {
      if (filter !== 'all') setReviews(prev => prev.filter(r => r.id !== reviewId))
      else setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status } : r))
    }
  }
```

- [ ] **Step 2 : Champ Couronnes au Valider (bloc `pending`)** — remplacer le bouton « Valider » du bloc `review.status === 'pending'` :
```tsx
                  <div className="crown-validate">
                    <label>🪙</label>
                    <input type="number" min={0} className="crown-input"
                      value={crownsFor(review.id)}
                      onChange={(e) => setCrownInput(prev => ({ ...prev, [review.id]: Math.max(0, parseInt(e.target.value || '0', 10)) }))} />
                    <button className="btn-approve" onClick={() => moderate(review.id, 'approved', crownsFor(review.id))}>
                      Valider (+{crownsFor(review.id)})
                    </button>
                  </div>
```
*(Les autres boutons Archiver/Supprimer restent ; le bloc `archived` peut garder un Valider sans montant — la garde `rewarded_at` empêche tout double paiement.)*

- [ ] **Step 3 : Type-check**
Run: `cd apps/hub && npx tsc --noEmit 2>&1 | grep Reviews.tsx || echo "OK"`
Expected: OK.

- [ ] **Step 4 : Commit**
```bash
git add apps/hub/src/components/Reviews.tsx
git commit -m "feat(ugc): validation avis avec montant Couronnes manuel (Reviews.tsx)"
```

---

### Task 6 : Build, bascule prod & vérif e2e

**Files:** (aucun — vérif + déploiement)

- [ ] **Step 1 : Build complet**
Run: `cd apps/hub && npx tsc --noEmit && pnpm build`
Expected: tsc 0 nouvelle erreur (les 4 préexistantes Dashboard/Factions/TitlesManager/Users tolérées), build vite OK.

- [ ] **Step 2 : Déployer le hub**
Run: `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`
Expected: « Production deploy is live ».

- [ ] **Step 3 : Vérif e2e réelle** — sur `hub.runesdechene.com`, ouvrir une soumission en attente : régler les Couronnes, garder/archiver des photos, taguer un produit, Valider. Vérifier via MCP `execute_sql` que `user_crowns.balance` a augmenté du montant choisi, `hub_photo_submissions.reward_crowns` = ce montant, et les `hub_submission_images.status/product_worn` mis à jour. Vérifier la réception de l'email d'acceptation avec le bon montant.

- [ ] **Step 4 : Doc sous-app** — mettre à jour `apps/hub/CLAUDE.md` (section Boucle récompense UGC) : « Récompense désormais MANUELLE à la validation (`moderate_submission/review` param `p_crowns`, mig 176). Curation + produit + taille par photo (`hub_submission_images.status/product_worn/size`, RPC `set_submission_image_*`). Montants fixes mig 175 dépréciés. »
```bash
git add apps/hub/CLAUDE.md && git commit -m "docs(hub): recompense manuelle + donnees par-photo (brique 1bis-A)"
```

---

## Self-Review

**Spec coverage** (vs 2026-05-26-ugc-brique1bis-studio-soumission-design) :
- D1 récompense manuelle → Task 1 (RPC `p_crowns`) + Tasks 3/5 (UI). Bonus bienvenue inchangé (non touché). ✅
- D2 curation par photo → Task 1 (`status` + `set_submission_image_status`) + Task 4 (UI garder/archiver). ✅
- D3 produit tagué au hub + « aucun produit » (`size='none'`) → Task 1 (`product_worn`, `size`) + Task 4 (`setImageProduct`, `sizeLabel`). La **saisie** de taille/none côté contributeur = Brique 1bis-B. ✅
- D5 quête `quest_ref` + département → Task 1 (colonnes) + Task 4 (affichage). ✅
- §4 logique récompense (param, idempotence, suppression auto) → Task 1. ✅
- §5 UI hub → Tasks 3-4. ✅
- Hors périmètre (studio public, surfaces d'affichage, système quête) → non traités ici, c'est voulu (1bis-B / Brique 2 / Phase 2). ✅

**Placeholder scan** : `<ID>`/`<IMG>` sont des valeurs de test à substituer à l'exécution (pas des trous de plan). `<fichier-css-hub>` : le fichier CSS importé par `Photos.tsx` — l'exécutant lit l'import en tête du fichier (Step 3 Task 3 le précise). Aucun TODO/TBD de logique.

**Type consistency** : `SubmissionImage.status` (`'pending'|'approved'|'archived'`) cohérent entre Task 2 (interface), Task 4 (`setImageStatus`). `crownInput`/`crownsFor` identiques entre Photos.tsx (Task 2) et Reviews.tsx (Task 5). RPC params (`p_submission_id/p_status/p_crowns`, `p_image_id/p_status`, `p_product`) cohérents migration ↔ front. ✅
