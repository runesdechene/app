# Bannière Collection — Home page explore-web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une bannière de promotion de collections Shopify sur la home page explore-web, configurable depuis le hub, en rotation aléatoire parmi les bannières actives.

**Architecture:** Nouvelle table `home_banners` dédiée + RPC `get_random_home_banner()` ; nouveau composant hub `Banners.tsx` (CRUD + upload bucket `home-banners`) ; nouveau composant explore-web `HomeBannerCard.tsx` (layout full-bleed image + texte overlay) inséré en première section de `HomePage.tsx`.

**Tech Stack:** Supabase (Postgres + Storage), React 18 + Vite + TypeScript strict, react-router-dom, CSS global thème parchemin.

**Spec source:** `docs/superpowers/specs/2026-05-10-home-banner-collection-design.md`

---

## File Structure

| Fichier | Type | Responsabilité |
|---|---|---|
| `supabase/migrations/159_home_banners.sql` | Create | Table + RLS + RPC |
| `apps/hub/src/components/Banners.tsx` | Create | Page admin CRUD bannières (~200 lignes) |
| `apps/hub/src/App.tsx` | Modify | Route `/carte/bannieres` |
| `apps/hub/src/components/Sidebar.tsx` | Modify | NavLink dans section "La Carte" |
| `apps/explore-web/src/components/home/HomeBannerCard.tsx` | Create | Composant bannière (fetch + render layout B) |
| `apps/explore-web/src/components/home/HomeBannerCard.css` | Create | Styles full-bleed |
| `apps/explore-web/src/pages/HomePage.tsx` | Modify | Insertion conditionnelle de la `<section>` |

**Action manuelle Uriel** (avant Task 3) : créer le bucket Supabase `home-banners` (public read).

---

## Task 1 — Migration SQL : table `home_banners` + RPC

**Files:**
- Create: `supabase/migrations/159_home_banners.sql`

- [ ] **Step 1 : Écrire le fichier migration**

Contenu de `supabase/migrations/159_home_banners.sql` :

```sql
-- 159_home_banners.sql
-- Table des bannières marketing affichées sur la home page explore-web.
-- Distinct de ad_screens (publicités plein écran à l'entrée carte) :
-- ici la bannière est passive, le user la voit en scrollant la home.
-- Voir docs/superpowers/specs/2026-05-10-home-banner-collection-design.md

CREATE TABLE public.home_banners (
  id          BIGSERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  link_url    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Lecture publique des bannières actives (consommée par get_random_home_banner)
CREATE POLICY "home_banners read active" ON public.home_banners
  FOR SELECT USING (active = true);

-- CRUD admin via service_role côté hub (pas de policy write : seul service_role bypasse RLS)

CREATE OR REPLACE FUNCTION public.get_random_home_banner()
RETURNS JSONB
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id',       id,
    'imageUrl', image_url,
    'title',    title,
    'subtitle', subtitle,
    'linkUrl',  link_url
  )
  FROM public.home_banners
  WHERE active = true
  ORDER BY random()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_home_banner() TO anon, authenticated;
```

- [ ] **Step 2 : Appliquer la migration en prod**

Run depuis `C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/` :

```bash
pnpm dlx supabase db push
```

Expected output : `Applied migration 159_home_banners.sql`. La RPC `get_random_home_banner` apparaît dans Supabase Studio > Database > Functions.

- [ ] **Step 3 : Vérifier en SQL Studio**

Coller dans le SQL editor Supabase Studio :

```sql
SELECT public.get_random_home_banner();
```

Expected : `null` (aucune bannière insérée encore — comportement attendu).

```sql
INSERT INTO public.home_banners (image_url, title, subtitle, link_url, active)
VALUES ('https://placehold.co/800x300/2a221c/c9893f?text=Test',
        'Collection Test',
        'Sous-titre test',
        'https://runesdechene.com/collections/all',
        true);

SELECT public.get_random_home_banner();
```

Expected : un JSON avec les 5 champs (`id`, `imageUrl`, `title`, `subtitle`, `linkUrl`).

Cleanup :

```sql
DELETE FROM public.home_banners WHERE title = 'Collection Test';
```

- [ ] **Step 4 : Commit**

```bash
git add "supabase/migrations/159_home_banners.sql"
git commit -m "feat(db): add home_banners table + get_random_home_banner RPC"
```

---

## Task 2 — Action manuelle Uriel : bucket Supabase

**Pas de fichier à toucher — étape de configuration cloud.**

- [ ] **Step 1 : Créer le bucket dans Supabase Studio**

Dans Supabase Studio > Storage > "New bucket" :
- Name : `home-banners`
- Public bucket : ✅ **oui** (les images doivent être lisibles par tous les users de l'app)
- File size limit : 5 MB (recommandé)
- Allowed MIME types : `image/jpeg, image/png, image/webp`

- [ ] **Step 2 : Vérifier l'accès public**

Uploader un fichier test via Studio, copier l'URL publique, l'ouvrir dans un navigateur en navigation privée. Expected : l'image s'affiche.

Supprimer le fichier test ensuite.

- [ ] **Step 3 : Confirmer à voix haute pour la suite**

Cette tâche n'est pas commitée (config cloud). Marquer cochée quand le bucket est en place.

---

## Task 3 — Hub : composant `Banners.tsx`

**Files:**
- Create: `apps/hub/src/components/Banners.tsx`

- [ ] **Step 1 : Créer `apps/hub/src/components/Banners.tsx`**

Contenu complet :

```tsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface HomeBanner {
  id: number
  image_url: string
  title: string
  subtitle: string | null
  link_url: string
  active: boolean
}

export function Banners() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [savedBanners, setSavedBanners] = useState<HomeBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasChanges = JSON.stringify(banners) !== JSON.stringify(savedBanners)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) {
        setBanners(data as HomeBanner[])
        setSavedBanners(JSON.parse(JSON.stringify(data)))
      }
    } catch (err) {
      console.error('[Banners] fetchAll failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)

    const ext = file.name.split('.').pop() || 'webp'
    const path = `banner-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('home-banners')
      .upload(path, file, { contentType: file.type })

    if (upErr) {
      alert(`Erreur upload: ${upErr.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('home-banners').getPublicUrl(path)
    const imageUrl = urlData.publicUrl

    const { data, error } = await supabase
      .from('home_banners')
      .insert({ image_url: imageUrl, title: '', link_url: '' })
      .select()
      .single()

    if (!error && data) {
      const newRow = data as HomeBanner
      setBanners(prev => [newRow, ...prev])
      setSavedBanners(prev => [newRow, ...prev])
    }
    setUploading(false)
  }

  function update(id: number, field: keyof HomeBanner, value: string | boolean | null) {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const promises = []
      for (const b of banners) {
        const saved = savedBanners.find(s => s.id === b.id)
        if (!saved || JSON.stringify(b) === JSON.stringify(saved)) continue
        promises.push(supabase.from('home_banners').update({
          title: b.title,
          subtitle: b.subtitle,
          link_url: b.link_url,
          active: b.active,
        }).eq('id', b.id).then(() => {}))
      }
      await Promise.all(promises)
      await fetchAll()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setBanners(JSON.parse(JSON.stringify(savedBanners)))
    setSaveError(null)
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer cette bannière ?')) return
    const banner = banners.find(b => b.id === id)
    if (banner) {
      const fileName = banner.image_url.split('/').pop()?.split('?')[0]
      if (fileName) {
        await supabase.storage.from('home-banners').remove([fileName])
      }
    }
    const { error } = await supabase.from('home_banners').delete().eq('id', id)
    if (!error) {
      setBanners(prev => prev.filter(b => b.id !== id))
      setSavedBanners(prev => prev.filter(b => b.id !== id))
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  const activeCount = banners.filter(b => b.active).length

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Bannières Collection</h1>
        <button
          className="faction-create-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Upload...' : '+ Ajouter une bannière'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      <p style={{ color: '#666', marginBottom: 16 }}>
        {activeCount} active{activeCount > 1 ? 's' : ''} / {banners.length} total — rotation aléatoire sur la home explore-web.
      </p>

      <div className="pub-screens-grid">
        {banners.map(b => (
          <div key={b.id} className={`pub-screen-card${b.active ? '' : ' inactive'}`}>
            <img src={b.image_url} alt="" className="pub-screen-img" />
            <div className="pub-screen-fields">
              <input
                type="text"
                placeholder="Titre (ex: Collection Equinoxe)"
                value={b.title}
                onChange={e => update(b.id, 'title', e.target.value)}
                className="pub-screen-field-input"
              />
              <input
                type="text"
                placeholder="Sous-titre (optionnel)"
                value={b.subtitle ?? ''}
                onChange={e => update(b.id, 'subtitle', e.target.value || null)}
                className="pub-screen-field-input"
              />
              <input
                type="text"
                placeholder="Lien collection (URL)"
                value={b.link_url}
                onChange={e => update(b.id, 'link_url', e.target.value)}
                className="pub-screen-field-input"
              />
              <div className="pub-screen-actions">
                <button
                  className={`pub-toggle-btn${b.active ? ' active' : ''}`}
                  onClick={() => update(b.id, 'active', !b.active)}
                >
                  {b.active ? 'Active' : 'Inactive'}
                </button>
                <button className="pub-delete-btn" onClick={() => handleDelete(b.id)}>&#10005;</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <p style={{ color: '#666', marginTop: 24 }}>
          Aucune bannière. Clique "+ Ajouter une bannière" pour démarrer.
        </p>
      )}

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
```

- [ ] **Step 2 : Ajouter la route dans `apps/hub/src/App.tsx`**

Modification 1 — ajout de l'import (après ligne 20 `import { Ads }`):

```tsx
import { Ads } from './components/Ads'
import { Banners } from './components/Banners'
```

Modification 2 — ajout de la route (après ligne 93 `<Route path="/carte/publicites" element={<Ads />} />`) :

```tsx
<Route path="/carte/publicites" element={<Ads />} />
<Route path="/carte/bannieres" element={<Banners />} />
```

- [ ] **Step 3 : Ajouter le NavLink dans `apps/hub/src/components/Sidebar.tsx`**

Insérer après la ligne `<NavLink to="/carte/publicites">Publicites</NavLink>` (ligne 59-61) :

```tsx
<NavLink to="/carte/publicites" className={({ isActive }) => isActive ? 'active' : ''}>
  Publicites
</NavLink>
<NavLink to="/carte/bannieres" className={({ isActive }) => isActive ? 'active' : ''}>
  Bannières
</NavLink>
```

- [ ] **Step 4 : Build hub pour vérifier la compil**

```bash
pnpm --filter hub build
```

Expected : `✓ built in Xs` sans erreur TS.

- [ ] **Step 5 : Test manuel en dev**

```bash
pnpm --filter hub dev
```

Ouvrir `http://localhost:3001` (login admin) → cliquer "Bannières" dans la sidebar.

Expected :
- Page "Bannières Collection" s'affiche
- "Aucune bannière. Clique '+ Ajouter une bannière' pour démarrer."
- Cliquer "+ Ajouter une bannière" → sélectionner une image → image s'upload, card apparaît avec champs vides
- Remplir titre / sous-titre / URL / cliquer "Inactive" → "Active"
- SaveBar apparaît en bas → cliquer Save → champs persistés (re-fetch)
- Cliquer "✕" sur la card → confirmation → suppression OK

- [ ] **Step 6 : Commit**

```bash
git add apps/hub/src/components/Banners.tsx apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "feat(hub): add Banners admin page for home page banners"
```

---

## Task 4 — Explore-web : composant `HomeBannerCard`

**Files:**
- Create: `apps/explore-web/src/components/home/HomeBannerCard.tsx`
- Create: `apps/explore-web/src/components/home/HomeBannerCard.css`

**Note design** : le composant gère lui-même son rendu conditionnel — il retourne `null` quand aucune bannière active n'est servie par la RPC, et wrappe son contenu dans `<section className="home-section">` quand elle est présente. Cela évite à `HomePage` de devoir gérer un state `hasBanner` (le composant est self-contained).

- [ ] **Step 1 : Créer `apps/explore-web/src/components/home/HomeBannerCard.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './HomeBannerCard.css'

interface Banner {
  id: number
  imageUrl: string
  title: string
  subtitle: string | null
  linkUrl: string
}

export function HomeBannerCard() {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_random_home_banner').then(({ data }) => {
      if (cancelled) return
      setBanner((data as Banner | null) ?? null)
    })
    return () => { cancelled = true }
  }, [])

  if (!banner) return null

  function handleClick() {
    window.open(banner!.linkUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="home-section">
      <button type="button" className="home-banner-card" onClick={handleClick}>
        <img src={banner.imageUrl} alt="" className="home-banner-card-img" />
        <div className="home-banner-card-overlay" aria-hidden />
        <div className="home-banner-card-text">
          <span className="home-banner-card-tag">Boutique</span>
          <span className="home-banner-card-title">{banner.title}</span>
          {banner.subtitle && (
            <span className="home-banner-card-sub">{banner.subtitle}</span>
          )}
        </div>
      </button>
    </section>
  )
}
```

- [ ] **Step 2 : Créer `apps/explore-web/src/components/home/HomeBannerCard.css`**

```css
.home-banner-card {
  width: 100%;
  height: 110px;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--color-sepia);
  box-shadow: 0 4px 14px rgba(74, 55, 40, 0.18);
  cursor: pointer;
  background: transparent;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: block;
}

.home-banner-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(74, 55, 40, 0.24);
}

.home-banner-card:active {
  transform: scale(0.99);
}

.home-banner-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.home-banner-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(15,10,5,0.85) 0%, rgba(15,10,5,0.5) 60%, rgba(15,10,5,0.2) 100%);
}

.home-banner-card-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px 20px;
  gap: 4px;
  text-align: left;
}

.home-banner-card-tag {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-sepia);
  font-weight: 700;
  font-family: var(--font-accent);
  text-shadow: 0 1px 3px rgba(0,0,0,0.85);
}

.home-banner-card-title {
  font-size: 20px;
  color: #fff;
  font-family: var(--font-title);
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.15;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}

.home-banner-card-sub {
  font-size: 13px;
  color: #f0e4cc;
  line-height: 1.3;
  font-style: italic;
  font-family: var(--font-signature);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
```

- [ ] **Step 3 : Build explore-web pour vérifier la compil TypeScript**

```bash
pnpm --filter explore-web build
```

Expected : `✓ built in Xs` sans erreur TS. (À ce stade le composant existe mais n'est pas encore importé — pas de regression.)

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/components/home/HomeBannerCard.tsx apps/explore-web/src/components/home/HomeBannerCard.css
git commit -m "feat(explore-web): add HomeBannerCard component"
```

---

## Task 5 — Intégration dans `HomePage.tsx`

**Files:**
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

`HomeBannerCard` étant self-contained (il retourne `null` ou son propre wrapper `<section>`), l'intégration est triviale : un import + une ligne JSX en tête de `<main>`.

- [ ] **Step 1 : Ajouter l'import**

Dans `apps/explore-web/src/pages/HomePage.tsx`, après l'import existant `import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'` (ligne 4) :

```tsx
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { HomeBannerCard } from '../components/home/HomeBannerCard'
```

- [ ] **Step 2 : Insérer `<HomeBannerCard />` en tête du scroll**

Dans le `return`, juste après `<main className="home-page-scroll">` (ligne 62), AVANT la première section existante `DailyEnigmaCard` :

```tsx
return (
  <>
    <main className="home-page-scroll">
      <HomeBannerCard />

      <section className="home-section">
        <DailyEnigmaCard
          onOpen={() => setShowDailyEnigma(true)}
          onOpenFragment={(f) => setFragmentEnigma(f)}
          refreshKey={enigmaRefreshKey}
        />
      </section>
      {/* ... reste inchangé ... */}
```

Pas de state à gérer côté `HomePage` — `HomeBannerCard` retourne `null` quand pas de bannière (DOM propre, pas de section vide).

- [ ] **Step 3 : Build explore-web pour vérifier**

```bash
pnpm --filter explore-web build
```

Expected : `✓ built in Xs` sans erreur TS.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(explore-web): integrate HomeBannerCard at top of home page"
```

---

## Task 6 — Test end-to-end en dev

**Files:** aucun (test manuel)

- [ ] **Step 1 : Lancer hub + explore-web en parallèle**

Terminal 1 :
```bash
pnpm --filter hub dev
```

Terminal 2 :
```bash
pnpm --filter explore-web dev
```

- [ ] **Step 2 : Cas A — pas de bannière active**

Vérifier d'abord que `home_banners` est vide ou toutes inactives :
```sql
-- Dans Supabase Studio SQL editor
SELECT id, title, active FROM public.home_banners;
```

Ouvrir `http://localhost:5173/accueil` (explore-web). Expected :
- Pas de section bannière en haut
- `DailyEnigmaCard` reste la première section visible
- Pas de saut visuel ni d'espace réservé inutile

- [ ] **Step 3 : Cas B — 1 bannière active**

Dans le hub (`http://localhost:3001/carte/bannieres`), créer 1 bannière :
- Image : n'importe quel JPG/PNG/WEBP < 5 Mo
- Titre : "Collection Equinoxe"
- Sous-titre : "Découvre les nouveaux t-shirts"
- URL : `https://runesdechene.com/collections/all`
- Toggle "Active"
- Save

Recharger la home explore-web. Expected :
- Bannière full-bleed en première position, ~110px de hauteur
- Image visible avec gradient noir-à-droite
- "BOUTIQUE" en sépia uppercase à gauche
- Titre en blanc capitales
- Sous-titre en italique blanc/crème
- Click → ouvre `runesdechene.com/collections/all` dans un nouvel onglet, l'app PWA reste sur `/accueil`

- [ ] **Step 4 : Cas C — 3 bannières actives, rotation**

Créer 2 bannières supplémentaires (titres distinguables : "A", "B", "C"). Toutes actives.

Recharger la home 5-6 fois — chaque reload doit potentiellement servir une bannière différente. Sur 6 reloads avec 3 bannières, on attend ~2 occurrences de chacune (loi des grands nombres ; pas garanti à coup sûr).

- [ ] **Step 5 : Cas D — toggle inactif retire la bannière**

Dans le hub, mettre la bannière "A" inactive, save. Recharger la home plusieurs fois — "A" ne doit plus apparaître. Si seule "A" était active et qu'on la désactive sans en avoir d'autre actives → retour cas A.

- [ ] **Step 6 : Cas E — suppression cleanup storage**

Dans le hub, supprimer la bannière "A" (✕). Confirmer. Vérifier dans Supabase Studio > Storage > `home-banners` que le fichier `banner-XXXX.webp` correspondant a bien été supprimé.

- [ ] **Step 7 : Cleanup test data**

Désactiver ou supprimer les 3 bannières de test pour que la prod parte propre quand tu déploieras.

```sql
DELETE FROM public.home_banners WHERE title IN ('A', 'B', 'C', 'Collection Equinoxe');
```

(Et le storage cleanup associé via le hub si tu n'as pas tout supprimé via UI.)

- [ ] **Step 8 : Confirmer "tests OK" en commentaire**

Pas de commit — juste valider mentalement / verbalement à Uriel que tous les cas A→E passent avant deploy.

---

## Self-Review checklist

**Spec coverage** :
- ✅ Schema DB → Task 1
- ✅ Bucket → Task 2
- ✅ Hub admin (Banners.tsx + sidebar + route) → Task 3
- ✅ HomeBannerCard component → Task 4
- ✅ HomePage integration → Task 5
- ✅ Tous les critères de complétion du spec couverts par Task 6

**Pattern existants suivis** :
- `Banners.tsx` calque `Ads.tsx` (state, fetchAll, SaveBar, deleteWithStorage)
- Classes CSS `pub-*` réutilisées dans le hub (déjà stylées dans `Ads.css` ou globales)
- `HomeBannerCard.tsx` calque `DailyEnigmaCard.tsx` (vars CSS, style, fetch RPC)
- Migration numérotée `159_*` suit la séquence existante
- Conventional commits

**Hors-scope respecté** :
- Pas de scheduling temporel
- Pas de tracking
- Pas d'anti-répétition
- Pas de refresh auto

---

## Déploiement (à la fin, en bloc cohérent)

Une fois Task 6 validé, déploiement en lot :

```bash
# Hub
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/hub"
netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build

# Explore-web (commande à confirmer dans apps/explore-web/CLAUDE.md)
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm --filter explore-web build
cd apps/explore-web
netlify deploy --prod --dir "$PWD/dist" --no-build
```

Push git en fin de session :

```bash
git push origin <branch-courante>
```
