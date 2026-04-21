# Partage de lieux — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton Partager sur les fiches de lieu (PlacePanel de l'app + SEO Pages), avec texte pré-rempli éditable depuis le hub.

**Architecture:** Le template de partage est stocké dans la table `app_settings` existante (clé/valeur). Le hub offre l'édition. L'app explore-web fetch au runtime (Zustand). La SEO Page fetch au build-time (pipeline nightly). Le click déclenche `navigator.share()` sur mobile, clipboard + toast sur desktop.

**Tech Stack:** Supabase (Postgres + RLS), React 18 + Zustand (explore-web & hub), Node.js TS vanilla (seo-pages).

**Spec:** `docs/superpowers/specs/2026-04-21-partage-lieux-design.md`

**Règle spéciale:** Pas de framework de tests automatisés dans ce projet. Chaque tâche inclut un **test manuel documenté**. TDD ne s'applique pas — on fait "implémentation minimale + test manuel + commit".

---

## File Structure

**Nouveaux fichiers :**
- `supabase/migrations/092_share_text_template.sql` — insert une ligne dans `app_settings`
- `apps/explore-web/src/stores/appConfigStore.ts` — Zustand store pour configs app-wide
- `apps/explore-web/src/components/places/ShareButton.tsx` — composant React du bouton
- `apps/explore-web/src/components/places/ShareButton.css` — styles bouton
- `apps/seo-pages/src/lib/appSettings.ts` — fetch helper build-time

**Fichiers modifiés :**
- `apps/hub/src/components/Settings.tsx` — ajout section "Partage social"
- `apps/explore-web/src/components/places/PlacePanel.tsx` — intégration du ShareButton (DiscoveredPlaceContent + FoggedPlaceView)
- `apps/seo-pages/src/build.ts` — fetch `share_text_template` + pass to renderPage
- `apps/seo-pages/src/templates/page.ts` — propage `shareTextTemplate` et place aux sous-templates
- `apps/seo-pages/src/templates/header.ts` — accepte des params + affiche le bouton + script JS

---

## Task 1: Migration SQL — share_text_template

**Files:**
- Create: `supabase/migrations/092_share_text_template.sql`

- [ ] **Step 1: Créer la migration**

Créer le fichier `supabase/migrations/092_share_text_template.sql` avec ce contenu exact :

```sql
-- Migration 092: Template de partage éditable depuis le hub
-- Ajoute la clé 'share_text_template' dans app_settings (table key/value).
-- La valeur est un string avec placeholder {name} remplacé côté client par le nom du lieu.

insert into public.app_settings (key, value)
values (
  'share_text_template',
  'Un trésor oublié t''attend sur Runes de Chêne. Viens explorer {name}.'
)
on conflict (key) do nothing;
```

- [ ] **Step 2: Appliquer la migration en DB**

Run: `npx supabase db push` depuis la racine du monorepo.

Expected: migration 092 appliquée, output contient `Applying migration 092_share_text_template.sql`.

- [ ] **Step 3: Vérifier en DB**

Via Supabase Studio ou psql :

```sql
select key, value from public.app_settings where key = 'share_text_template';
```

Expected: une ligne retournée avec value = `Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}.`

- [ ] **Step 4: Commit**

```bash
git -C "$REPO" add supabase/migrations/092_share_text_template.sql
git -C "$REPO" commit -m "feat(db): migration 092 — share_text_template dans app_settings"
git -C "$REPO" push
```

---

## Task 2: Store Zustand `appConfigStore`

**Files:**
- Create: `apps/explore-web/src/stores/appConfigStore.ts`

**Context:** Le projet utilise Zustand. Regarder un store existant pour le pattern (ex. `apps/explore-web/src/stores/playerStore.ts` ou `toastStore.ts`). Import `supabase` depuis `../lib/supabase`.

- [ ] **Step 1: Créer le store**

Créer `apps/explore-web/src/stores/appConfigStore.ts` avec ce contenu :

```ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Fallback hardcodé utilisé si le fetch échoue (DB down, offline, etc.)
// Doit rester identique à la valeur par défaut insérée par la migration 092.
const FALLBACK_SHARE_TEMPLATE = "Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}."

interface AppConfigStore {
  shareTextTemplate: string
  loaded: boolean
  fetchConfig: () => Promise<void>
}

export const useAppConfigStore = create<AppConfigStore>((set) => ({
  shareTextTemplate: FALLBACK_SHARE_TEMPLATE,
  loaded: false,
  fetchConfig: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['share_text_template'])
    
    if (error || !data) {
      set({ loaded: true })
      return
    }
    
    const share = data.find(r => r.key === 'share_text_template')?.value
    set({
      shareTextTemplate: share ?? FALLBACK_SHARE_TEMPLATE,
      loaded: true,
    })
  },
}))
```

- [ ] **Step 2: Appeler fetchConfig au démarrage de l'app**

Ouvrir `apps/explore-web/src/App.tsx` et ajouter un `useEffect` qui appelle `useAppConfigStore.getState().fetchConfig()` une fois au mount.

Chercher un bloc existant qui fait du fetch au mount (style `useEffect(() => { ... }, [])`) et ajouter l'appel à côté. Si aucun pattern similaire n'existe, ajouter :

```tsx
// Dans App.tsx, près des autres useEffect au top-level :
useEffect(() => {
  useAppConfigStore.getState().fetchConfig()
}, [])
```

Ne pas oublier l'import : `import { useAppConfigStore } from './stores/appConfigStore'`.

- [ ] **Step 3: Test manuel**

Run: `pnpm dev` depuis la racine.

Ouvrir `http://localhost:3000` avec DevTools console ouverte.

Expected:
- Aucune erreur en console.
- Dans la console, taper : `useAppConfigStore.getState()` → retourne un objet avec `shareTextTemplate` non-null et `loaded: true`.
- La valeur de `shareTextTemplate` doit commencer par "Un trésor oublié".

- [ ] **Step 4: Commit**

```bash
git -C "$REPO" add apps/explore-web/src/stores/appConfigStore.ts apps/explore-web/src/App.tsx
git -C "$REPO" commit -m "feat(app): store appConfigStore + fetch share_text_template au boot"
git -C "$REPO" push
```

---

## Task 3: Composant ShareButton (React)

**Files:**
- Create: `apps/explore-web/src/components/places/ShareButton.tsx`
- Create: `apps/explore-web/src/components/places/ShareButton.css`

**Context:** Le projet n'utilise pas de lib d'icônes tierce. SVG inline uniquement. Voir `WishlistButton.tsx` pour le pattern de bouton dans `PlacePanel`. Utiliser `useToastStore` existant pour le toast de confirmation.

- [ ] **Step 1: Créer le CSS**

Créer `apps/explore-web/src/components/places/ShareButton.css` :

```css
.share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  cursor: pointer;
  color: #4A3728;
  transition: background 0.15s ease, transform 0.1s ease;
}

.share-btn:hover {
  background: rgba(255, 255, 255, 1);
}

.share-btn:active {
  transform: scale(0.95);
}

.share-btn svg {
  width: 20px;
  height: 20px;
}
```

- [ ] **Step 2: Créer le composant**

Créer `apps/explore-web/src/components/places/ShareButton.tsx` :

```tsx
import { useAppConfigStore } from '../../stores/appConfigStore'
import { useToastStore } from '../../stores/toastStore'
import './ShareButton.css'

interface ShareButtonProps {
  placeName: string
  placeSlug: string | null
}

export function ShareButton({ placeName, placeSlug }: ShareButtonProps) {
  const template = useAppConfigStore(s => s.shareTextTemplate)
  const addToast = useToastStore.getState().addToast

  // Pas de slug = lieu sans SEO Page → on masque le bouton
  if (!placeSlug) return null

  async function handleShare() {
    const text = template.replace('{name}', placeName)
    const url = `https://carte.runesdechene.com/lieu/${placeSlug}`
    const payload = { title: placeName, text, url }

    try {
      if (navigator.share) {
        await navigator.share(payload)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        addToast({
          type: 'info',
          message: 'Lien copié ✓',
          timestamp: Date.now(),
        })
      } else {
        addToast({
          type: 'info',
          message: url,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      // AbortError = user a fermé le share sheet, pas une erreur
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast({
          type: 'error',
          message: 'Échec du partage',
          timestamp: Date.now(),
        })
      }
    }
  }

  return (
    <button
      className="share-btn"
      onClick={handleShare}
      aria-label="Partager ce lieu"
      title="Partager"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  )
}
```

**⚠️ Vérification types :** Avant de passer à l'étape suivante, vérifier que `useToastStore.getState().addToast` accepte bien le payload `{ type, message, timestamp }`. Lire `apps/explore-web/src/stores/toastStore.ts` pour confirmer la signature. Si elle diffère (ex. `type: 'revisit' | 'discovery'` sans `'info'`), adapter le type utilisé pour coller à l'existant. Regarder aussi les autres call sites de `addToast` pour trouver un type approprié (ex. `'info'` peut être remplacé par un type existant).

- [ ] **Step 3: Test isolé (pas d'intégration encore)**

Il n'y a pas de test unitaire dans ce projet. On valide à l'étape suivante (Task 4) via l'intégration dans PlacePanel.

- [ ] **Step 4: Commit**

```bash
git -C "$REPO" add apps/explore-web/src/components/places/ShareButton.tsx apps/explore-web/src/components/places/ShareButton.css
git -C "$REPO" commit -m "feat(app): composant ShareButton (navigator.share + fallback clipboard)"
git -C "$REPO" push
```

---

## Task 4: Intégration ShareButton dans PlacePanel

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

**Context:** Le PlacePanel a deux vues : `DiscoveredPlaceContent` (lieu découvert, gros fichier, header contient un bouton `place-hero-close` à la ligne ~667) et `FoggedPlaceView` (lieu brouillard, dans `FoggedPlaceView.tsx`). Le bouton Partager doit apparaître dans **les deux** — on partage autant un lieu qu'on a découvert qu'un lieu brouillard.

- [ ] **Step 1: Lire l'existant**

Lire :
- `apps/explore-web/src/components/places/PlacePanel.tsx` autour de la ligne 665-680 pour voir comment `place-hero-close` est rendu (header du panel).
- `apps/explore-web/src/components/places/FoggedPlaceView.tsx` en entier (petit fichier) pour repérer la même zone header.

Noter la structure JSX exacte : probablement un `<div>` avec plusieurs boutons en pill. On va ajouter `<ShareButton>` à gauche immédiate du bouton close.

- [ ] **Step 2: Ajouter l'import dans PlacePanel.tsx**

En haut du fichier, ajouter :

```tsx
import { ShareButton } from './ShareButton'
```

- [ ] **Step 3: Insérer ShareButton dans DiscoveredPlaceContent**

Localiser la ligne `<button onClick={onClose} className="place-hero-pill place-hero-close" aria-label="Fermer">` (autour de la ligne 667).

Insérer **juste avant** ce bouton :

```tsx
<ShareButton placeName={place.title} placeSlug={place.slug} />
```

**Vérifier** que `place.slug` existe dans le type `PlaceDetail`. Si non, lire `apps/explore-web/src/hooks/usePlace.ts` pour voir si le slug est fetché. Si le slug n'est pas dans le type/query, ajouter sa sélection dans le SELECT Supabase (la colonne `places.slug` existe depuis la migration 091).

- [ ] **Step 4: Insérer ShareButton dans FoggedPlaceView**

Même principe : localiser le header du FoggedPlaceView (zone avec le bouton fermer), ajouter `<ShareButton placeName={place.title} placeSlug={place.slug} />` à sa gauche.

- [ ] **Step 5: Test manuel dans l'app**

Run: `pnpm dev` puis ouvrir `http://localhost:3000` sur desktop.

Scénarios à valider (tous doivent passer) :

1. **Lieu découvert, desktop Chrome** : cliquer sur une épingle déjà découverte → PlacePanel s'ouvre → icône de partage visible dans le header à gauche du bouton fermer.
2. **Click bouton** : sur desktop, l'URL doit être copiée dans le presse-papier + toast "Lien copié ✓" apparaît.
3. **Paste URL dans un nouvel onglet** : URL au format `https://carte.runesdechene.com/lieu/<slug>`, ouvre bien la SEO Page.
4. **Lieu brouillard** : cliquer sur un lieu non découvert → FoggedPlaceView s'ouvre → icône de partage présente aussi.
5. **Mobile (via DevTools device emulation ou vrai mobile)** : click bouton → share sheet natif s'ouvre avec WhatsApp/SMS/Insta pré-remplis avec le texte "Un trésor oublié t'attend sur Runes de Chêne. Viens explorer [Nom du lieu]." et l'URL.

Si un scénario échoue, déboguer avant de passer au commit.

- [ ] **Step 6: Commit**

```bash
git -C "$REPO" add apps/explore-web/src/components/places/PlacePanel.tsx apps/explore-web/src/components/places/FoggedPlaceView.tsx apps/explore-web/src/hooks/usePlace.ts
git -C "$REPO" commit -m "feat(app): integre ShareButton dans PlacePanel (vues decouverte + brouillard)"
git -C "$REPO" push
```

*(Si `usePlace.ts` n'a pas été modifié, le retirer du git add.)*

---

## Task 5: Section "Partage social" dans hub Settings

**Files:**
- Modify: `apps/hub/src/components/Settings.tsx`

**Context:** Settings.tsx fait 909 lignes. Structure : chaque section est un `<div>` avec `<h3>`, description, inputs, bouton save local. State géré avec `useState`. Le fichier finit autour de la ligne 907-908 avec un `</div>` fermant le container principal. On insère notre nouvelle section **avant** ce `</div>` fermant, après la dernière section existante (enigmes).

Utiliser les classes CSS existantes : `settings-input`, `btn-primary`, `settings-global-row`, `settings-global-field`.

- [ ] **Step 1: Lire la fin du fichier**

Lire `apps/hub/src/components/Settings.tsx` de la ligne 880 à la fin pour confirmer le pattern de section existant et trouver l'emplacement exact d'insertion.

- [ ] **Step 2: Ajouter state et fonctions**

Près des autres `useState` (début du composant `Settings`, autour de la ligne 24-45), ajouter :

```tsx
// État pour le template de partage social
const [shareTemplate, setShareTemplate] = useState<string>('')
const [savingShareTemplate, setSavingShareTemplate] = useState(false)
```

Dans le `useEffect` qui charge les settings au mount (ou dans une fonction de load existante), ajouter la lecture :

```tsx
const { data: shareData } = await supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'share_text_template')
  .single()
if (shareData) setShareTemplate(shareData.value)
```

Ajouter la fonction de save (à côté des autres `saveXxx`) :

```tsx
async function saveShareTemplate() {
  setSavingShareTemplate(true)
  const { error } = await supabase
    .from('app_settings')
    .update({ value: shareTemplate, updated_at: new Date().toISOString() })
    .eq('key', 'share_text_template')
  setSavingShareTemplate(false)
  if (error) alert('Erreur : ' + error.message)
}
```

- [ ] **Step 3: Ajouter la section JSX**

Juste avant la ligne `</div>` qui ferme le container principal (vers la ligne 907), insérer :

```tsx
<div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 24 }}>
  <h3>Partage social</h3>
  <p className="divers-description">
    Texte pré-rempli quand un utilisateur partage un lieu depuis l'app ou la SEO Page.
    Utilise <code>{'{name}'}</code> pour insérer le nom du lieu. Le changement est instantané sur l'app ;
    la SEO Page se met à jour au prochain rebuild nightly (~24h max).
  </p>

  <label className="settings-global-field" style={{ width: '100%', maxWidth: 600 }}>
    <span>Template de partage</span>
    <textarea
      value={shareTemplate}
      onChange={e => setShareTemplate(e.target.value)}
      rows={3}
      className="settings-input"
      style={{ width: '100%', fontFamily: 'inherit' }}
    />
  </label>

  <div style={{ marginTop: 8, padding: 12, background: '#f7ede1', borderRadius: 6 }}>
    <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Aperçu :</strong>
    <em style={{ fontSize: 14 }}>
      {shareTemplate.replace('{name}', 'Abbaye de Fontenay') || '(template vide)'}
    </em>
  </div>

  <div style={{ marginTop: 12 }}>
    <button className="btn-primary" onClick={saveShareTemplate} disabled={savingShareTemplate}>
      {savingShareTemplate ? '...' : 'Sauvegarder'}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Test manuel dans le hub**

Run: `pnpm --filter hub dev` puis ouvrir `http://localhost:3001`.

Scénarios :

1. Se connecter en admin, aller sur la page Settings.
2. Scroller en bas → section "Partage social" présente.
3. Le champ textarea contient le template actuel (celui de la migration 092).
4. L'aperçu affiche : *"Un trésor oublié t'attend sur Runes de Chêne. Viens explorer Abbaye de Fontenay."*
5. Modifier le texte → l'aperçu se met à jour en live.
6. Cliquer "Sauvegarder" → bouton passe en "..." puis revient.
7. Reload la page → le nouveau texte est bien persisté.
8. Dans l'app explore-web (autre onglet), rafraîchir → tester un partage → le nouveau texte est utilisé.

- [ ] **Step 5: Commit**

```bash
git -C "$REPO" add apps/hub/src/components/Settings.tsx
git -C "$REPO" commit -m "feat(hub): section Partage social dans Settings (edit share_text_template)"
git -C "$REPO" push
```

---

## Task 6: Lib appSettings + intégration build SEO

**Files:**
- Create: `apps/seo-pages/src/lib/appSettings.ts`
- Modify: `apps/seo-pages/src/build.ts`
- Modify: `apps/seo-pages/src/templates/page.ts`

- [ ] **Step 1: Créer la lib appSettings**

Créer `apps/seo-pages/src/lib/appSettings.ts` :

```ts
import { supabase } from './supabase'

const FALLBACK_SHARE_TEMPLATE = "Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}."

export async function getShareTextTemplate(): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'share_text_template')
    .single()
  
  if (error || !data) {
    console.warn('[appSettings] Failed to fetch share_text_template, using fallback:', error?.message)
    return FALLBACK_SHARE_TEMPLATE
  }
  
  return data.value
}
```

- [ ] **Step 2: Modifier build.ts pour fetcher et passer le template**

Ouvrir `apps/seo-pages/src/build.ts`.

Ajouter l'import en haut :

```ts
import { getShareTextTemplate } from './lib/appSettings';
```

Dans `build()`, après le `console.log('Fetching places...');` et avant le `Promise.all`, modifier pour ajouter le fetch du template :

```ts
const [places, totalCount, shareTextTemplate] = await Promise.all([
  getAllPlacesWithSlugs(),
  getTotalPlaceCount(),
  getShareTextTemplate(),
]);
```

Passer `shareTextTemplate` à `renderPage` :

```ts
const html = renderPage({ place, contributions, nearby, placeCount, shareTextTemplate });
```

- [ ] **Step 3: Modifier page.ts pour propager shareTextTemplate**

Ouvrir `apps/seo-pages/src/templates/page.ts`.

Ajouter `shareTextTemplate: string` à l'interface `RenderPageInput`.

Extraire `shareTextTemplate` dans la signature de `renderPage({ place, contributions, nearby, placeCount, shareTextTemplate })`.

Modifier l'appel à `renderHeader()` (ligne 133) pour passer les params nécessaires :

```ts
${renderHeader({ placeName: place.title, placeSlug: place.slug, shareTextTemplate })}
```

- [ ] **Step 4: Test de build**

Run depuis `apps/seo-pages/` :

```bash
pnpm build
```

Expected: build complet, ~2600 pages en ~26s (comme avant). Regarder la console pour d'éventuels warnings sur `[appSettings]`. Aucune erreur TypeScript (tsc passe).

*Note : à cette étape, `header.ts` ne prend pas encore les params — on aura une erreur TS. C'est attendu, on corrige à la Task 7.*

- [ ] **Step 5: Commit (partiel — TS encore en erreur)**

Ne pas commit maintenant. Enchaîner directement sur la Task 7.

---

## Task 7: Bouton Partager dans template SEO (header.ts)

**Files:**
- Modify: `apps/seo-pages/src/templates/header.ts`

**Context:** Le template `header.ts` actuel est minimaliste (un `<nav>` avec logo + CTA). On y ajoute un bouton Partager entre les deux, avec un script JS vanilla inline pour le click handler. Pour le pattern JS inline, s'inspirer de `apps/seo-pages/src/templates/gallery.ts` (lightbox + events listeners inline).

- [ ] **Step 1: Lire gallery.ts pour le pattern JS inline**

Lire `apps/seo-pages/src/templates/gallery.ts` en entier pour voir comment le JS vanilla est injecté dans le HTML (balises `<script>` inline, gestion des events, animation de toast, etc.).

- [ ] **Step 2: Réécrire header.ts avec nouvelle signature**

Remplacer le contenu complet de `apps/seo-pages/src/templates/header.ts` par :

```ts
interface RenderHeaderInput {
  placeName: string
  placeSlug: string
  shareTextTemplate: string
}

export function renderHeader({ placeName, placeSlug, shareTextTemplate }: RenderHeaderInput): string {
  // Encode pour l'injection sûre dans data-attributes
  const shareText = shareTextTemplate.replace('{name}', placeName)
  const shareUrl = `https://carte.runesdechene.com/lieu/${placeSlug}`

  return `<nav class="nav">
  <a href="https://runesdechene.com" class="nav-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="eager"
    />
  </a>
  <div class="nav-actions">
    <button
      class="nav-share"
      type="button"
      data-share-title="${escapeAttr(placeName)}"
      data-share-text="${escapeAttr(shareText)}"
      data-share-url="${escapeAttr(shareUrl)}"
      aria-label="Partager ce lieu"
      title="Partager"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
    <a href="https://carte.runesdechene.com" class="nav-cta">Ouvrir l'application</a>
  </div>
</nav>

<div id="share-toast" class="share-toast" aria-live="polite"></div>

<script>
(function() {
  var btn = document.querySelector('.nav-share');
  var toast = document.getElementById('share-toast');
  if (!btn || !toast) return;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(function() { toast.classList.remove('visible'); }, 2200);
  }

  btn.addEventListener('click', async function() {
    var title = btn.getAttribute('data-share-title') || '';
    var text = btn.getAttribute('data-share-text') || '';
    var url = btn.getAttribute('data-share-url') || '';

    try {
      if (navigator.share) {
        await navigator.share({ title: title, text: text, url: url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Lien copié ✓');
      } else {
        showToast(url);
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        showToast('Échec du partage');
      }
    }
  });
})();
</script>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 3: Ajouter les styles CSS du bouton et du toast**

Ouvrir `apps/seo-pages/src/styles/global.css` et ajouter à la fin :

```css
/* Share button dans la nav transparente */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-share {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  color: #4A3728;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.nav-share:hover {
  background: rgba(255, 255, 255, 1);
}

.nav-share:active {
  transform: scale(0.95);
}

/* Toast de confirmation partage */
.share-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 12px 20px;
  background: #4A3728;
  color: #f7ede1;
  border-radius: 999px;
  font-size: 15px;
  font-family: 'Cabin', sans-serif;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 1000;
  max-width: calc(100vw - 48px);
  text-align: center;
}

.share-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
```

- [ ] **Step 4: Test de build**

Run depuis `apps/seo-pages/` :

```bash
pnpm build
```

Expected: build complet sans erreur TypeScript, ~2600 pages en ~26s.

- [ ] **Step 5: Test local du HTML généré**

Ouvrir un fichier de sortie, ex. `apps/seo-pages/dist/lieu/<un-slug>/index.html` dans un navigateur (ou servir avec `npx serve apps/seo-pages/dist`).

Scénarios :

1. Page chargée → nav en haut contient logo + bouton partager + CTA "Ouvrir l'application".
2. Click bouton partager (desktop) → toast "Lien copié ✓" apparaît en bas, disparaît après 2s.
3. URL bien dans le presse-papier → paste dans un nouvel onglet, ouvre la même page SEO.
4. Sur mobile réel (ou DevTools device emulation) → share sheet natif s'ouvre avec le texte pré-rempli.

- [ ] **Step 6: Commit (Task 6 + Task 7 ensemble)**

```bash
git -C "$REPO" add apps/seo-pages/src/lib/appSettings.ts apps/seo-pages/src/build.ts apps/seo-pages/src/templates/page.ts apps/seo-pages/src/templates/header.ts apps/seo-pages/src/styles/global.css
git -C "$REPO" commit -m "feat(seo): bouton Partager dans la nav avec navigator.share + fallback"
git -C "$REPO" push
```

---

## Task 8: Test manuel complet + deploy production

**Files:** (aucun code modifié — c'est la validation de bout en bout)

- [ ] **Step 1: Build local complet**

Run depuis la racine :

```bash
pnpm --filter explore-web build
pnpm --filter hub build
pnpm --filter seo-pages build
```

Expected: tous les 3 builds passent sans erreur.

- [ ] **Step 2: Test end-to-end en local**

Lancer les 3 apps en parallèle (3 terminaux) :

```bash
pnpm dev                      # terminal 1 — explore-web port 3000
pnpm --filter hub dev         # terminal 2 — hub port 3001
npx serve apps/seo-pages/dist # terminal 3 — SEO Pages statiques
```

Parcours complet :

1. **Hub** (localhost:3001) : modifier le template de partage, remplacer par *"[TEST] J'ai trouvé {name} sur Runes de Chêne, viens voir."* → sauvegarder.
2. **App** (localhost:3000) : cliquer sur un lieu découvert → bouton Partager → sur mobile voir le texte pré-rempli contenir "[TEST]".
3. **App desktop** : même manip → clipboard + toast OK.
4. **SEO local** : ouvrir une page SEO → bouton Partager en haut → clipboard OK sur desktop, share sheet OK sur mobile.
5. **Restaurer** le template original depuis le hub.

- [ ] **Step 3: Deploy explore-web**

```bash
pnpm --filter explore-web build
netlify deploy --prod --dir "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web/dist" --no-build
```

*(Chemin absolu obligatoire pour `--dir` — feedback mémoire Uriel.)*

- [ ] **Step 4: Deploy hub**

```bash
pnpm --filter hub build
netlify deploy --prod --dir "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/hub/dist" --functions "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/hub/netlify/functions" --no-build
```

- [ ] **Step 5: Deploy seo-pages**

Deux options :

**A. Trigger le workflow GitHub Actions manuel** :
```bash
gh workflow run seo-nightly.yml
```

**B. Build + deploy local (plus rapide si on veut tester maintenant)** :
```bash
pnpm --filter seo-pages build
netlify deploy --prod --dir "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages/dist" --no-build
```

- [ ] **Step 6: Test en production**

Sur **téléphone réel** (iPhone Safari + Android Chrome idéalement) :

1. `carte.runesdechene.com` → se connecter → cliquer lieu → bouton Partager visible → share sheet ouvre avec WhatsApp/SMS → texte correct.
2. `carte.runesdechene.com/lieu/<slug>` (SEO Page) → bouton Partager dans la nav → share sheet OK.

Sur **desktop** :

1. `carte.runesdechene.com` → clipboard + toast OK.
2. `carte.runesdechene.com/lieu/<slug>` → clipboard + toast OK.

- [ ] **Step 7: Update CLAUDE.md apps/explore-web si besoin**

Si l'ajout du `appConfigStore` change la section "Zustand (6 stores)" de `apps/explore-web/CLAUDE.md`, l'actualiser en **"Zustand (7 stores)"** pour refléter la réalité.

- [ ] **Step 8: Commit final (si CLAUDE.md changé)**

```bash
git -C "$REPO" add apps/explore-web/CLAUDE.md
git -C "$REPO" commit -m "docs(app): CLAUDE.md — +1 store (appConfigStore)"
git -C "$REPO" push
```

- [ ] **Step 9: Marquer la feature comme livrée**

Dans Obsidian, ouvrir `📱 L'application (La Carte)/🛠️ DEV/Architecture/SEO Pages Lieux.md` et ajouter dans la section "État actuel" :

```
- ✅ Bouton Partager en prod (PlacePanel + SEO Page) — 2026-04-21
```

---

## Notes importantes pour l'implémenteur

1. **Le texte peut changer après deploy**. Uriel édite le template depuis le hub, aucun nouveau deploy nécessaire pour l'app. La SEO Page récupère le changement au prochain rebuild nightly (3h UTC) ou via trigger manuel du workflow.

2. **Pas de tests automatisés.** Ce projet n'a pas de framework de test côté explore-web ni seo-pages. Tous les tests sont manuels. Ne pas installer vitest/jest pour cette feature (feedback Uriel : pas de framework over-engineered).

3. **SVG inline uniquement.** Ne pas installer `lucide-react` ou équivalent — le projet n'utilise pas de lib d'icônes, on reste sur SVG inline.

4. **Chemins absolus pour Netlify deploy.** Feedback mémoire Uriel : `netlify deploy --dir` accepte mal les chemins relatifs. Toujours passer le chemin absolu entre guillemets.

5. **Commit + push après chaque task.** Règle d'or d'Uriel (multi-postes). Ne pas accumuler plusieurs tasks dans un seul commit.

6. **Variable `$REPO`** : la racine du monorepo est `C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)`. Pour éviter d'avoir à la réécrire à chaque commande git, exporter : `REPO="C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"` puis utiliser `git -C "$REPO" ...`.
