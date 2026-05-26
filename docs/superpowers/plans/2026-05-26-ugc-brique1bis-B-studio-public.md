# Brique 1bis-B — Le Studio public (wizard guidé)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le formulaire `/soumettre-contenu` par un **studio guidé en 4 étapes** (drop → tailles par photo + « aucun produit » → mot global + département → identité), à l'esthétique parchemin/landing validée, qui peuple `departement`/`quest_ref`/`size`.

**Architecture:** Une migration (177) étend `create_photo_submission` (+`p_departement`,+`p_quest_ref`) et `add_submission_image` (+`p_size`) — drop des anciennes signatures puis recréation avec DEFAULT (les appels existants résolvent vers les nouvelles). Un nouveau composant `StudioSubmit.tsx` (wizard 4 étapes, état machine) remplace `PhotoSubmit.tsx` sur la route `/soumettre-contenu` ; il réutilise le pipeline de soumission (compte → submission → upload → image) en passant les nouveaux champs. `PhotoSubmit.tsx` est supprimé (D1).

**Tech Stack:** PostgreSQL/plpgsql (Supabase, MCP `apply_migration`), React 18 + Vite + TS strict (hub), Supabase Storage. Vérif SQL via MCP `execute_sql` ; front via `npx tsc --noEmit` + smoke manuel.

## Référence — état courant (baseline)

`add_submission_image(uuid,text,text,int)` : insère `(submission_id, storage_path, image_url, sort_order)`, retourne l'id.
`create_photo_submission(...)` : 13 params, insère dans `hub_photo_submissions` (`user_id, submitter_name, submitter_email, submitter_instagram, location_name, location_zip, message, consent_brand_usage, consent_account_creation, status='pending', submitter_role, product_size, model_height_cm, model_shoulder_width_cm`).
Colonnes ajoutées en 1bis-A : `hub_submission_images.size/status/product_worn`, `hub_photo_submissions.departement/quest_ref/reward_crowns`.
Helper `compressImage` (WebP, max 1920px) : présent dans `PhotoSubmit.tsx` (à reprendre verbatim).
Route actuelle : `apps/hub/src/App.tsx` → `/soumettre-contenu` → `<PhotoSubmit />`.

## File Structure
- **Create** `supabase/migrations/177_ugc_studio_write_rpcs.sql` — extend create_photo_submission + add_submission_image + RPC `get_studio_config` + seed app_settings images.
- **Create** `apps/hub/src/components/StudioSubmit.tsx` — le wizard.
- **Create** `apps/hub/src/components/StudioSubmit.css` — esthétique parchemin/landing.
- **Modify** `apps/hub/src/App.tsx` — route `/soumettre-contenu` → `<StudioSubmit />`.
- **Delete** `apps/hub/src/components/PhotoSubmit.tsx` (remplacé).

---

### Task 1 : Migration 177 — RPC d'écriture du studio

**Files:** Create `supabase/migrations/177_ugc_studio_write_rpcs.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 177_ugc_studio_write_rpcs.sql
-- WHY : Brique 1bis-B. Le studio public ecrit departement/quete (envoi) + size (par photo).
-- On etend create_photo_submission + add_submission_image (drop ancienne signature puis recree
-- avec DEFAULT : les appels existants resolvent vers la nouvelle fonction). + config images studio.

-- add_submission_image : + p_size
DROP FUNCTION IF EXISTS public.add_submission_image(uuid, text, text, integer);
CREATE OR REPLACE FUNCTION public.add_submission_image(p_submission_id uuid, p_storage_path text, p_image_url text, p_sort_order integer, p_size text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_submission_images (submission_id, storage_path, image_url, sort_order, size)
  VALUES (p_submission_id, p_storage_path, p_image_url, p_sort_order, NULLIF(p_size, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.add_submission_image(uuid, text, text, integer, text) TO anon, authenticated, service_role;

-- create_photo_submission : + p_departement, + p_quest_ref (copie baseline + 2 colonnes)
DROP FUNCTION IF EXISTS public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id character varying, p_submitter_name text, p_submitter_email text, p_submitter_instagram text,
  p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL, p_message text DEFAULT NULL,
  p_consent_brand boolean DEFAULT false, p_consent_account boolean DEFAULT false, p_submitter_role text DEFAULT 'client',
  p_product_size text DEFAULT NULL, p_model_height_cm numeric DEFAULT NULL, p_model_shoulder_width_cm numeric DEFAULT NULL,
  p_departement text DEFAULT NULL, p_quest_ref text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm,
    departement, quest_ref
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text) TO anon, authenticated, service_role;

-- Config images du studio (lue cote public). Defaut bg = image landing ; aside vide => fallback CSS.
INSERT INTO public.app_settings (key, value) VALUES
  ('studio_bg_image_url',    'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-assets/landing-image-desktop-1776965256766.webp'),
  ('studio_aside_image_url', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_studio_config()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'bg_image_url',    COALESCE((SELECT value FROM app_settings WHERE key='studio_bg_image_url'), ''),
    'aside_image_url', COALESCE((SELECT value FROM app_settings WHERE key='studio_aside_image_url'), ''),
    'welcome_crowns',  COALESCE((SELECT value::int FROM app_settings WHERE key='ugc_welcome_crowns'), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_studio_config() TO anon, authenticated, service_role;
```

- [ ] **Step 2 : Appliquer** via MCP `apply_migration` (project `ukpapqssgsxirsgmcvof`, name `177_ugc_studio_write_rpcs`). Expected `{"success":true}`.

- [ ] **Step 3 : Tester l'écriture (execute_sql)**
```sql
SELECT public.create_user_from_submission('test-1bisB','del+1bisb@resend.dev','T',NULL);
SELECT public.create_photo_submission('test-1bisB','T','del+1bisb@resend.dev',NULL,
  NULL,NULL,'Mon shooting',true,true,'client',NULL,NULL,NULL,'33 · Gironde','quete-abc') AS sub_id; -- noter <SID>
SELECT public.add_submission_image('<SID>','p/a.webp','https://e/a.webp',0,'M') AS img_id;
SELECT public.add_submission_image('<SID>','p/b.webp','https://e/b.webp',1,'none');
SELECT departement, quest_ref FROM public.hub_photo_submissions WHERE id='<SID>';      -- '33 · Gironde','quete-abc'
SELECT size FROM public.hub_submission_images WHERE submission_id='<SID>' ORDER BY sort_order; -- 'M', 'none'
SELECT (public.get_studio_config()->>'welcome_crowns');                                 -- '20'
-- cleanup
DELETE FROM public.hub_submission_images WHERE submission_id='<SID>';
DELETE FROM public.hub_photo_submissions WHERE id='<SID>';
DELETE FROM public.user_crowns WHERE user_id='test-1bisB';
DELETE FROM public.users WHERE id='test-1bisB';
```
Expected : departement/quest_ref/size écrits, config welcome=20.

- [ ] **Step 4 : Commit**
```bash
git add supabase/migrations/177_ugc_studio_write_rpcs.sql
git commit -m "feat(ugc): RPC ecriture studio (departement/quete/size) + get_studio_config (mig 177)"
```

---

### Task 2 : `StudioSubmit.tsx` — logique (état + soumission)

**Files:** Create `apps/hub/src/components/StudioSubmit.tsx`

- [ ] **Step 1 : Écrire le composant (logique + rendu wizard)** — fichier complet :

```tsx
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './StudioSubmit.css'

const MAX_FILES = 10
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const MAX_MESSAGE = 500
const IMAGE_MAX_DIMENSION = 1920
const IMAGE_QUALITY = 0.82
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']
const NO_PRODUCT = 'none'

// Liste des départements FR (optionnel — vide pour l'étranger)
const DEPARTEMENTS = [
  '01 · Ain','02 · Aisne','03 · Allier','04 · Alpes-de-Haute-Provence','05 · Hautes-Alpes','06 · Alpes-Maritimes',
  '07 · Ardèche','08 · Ardennes','09 · Ariège','10 · Aube','11 · Aude','12 · Aveyron','13 · Bouches-du-Rhône',
  '14 · Calvados','15 · Cantal','16 · Charente','17 · Charente-Maritime','18 · Cher','19 · Corrèze','2A · Corse-du-Sud',
  '2B · Haute-Corse','21 · Côte-d\'Or','22 · Côtes-d\'Armor','23 · Creuse','24 · Dordogne','25 · Doubs','26 · Drôme',
  '27 · Eure','28 · Eure-et-Loir','29 · Finistère','30 · Gard','31 · Haute-Garonne','32 · Gers','33 · Gironde',
  '34 · Hérault','35 · Ille-et-Vilaine','36 · Indre','37 · Indre-et-Loire','38 · Isère','39 · Jura','40 · Landes',
  '41 · Loir-et-Cher','42 · Loire','43 · Haute-Loire','44 · Loire-Atlantique','45 · Loiret','46 · Lot','47 · Lot-et-Garonne',
  '48 · Lozère','49 · Maine-et-Loire','50 · Manche','51 · Marne','52 · Haute-Marne','53 · Mayenne','54 · Meurthe-et-Moselle',
  '55 · Meuse','56 · Morbihan','57 · Moselle','58 · Nièvre','59 · Nord','60 · Oise','61 · Orne','62 · Pas-de-Calais',
  '63 · Puy-de-Dôme','64 · Pyrénées-Atlantiques','65 · Hautes-Pyrénées','66 · Pyrénées-Orientales','67 · Bas-Rhin',
  '68 · Haut-Rhin','69 · Rhône','70 · Haute-Saône','71 · Saône-et-Loire','72 · Sarthe','73 · Savoie','74 · Haute-Savoie',
  '75 · Paris','76 · Seine-Maritime','77 · Seine-et-Marne','78 · Yvelines','79 · Deux-Sèvres','80 · Somme','81 · Tarn',
  '82 · Tarn-et-Garonne','83 · Var','84 · Vaucluse','85 · Vendée','86 · Vienne','87 · Haute-Vienne','88 · Vosges',
  '89 · Yonne','90 · Territoire de Belfort','91 · Essonne','92 · Hauts-de-Seine','93 · Seine-Saint-Denis','94 · Val-de-Marne',
  '95 · Val-d\'Oise','971 · Guadeloupe','972 · Martinique','973 · Guyane','974 · La Réunion','976 · Mayotte',
]

const isVideo = (f: File) => f.type.startsWith('video/')
const isImage = (f: File) => f.type.startsWith('image/')
const maxSizeFor = (f: File) => (isVideo(f) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)

/** Redimensionne + convertit en WebP (repris de PhotoSubmit). */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        if (width > height) { height = Math.round(height * (IMAGE_MAX_DIMENSION / width)); width = IMAGE_MAX_DIMENSION }
        else { width = Math.round(width * (IMAGE_MAX_DIMENSION / height)); height = IMAGE_MAX_DIMENSION }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas indisponible'))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Compression échouée'))
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
      }, 'image/webp', IMAGE_QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

type Phase = 'wizard' | 'uploading' | 'success' | 'error'

export function StudioSubmit() {
  const [step, setStep] = useState(1)               // 1..4
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [sizes, setSizes] = useState<(string | null)[]>([])  // par fichier : taille, 'none', ou null
  const [photoIdx, setPhotoIdx] = useState(0)        // étape 2 : photo courante
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [departement, setDepartement] = useState('')
  const [consentBrand, setConsentBrand] = useState(false)
  const [consentAccount, setConsentAccount] = useState(false)
  const [phase, setPhase] = useState<Phase>('wizard')
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)
  const [welcomeCrowns, setWelcomeCrowns] = useState(0)
  const [bgUrl, setBgUrl] = useState('')
  const [asideUrl, setAsideUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const questRef = new URLSearchParams(window.location.search).get('quete')

  useEffect(() => {
    supabase.rpc('get_studio_config').then(({ data }) => {
      const c = data as { bg_image_url?: string; aside_image_url?: string; welcome_crowns?: number } | null
      if (c) { setBgUrl(c.bg_image_url || ''); setAsideUrl(c.aside_image_url || ''); setWelcomeCrowns(c.welcome_crowns || 0) }
    })
  }, [])

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => (isImage(f) || isVideo(f)) && f.size <= maxSizeFor(f))
    const merged = [...files, ...selected].slice(0, MAX_FILES)
    previews.forEach(p => URL.revokeObjectURL(p))
    setFiles(merged)
    setPreviews(merged.map(f => URL.createObjectURL(f)))
    setSizes(prev => merged.map((_, i) => prev[i] ?? null))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (i: number) => {
    URL.revokeObjectURL(previews[i])
    setFiles(prev => prev.filter((_, k) => k !== i))
    setPreviews(prev => prev.filter((_, k) => k !== i))
    setSizes(prev => prev.filter((_, k) => k !== i))
    setPhotoIdx(0)
  }

  const setSizeForCurrent = (val: string) =>
    setSizes(prev => prev.map((s, i) => i === photoIdx ? (s === val ? null : val) : s))

  const canSubmit = name.trim() !== '' && email.includes('@') && files.length > 0 && consentBrand && consentAccount

  const submit = async () => {
    if (!canSubmit) return
    setPhase('uploading')
    try {
      setProgress('Vérification du compte…')
      const { data: existing } = await supabase.from('users').select('id').eq('email_address', email.toLowerCase().trim()).limit(1)
      let userId: string
      if (existing && existing.length > 0) { userId = existing[0].id; setIsNewAccount(false) }
      else {
        setIsNewAccount(true); setProgress('Création du compte…')
        const newId = crypto.randomUUID()
        const { error } = await supabase.rpc('create_user_from_submission', {
          p_id: newId, p_email: email.toLowerCase().trim(), p_first_name: name.trim(), p_instagram: null,
        })
        if (error) throw new Error(`Compte : ${error.message}`)
        userId = newId
      }

      setProgress('Enregistrement…')
      const { data: subId, error: subErr } = await supabase.rpc('create_photo_submission', {
        p_user_id: userId, p_submitter_name: name.trim(), p_submitter_email: email.toLowerCase().trim(),
        p_submitter_instagram: null, p_message: message.trim() || null,
        p_consent_brand: consentBrand, p_consent_account: consentAccount,
        p_departement: departement || null, p_quest_ref: questRef,
      })
      if (subErr) throw new Error(`Soumission : ${subErr.message}`)

      for (let i = 0; i < files.length; i++) {
        let file = files[i]
        if (isImage(file)) {
          setProgress(`Compression ${i + 1}/${files.length}…`)
          try { file = await compressImage(file) } catch { file = files[i] }
        }
        setProgress(`Envoi ${i + 1}/${files.length}…`)
        const ext = file.name.split('.').pop() || 'webp'
        const path = `submissions/${subId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('community-photos').upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw new Error(`Upload ${i + 1} : ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('community-photos').getPublicUrl(path)
        const { error: imgErr } = await supabase.rpc('add_submission_image', {
          p_submission_id: subId, p_storage_path: path, p_image_url: urlData.publicUrl, p_sort_order: i, p_size: sizes[i],
        })
        if (imgErr) throw new Error(`Fichier ${i + 1} : ${imgErr.message}`)
      }
      setPhase('success')
    } catch (err) {
      console.error('[StudioSubmit] submit failed', err)
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue')
      setPhase('error')
    }
  }

  // --- rendu : voir Task 3 ---
  return renderStudio({
    step, setStep, files, previews, sizes, photoIdx, setPhotoIdx, addFiles, removeFile, setSizeForCurrent,
    name, setName, email, setEmail, message, setMessage, departement, setDepartement,
    consentBrand, setConsentBrand, consentAccount, setConsentAccount,
    canSubmit, submit, phase, progress, errorMsg, isNewAccount, welcomeCrowns, bgUrl, asideUrl, fileInputRef,
    questRef,
  })
}
```
*(Le rendu `renderStudio(...)` est défini dans la Task 3 ; pour garder un seul fichier, la Task 3 remplace le `return renderStudio(...)` par le JSX inline. Voir Task 3.)*

- [ ] **Step 2 : Type-check partiel** — le composant ne compile pas encore (rendu en Task 3). Ne pas lancer tsc avant Task 3.

- [ ] **Step 3 : Commit (après Task 3, ensemble).** *(pas de commit isolé ici)*

---

### Task 3 : `StudioSubmit.tsx` — rendu du wizard (4 étapes)

**Files:** Modify `apps/hub/src/components/StudioSubmit.tsx`

- [ ] **Step 1 : Remplacer le `return renderStudio({...})`** par le JSX inline complet (états déjà dans le scope du composant) :

```tsx
  if (phase === 'uploading') {
    return <div className="studio"><div className="studio__overlay"><div className="spinner" /><p>{progress}</p></div></div>
  }
  if (phase === 'success') {
    return (
      <div className="studio" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
        <div className="studio__card studio__card--center">
          <div className="success-icon">⚜</div>
          <h2>Bienvenue dans le Mouvement !</h2>
          <p>Tes contenus partent en validation. Dès qu'ils sont adoubés, tes Couronnes de Chêne atterrissent sur ton compte — on te prévient par email.</p>
          {isNewAccount && welcomeCrowns > 0 && (
            <div className="reward-badge"><span className="reward-badge-label">Cadeau de bienvenue</span><span className="reward-badge-amount">+{welcomeCrowns} Couronnes</span></div>
          )}
          <a href="https://app.runesdechene.com" target="_blank" rel="noopener noreferrer" className="studio__cta">Ouvrir l'application →</a>
        </div>
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="studio"><div className="studio__card studio__card--center">
        <div className="error-icon">✕</div><h2>Oups</h2><p>{errorMsg}</p>
        <button className="studio__cta" onClick={() => setPhase('wizard')}>Réessayer</button>
      </div></div>
    )
  }

  const STEP_LABELS = ['Tes contenus', 'Les tailles', 'Ton histoire', 'Toi']
  const next = () => setStep(s => Math.min(4, s + 1))
  const prev = () => setStep(s => Math.max(1, s - 1))
  const sizeLabel = (s: string | null) => s == null ? '' : s === NO_PRODUCT ? 'Aucun produit' : s

  return (
    <div className="studio" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
      <div className="studio__console">
        <aside className="studio__aside" style={asideUrl ? { backgroundImage: `url(${asideUrl})` } : undefined}>
          <div className="studio__aside-in">
            <div className="studio__kicker">Runes de Chêne</div>
            <h1 className="studio__title">Envoyer<br/>mes contenus</h1>
            <ol className="studio__steps">
              {STEP_LABELS.map((label, i) => (
                <li key={label} className={`studio__step ${step === i + 1 ? 'now' : ''} ${step > i + 1 ? 'done' : ''}`}>
                  <span className="n">{step > i + 1 ? '✓' : i + 1}</span><span className="t">{label}</span>
                </li>
              ))}
            </ol>
            <p className="studio__quote">« On te guide pas à pas. Quelques minutes, et tes clichés rejoignent le Mouvement. »</p>
          </div>
        </aside>

        <section className="studio__panel">
          {step === 1 && (
            <>
              <div className="studio__kick">Étape 1 sur 4</div>
              <h2 className="studio__h">Tes contenus</h2>
              <p className="studio__lead">Dépose tes photos et vidéos — jusqu'à {MAX_FILES}.</p>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={addFiles} style={{ display: 'none' }} />
              <div className="studio__drop" onClick={() => fileInputRef.current?.click()}>⬆ Glisse ou clique pour ajouter</div>
              {previews.length > 0 && (
                <div className="studio__thumbs">
                  {previews.map((src, i) => (
                    <div key={i} className="studio__thumb">
                      {isVideo(files[i]) ? <video src={src} muted playsInline /> : <img src={src} alt="" />}
                      <button className="studio__thumb-x" onClick={() => removeFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="studio__nav">
                <span />
                <button className="studio__next" disabled={files.length === 0} onClick={next}>Suivant →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="studio__kick">Étape 2 sur 4</div>
              <h2 className="studio__h">Quelle taille portes-tu ?</h2>
              <p className="studio__lead">Une taille par contenu — ou « aucun produit ». C'est optionnel.</p>
              {files[photoIdx] && (
                <div className="studio__stage">
                  {isVideo(files[photoIdx])
                    ? <video className="studio__shot" src={previews[photoIdx]} muted playsInline />
                    : <img className="studio__shot" src={previews[photoIdx]} alt="" />}
                  <div className="studio__sizes">
                    {SIZES.map(sz => (
                      <button key={sz} className={`studio__sz ${sizes[photoIdx] === sz ? 'on' : ''}`} onClick={() => setSizeForCurrent(sz)}>{sz}</button>
                    ))}
                    <button className={`studio__sz studio__sz--none ${sizes[photoIdx] === NO_PRODUCT ? 'on' : ''}`} onClick={() => setSizeForCurrent(NO_PRODUCT)}>Aucun produit</button>
                  </div>
                  <div className="studio__count">Contenu {photoIdx + 1} / {files.length}{sizeLabel(sizes[photoIdx]) ? ` · ${sizeLabel(sizes[photoIdx])}` : ''}</div>
                </div>
              )}
              <div className="studio__nav">
                <button className="studio__ghost" onClick={() => photoIdx > 0 ? setPhotoIdx(photoIdx - 1) : prev()}>← Précédent</button>
                <div className="studio__dots">{files.map((_, i) => <span key={i} className={`dot ${i === photoIdx ? 'on' : ''}`} />)}</div>
                <button className="studio__next" onClick={() => photoIdx < files.length - 1 ? setPhotoIdx(photoIdx + 1) : next()}>
                  {photoIdx < files.length - 1 ? 'Suivant →' : 'Continuer →'}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="studio__kick">Étape 3 sur 4</div>
              <h2 className="studio__h">Ton histoire</h2>
              <label className="studio__label">Un mot sur ton shooting (optionnel)</label>
              <textarea className="studio__field" rows={4} maxLength={MAX_MESSAGE} value={message}
                onChange={(e) => setMessage(e.target.value)} placeholder="Raconte-nous…" />
              <label className="studio__label">Département (optionnel)</label>
              <select className="studio__field" value={departement} onChange={(e) => setDepartement(e.target.value)}>
                <option value="">— Je préfère ne pas dire / hors France —</option>
                {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="studio__nav">
                <button className="studio__ghost" onClick={prev}>← Précédent</button>
                <button className="studio__next" onClick={next}>Suivant →</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="studio__kick">Étape 4 sur 4</div>
              <h2 className="studio__h">Toi</h2>
              <label className="studio__label">Prénom *</label>
              <input className="studio__field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
              <label className="studio__label">Email *</label>
              <input className="studio__field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@email.com" />
              <label className="studio__consent"><input type="checkbox" checked={consentBrand} onChange={(e) => setConsentBrand(e.target.checked)} /> J'accepte que mes contenus soient diffusés par la marque ou ses réseaux. *</label>
              <label className="studio__consent"><input type="checkbox" checked={consentAccount} onChange={(e) => setConsentAccount(e.target.checked)} /> J'accepte la création de mon compte Runes de Chêne (accès à l'application). *</label>
              <div className="studio__nav">
                <button className="studio__ghost" onClick={prev}>← Précédent</button>
                <button className="studio__next studio__next--send" disabled={!canSubmit} onClick={submit}>Envoyer mes contenus ✦</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
```
Puis **supprimer** la ligne `return renderStudio({...})` (et l'objet) de la Task 2 — le composant se termine désormais par ce JSX.

- [ ] **Step 2 : Type-check**
Run: `cd apps/hub && npx tsc --noEmit 2>&1 | grep StudioSubmit || echo "StudioSubmit OK"`
Expected: OK.

- [ ] **Step 3 : Commit**
```bash
git add apps/hub/src/components/StudioSubmit.tsx
git commit -m "feat(ugc): composant StudioSubmit (wizard 4 etapes)"
```

---

### Task 4 : `StudioSubmit.css` — esthétique parchemin/landing

**Files:** Create `apps/hub/src/components/StudioSubmit.css`

- [ ] **Step 1 : Écrire le CSS** (repris de la maquette validée `studio-v6.html`, polices Bebas/Cabin chargées globalement par le hub ; sinon ajouter le `@import` Google Fonts en tête) :

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cabin:wght@400;500;600;700&family=Cabin+Condensed:wght@600;700&display=swap');
.studio { --ink:#2a2418; --brown:#46352e; --red:#963e3e; --cream:#f4ecd8; --line:#d8c39a; --gold:#b8945a;
  min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px 14px;
  background:#1b150c center/cover fixed no-repeat; font-family:'Cabin',sans-serif; color:var(--brown); }
.studio__overlay { display:flex; flex-direction:column; align-items:center; gap:14px; color:#f2e7cf; }
.studio__overlay .spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,.25); border-top-color:var(--gold); border-radius:50%; animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg) } }
.studio__console { width:940px; max-width:100%; display:flex; border-radius:20px; overflow:hidden; box-shadow:0 30px 70px rgba(10,7,3,.6); animation:rise .6s cubic-bezier(.16,1,.3,1) both; }
@keyframes rise { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
.studio__aside { position:relative; width:38%; min-width:300px; background:#241d12 center/cover no-repeat; color:#f2e7cf; padding:34px 30px; }
.studio__aside::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(26,20,11,.5),rgba(26,20,11,.85)); }
.studio__aside-in { position:relative; z-index:1; display:flex; flex-direction:column; height:100%; }
.studio__kicker { font-size:.7rem; letter-spacing:.34em; text-transform:uppercase; color:#cbb486; }
.studio__title { font-family:'Bebas Neue',sans-serif; font-size:2.5rem; line-height:.92; color:#fff; margin:4px 0 0; text-shadow:0 2px 10px rgba(0,0,0,.45); }
.studio__steps { list-style:none; margin:32px 0 0; padding:0; display:flex; flex-direction:column; gap:16px; }
.studio__step { display:flex; gap:12px; align-items:center; opacity:.55; }
.studio__step.now { opacity:1; } .studio__step.done { opacity:.95; }
.studio__step .n { width:32px; height:32px; border-radius:50%; border:2px solid rgba(255,255,255,.35); display:flex; align-items:center; justify-content:center; font-family:'Cabin Condensed',sans-serif; font-weight:700; }
.studio__step.now .n { border-color:var(--gold); background:var(--gold); color:#241d12; }
.studio__step.done .n { border-color:#8fc079; color:#8fc079; }
.studio__step .t { font-family:'Cabin Condensed',sans-serif; }
.studio__quote { margin-top:auto; font-style:italic; font-size:.88rem; color:#e2d4b4; text-shadow:0 1px 4px rgba(0,0,0,.5); }
.studio__panel { flex:1; background:var(--cream); padding:36px 34px 28px; display:flex; flex-direction:column; min-height:520px; }
.studio__kick { font-size:.74rem; letter-spacing:.2em; text-transform:uppercase; color:#9a7b41; font-weight:700; }
.studio__h { font-family:'Bebas Neue',sans-serif; font-size:clamp(2rem,4vw,2.7rem); line-height:1; color:var(--red); margin:.2rem 0 0; }
.studio__lead { opacity:.9; margin:.3rem 0 0; }
.studio__drop { margin-top:16px; border:2px dashed var(--line); border-radius:14px; background:rgba(255,255,255,.4); padding:28px; text-align:center; cursor:pointer; font-family:'Cabin Condensed',sans-serif; color:var(--ink); transition:.2s; }
.studio__drop:hover { border-color:var(--red); background:rgba(150,62,62,.06); }
.studio__thumbs { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
.studio__thumb { position:relative; width:84px; height:84px; }
.studio__thumb img, .studio__thumb video { width:84px; height:84px; object-fit:cover; border-radius:10px; }
.studio__thumb-x { position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; border:none; background:var(--ink); color:#fff; cursor:pointer; }
.studio__stage { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:14px 0; }
.studio__shot { width:200px; height:250px; object-fit:cover; border-radius:16px; box-shadow:0 16px 36px rgba(20,14,6,.35); }
.studio__sizes { display:flex; gap:7px; flex-wrap:wrap; justify-content:center; }
.studio__sz { font-family:'Cabin Condensed',sans-serif; font-weight:700; padding:7px 13px; border-radius:9px; border:1.5px solid var(--line); background:#fffaf0; color:var(--brown); cursor:pointer; }
.studio__sz.on { background:var(--ink); color:#fff; border-color:var(--ink); }
.studio__sz--none { font-weight:600; }
.studio__count { font-size:.8rem; color:var(--brown); opacity:.65; }
.studio__label { display:block; margin:16px 0 6px; font-family:'Cabin Condensed',sans-serif; font-size:.78rem; letter-spacing:.12em; text-transform:uppercase; color:var(--brown); }
.studio__field { width:100%; font-family:'Cabin',sans-serif; font-size:.98rem; color:var(--ink); background:#fffaf0; border:1px solid var(--line); border-radius:10px; padding:11px 13px; }
textarea.studio__field { resize:none; }
.studio__consent { display:flex; gap:8px; align-items:flex-start; margin-top:12px; font-size:.84rem; line-height:1.4; }
.studio__nav { display:flex; align-items:center; justify-content:space-between; margin-top:auto; padding-top:18px; }
.studio__dots { display:flex; gap:6px; } .studio__dots .dot { width:8px; height:8px; border-radius:50%; background:var(--line); } .studio__dots .dot.on { background:var(--red); width:20px; border-radius:5px; }
.studio__ghost { font-family:'Cabin Condensed',sans-serif; font-weight:700; background:none; border:none; color:var(--brown); opacity:.65; cursor:pointer; }
.studio__next { display:inline-flex; align-items:center; gap:8px; height:40px; padding:0 18px; border:1.5px solid var(--ink); background:var(--ink); color:#fff; border-radius:10px; font-family:'Cabin Condensed',sans-serif; font-weight:700; letter-spacing:.04em; cursor:pointer; box-shadow:0 4px 12px rgba(42,36,24,.22); transition:.2s; }
.studio__next:hover:not(:disabled) { transform:translateY(-1px); background:#1f1a11; }
.studio__next:disabled { opacity:.45; cursor:not-allowed; }
.studio__next--send { font-family:'Bebas Neue',sans-serif; font-size:1.2rem; height:46px; }
.studio__card { background:var(--cream); border-radius:18px; padding:40px 34px; max-width:460px; box-shadow:0 26px 60px rgba(20,14,6,.45); text-align:center; }
.studio__card--center { display:flex; flex-direction:column; align-items:center; gap:12px; }
.studio__cta { display:inline-block; margin-top:8px; background:var(--ink); color:#fff; text-decoration:none; padding:13px 26px; border-radius:12px; border:none; font-family:'Bebas Neue',sans-serif; font-size:1.2rem; letter-spacing:.04em; cursor:pointer; }
.success-icon { font-size:2.4rem; } .error-icon { font-size:2rem; color:var(--red); }
.reward-badge { display:flex; flex-direction:column; align-items:center; gap:4px; margin:8px auto; padding:14px 22px; background:#241d12; color:#e9d9b6; border-radius:12px; }
.reward-badge-label { font-size:11px; letter-spacing:.06em; text-transform:uppercase; opacity:.8; } .reward-badge-amount { font-size:22px; font-weight:700; }
@media (max-width:900px) { .studio__console { flex-direction:column; } .studio__aside { width:100%; min-height:200px; } .studio__panel { min-height:0; } }
@media (prefers-reduced-motion: reduce) { .studio__console { animation:none; } }
```

- [ ] **Step 2 : Commit**
```bash
git add apps/hub/src/components/StudioSubmit.css
git commit -m "feat(ugc): style parchemin/landing du studio"
```

---

### Task 5 : Route, suppression de l'ancien form, build & bascule

**Files:** Modify `apps/hub/src/App.tsx` · Delete `apps/hub/src/components/PhotoSubmit.tsx`

- [ ] **Step 1 : Brancher la route** — dans `apps/hub/src/App.tsx` : remplacer l'import `import { PhotoSubmit } from './components/PhotoSubmit'` par `import { StudioSubmit } from './components/StudioSubmit'`, et la route `<Route path="/soumettre-contenu" element={<PhotoSubmit />} />` par `element={<StudioSubmit />}`.

- [ ] **Step 2 : Supprimer l'ancien composant (D1 — drop le mort)**
```bash
git rm apps/hub/src/components/PhotoSubmit.tsx
```
Vérifier qu'aucun autre import ne le référence : `grep -rn "PhotoSubmit" apps/hub/src` → ne doit rester que d'éventuelles mentions supprimées. *(PublicForm.css peut rester : encore utilisé par `ReviewSubmit.tsx`.)*

- [ ] **Step 3 : Build**
Run: `cd apps/hub && npx tsc --noEmit && pnpm build`
Expected: tsc 0 nouvelle erreur (4 préexistantes tolérées), build OK.

- [ ] **Step 4 : Déployer**
Run: `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`
Expected: live.

- [ ] **Step 5 : Smoke e2e réel** — sur `https://hub.runesdechene.com/soumettre-contenu` (et `?quete=test-xyz`) : parcourir les 4 étapes (drop 2-3 fichiers, tailles dont une « Aucun produit », mot + département, prénom/email/consentements), envoyer. Vérifier via MCP `execute_sql` : la soumission a `departement`/`quest_ref`, les images ont `size` (dont `'none'`), l'écran de fin + (si compte neuf) le badge bienvenue s'affichent. Puis nettoyer la soumission de test.

- [ ] **Step 6 : Doc** — `apps/hub/CLAUDE.md` : noter que `/soumettre-contenu` est désormais le **studio guidé** (`StudioSubmit.tsx`, wizard 4 étapes), `PhotoSubmit.tsx` supprimé.
```bash
git add apps/hub/src/App.tsx apps/hub/CLAUDE.md
git commit -m "feat(ugc): bascule /soumettre-contenu vers le studio + drop PhotoSubmit (brique 1bis-B)"
```

---

## Self-Review

**Spec coverage** (vs 2026-05-26-ugc-brique1bis + maquette v6) :
- D4 wizard 4 étapes (drop / tailles+aucun produit / histoire+dept / toi) → Tasks 2-3. ✅
- D3 « aucun produit » = `size='none'` → Task 2 (`NO_PRODUCT`) + Task 1 (`add_submission_image` p_size). ✅
- D5 pré-câblage quête (`?quete=` → `p_quest_ref`) → Task 2 (`questRef`) + Task 1 (`create_photo_submission` p_quest_ref). ✅
- Département liste optionnelle → Task 2 (`DEPARTEMENTS`, option vide). ✅
- D6 esthétique parchemin/landing (console 2 colonnes, titre Bebas, tracker, fond image, mobile empilé) → Tasks 3-4. ✅
- Drop le mort (PhotoSubmit) → Task 5. ✅
- Hors périmètre : système quête (Phase 2), surfaces d'affichage (Brique 2). ✅

**Placeholder scan** : `<SID>`/`<IMG>` = valeurs de test à substituer. Le `renderStudio({...})` de Task 2 est explicitement remplacé par le JSX inline en Task 3 (pas un trou — transition documentée). Pas de TODO de logique.

**Type consistency** : `sizes: (string|null)[]` ↔ `p_size` (text nullable) ↔ colonne `size`. `NO_PRODUCT='none'` ↔ sentinelle SQL `'none'` (mig 176/177). Params RPC (`p_departement/p_quest_ref/p_size`) cohérents migration ↔ composant. `get_studio_config` renvoie `{bg_image_url, aside_image_url, welcome_crowns}` ↔ lecture dans `useEffect`. ✅
