# Coupe des Héritages — Section Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section `<CoupeHeritagesSection>` sur la home `/accueil` mobile, juste avant Activité, avec deux états (Podium parchemin clair pour user dans une Maison, Onboarding coupe-en-hero pour user sans Maison) — pas de toggle conditionnel, toujours visible.

**Architecture:** Branche `coupe-heritages-home` (déjà créée). Couche purement frontend : aucune migration SQL, aucune RPC nouvelle. Réutilise le hook `useCoupe` existant et la RPC `get_coupe_state`. La modale de sélection (`FactionModal`) est exposée par `MobileLayout` via Outlet context React Router 7. La modale de classement (`CoupeModal`) et la modale membres (`FactionMembersModal`) sont montées localement par la section.

**Tech Stack:** React 18, Vite 5, TypeScript strict, React Router 7, Supabase JS. **Pas de framework de tests unitaires** dans la codebase — validation via `pnpm --filter explore-web build` (tsc strict + Vite build) + `pnpm dev` manuel sur mobile (Chrome DevTools mode mobile + appareil iOS/Android). Commits fréquents, push en fin de session ou sur lot cohérent.

**Spec source:** `docs/superpowers/specs/2026-05-10-coupe-heritages-home-design.md`

---

## File Structure

### Nouveaux fichiers
- `apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx` — orchestrateur (fetch + visibilitychange + aiguillage Podium/Onboarding + modales locales)
- `apps/explore-web/src/components/home/coupe/CoupePodium.tsx` — état "user dans une Maison" (variante C1 du design)
- `apps/explore-web/src/components/home/coupe/CoupeOnboarding.tsx` — état "user sans Maison" (variante E2 du design)
- `apps/explore-web/src/components/home/coupe/CoupeHeritages.css` — styles partagés des trois fichiers ci-dessus

### Fichiers modifiés
- `apps/explore-web/src/pages/MobileLayout.tsx` — ajouter le typage du contexte Outlet et passer `openFactionModal` aux enfants
- `apps/explore-web/src/pages/HomePage.tsx` — récupérer `openFactionModal` via `useOutletContext`, ajouter une `<section>` avec `<CoupeHeritagesSection>` entre `PlacesSection` et `MapActivityList`

---

## Task 1: Outlet context plumbing dans MobileLayout

**Files:**
- Modify: `apps/explore-web/src/pages/MobileLayout.tsx`

**Pourquoi :** La `FactionModal` (sélection de Maison) est aujourd'hui déclenchée depuis `MobileTopBar` via une callback prop. Pour que `CoupeHeritagesSection` (enfant de `HomePage` qui est elle-même enfant de `<Outlet />`) puisse aussi ouvrir cette modale, on expose la callback à toutes les routes enfants via le contexte Outlet de React Router. Pattern propre, pas de Zustand store, pas de prop drilling au-delà d'un niveau.

- [ ] **Step 1: Lire le fichier actuel pour repérer la zone d'édition**

Run: `cat "apps/explore-web/src/pages/MobileLayout.tsx"`

Repérer la ligne `<Outlet />` (~ ligne 47).

- [ ] **Step 2: Définir le type partagé en haut du fichier**

Avant le composant `MobileLayout`, ajouter :

```tsx
export interface MobileLayoutContext {
  /** Ouvre la FactionModal (sélection/changement de Maison). Montée par MobileLayout. */
  openFactionModal: () => void
}
```

- [ ] **Step 3: Passer le contexte à `<Outlet />`**

Remplacer :

```tsx
<Outlet />
```

Par :

```tsx
<Outlet context={{ openFactionModal: () => setShowFactionModal(true) } satisfies MobileLayoutContext} />
```

- [ ] **Step 4: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -8`
Expected: Build OK, pas d'erreur TS, "✓ built in Xs".

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/pages/MobileLayout.tsx
git commit -m "feat(web): MobileLayout — expose openFactionModal aux routes enfants via Outlet context"
```

---

## Task 2: CSS partagé `CoupeHeritages.css`

**Files:**
- Create: `apps/explore-web/src/components/home/coupe/CoupeHeritages.css`

**Pourquoi :** Centraliser tous les styles de la section dans un seul fichier importé par les trois composants TSX. Tokens calés sur la palette home (parchemin `#faf2dd`, sépia `#b8945e`, encre `#2a1f10`, or `#b8860b`).

- [ ] **Step 1: Créer le dossier et le fichier**

Run: `mkdir -p "apps/explore-web/src/components/home/coupe" && touch "apps/explore-web/src/components/home/coupe/CoupeHeritages.css"`

- [ ] **Step 2: Écrire le contenu CSS complet**

Contenu exact du fichier `apps/explore-web/src/components/home/coupe/CoupeHeritages.css` :

```css
/* ============================================
   COUPE DES HÉRITAGES — Section Home
   Styles partagés CoupePodium + CoupeOnboarding
   ============================================ */

/* ---- Titre de section (commun) ---- */
.coupe-section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 10px;
  color: #2a1f10;
}
.coupe-season {
  font-size: 11px;
  font-style: italic;
  color: #8a6f4a;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  margin-left: 6px;
}

/* ---- Cadre intérieur (commun) ---- */
.coupe-frame {
  background: #f4e4b8;
  border: 1px solid #b8945e;
  border-radius: 14px;
  box-shadow: inset 0 0 18px rgba(184, 148, 94, 0.18);
}

/* =========================================
   PODIUM (état "user dans une Maison")
   ========================================= */
.coupe-podium-frame {
  padding: 14px 12px 10px;
}
.coupe-podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}
.coupe-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 120ms ease-out;
}
.coupe-step:hover {
  transform: translateY(-2px);
}
.coupe-step-emblem {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  box-shadow: 0 2px 6px rgba(74, 55, 40, 0.3);
}
.coupe-step-emblem-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}
.coupe-step-mine {
  outline: 2px solid #b8860b;
  outline-offset: 2px;
}
.coupe-step-1 .coupe-step-emblem {
  width: 48px;
  height: 48px;
  box-shadow: 0 0 14px rgba(184, 134, 11, 0.55), 0 2px 6px rgba(74, 55, 40, 0.3);
}
.coupe-step-1 .coupe-step-emblem-img {
  width: 28px;
  height: 28px;
}
.coupe-step-name {
  font-family: 'Cinzel', 'Georgia', serif;
  font-size: 10px;
  font-weight: 600;
  color: #2a1f10;
  margin-bottom: 4px;
  text-align: center;
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coupe-step-pts {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.coupe-step-block {
  width: 70px;
  background: linear-gradient(180deg, #d8c08a 0%, #b8945e 100%);
  border: 1px solid #8a6f4a;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 18px;
  font-weight: 700;
  color: #2a1f10;
}
.coupe-step-1 .coupe-step-block {
  height: 64px;
  background: linear-gradient(180deg, #e8c869 0%, #b8860b 100%);
  box-shadow: inset 0 -2px 4px rgba(74, 55, 40, 0.3);
}
.coupe-step-2 .coupe-step-block {
  height: 48px;
}
.coupe-step-3 .coupe-step-block {
  height: 36px;
}
.coupe-crown {
  font-size: 16px;
  margin-bottom: 2px;
  line-height: 1;
}
.coupe-crown-spacer {
  height: 18px;
}

/* ---- 4ème en pied ---- */
.coupe-outsider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 4px;
  border-top: 1px solid rgba(184, 148, 94, 0.4);
  font-size: 11px;
  color: #6a4f2a;
  cursor: pointer;
  transition: background 120ms ease-out;
  border-radius: 6px;
}
.coupe-outsider:hover {
  background: rgba(184, 148, 94, 0.08);
}
.coupe-outsider-mine {
  background: rgba(184, 134, 11, 0.08);
}
.coupe-outsider-emblem {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.coupe-outsider-emblem-img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}
.coupe-outsider-name {
  font-family: 'Cinzel', serif;
  font-weight: 700;
}

/* ---- Pilule identité utilisateur ---- */
.coupe-mine-pill-wrap {
  text-align: center;
  margin-top: 8px;
}
.coupe-mine-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(184, 134, 11, 0.18);
  border: 1px solid rgba(184, 134, 11, 0.4);
  color: #6a5008;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: 'Cinzel', serif;
}

/* ---- Footer "Voir le classement complet" ---- */
.coupe-podium-footer {
  margin-top: 10px;
  text-align: center;
  font-size: 10px;
  color: #8a6f4a;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  padding: 4px 0;
  font-family: inherit;
}
.coupe-podium-footer:hover {
  color: #5a4020;
}

/* =========================================
   ONBOARDING (état "user sans Maison")
   ========================================= */
.coupe-onboarding-frame {
  padding: 20px 14px 14px;
  text-align: center;
}
.coupe-cup-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  position: relative;
}
.coupe-cup-halo {
  position: absolute;
  inset: -8px -20px;
  background: radial-gradient(ellipse at center, rgba(232, 200, 105, 0.32) 0%, transparent 60%);
  pointer-events: none;
}
.coupe-cup {
  width: 86px;
  height: 86px;
  display: block;
  filter: drop-shadow(0 4px 8px rgba(74, 55, 40, 0.35));
  position: relative;
}
.coupe-tagline {
  font-family: 'Cinzel', 'Georgia', serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #2a1f10;
  margin: 0 0 6px;
}
.coupe-blurb {
  font-family: 'Georgia', serif;
  font-style: italic;
  font-size: 11.5px;
  line-height: 1.5;
  color: #6a4f2a;
  margin: 0 14px 16px;
}
.coupe-banners {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  gap: 4px;
  padding-top: 14px;
  margin-bottom: 14px;
  border-top: 1px solid rgba(184, 148, 94, 0.45);
}
.coupe-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 2px;
  border-radius: 6px;
  transition: background 120ms ease-out, transform 120ms ease-out;
  font-family: inherit;
}
.coupe-banner:hover {
  background: rgba(184, 148, 94, 0.1);
  transform: translateY(-2px);
}
.coupe-banner-emblem {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(74, 55, 40, 0.3);
}
.coupe-banner-emblem-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}
.coupe-banner-name {
  font-family: 'Cinzel', serif;
  font-size: 9.5px;
  font-weight: 700;
  text-align: center;
  line-height: 1.15;
  color: #2a1f10;
}
.coupe-cta {
  display: block;
  width: 100%;
  padding: 11px 16px;
  background: linear-gradient(180deg, #e8c869 0%, #b8860b 100%);
  border: 1px solid #8a6508;
  border-radius: 999px;
  color: #2a1f10;
  font-family: 'Cinzel', serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(184, 134, 11, 0.4), inset 0 -2px 3px rgba(74, 55, 40, 0.2);
  transition: transform 120ms ease-out;
}
.coupe-cta:active {
  transform: scale(0.98);
}
```

- [ ] **Step 3: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -5`
Expected: Build OK. Le CSS n'est pas encore importé donc rien ne change visuellement, mais Vite doit accepter le fichier.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/home/coupe/CoupeHeritages.css
git commit -m "feat(web): CSS partagé pour CoupeHeritagesSection (podium + onboarding)"
```

---

## Task 3: Composant `CoupeOnboarding`

**Files:**
- Create: `apps/explore-web/src/components/home/coupe/CoupeOnboarding.tsx`

**Pourquoi :** Composant pur sans data-fetching, prend les `factions` et le `seasonName` en props, rend la coupe SVG en hero + le texte d'introduction + les 4 banni&egrave;res cliquables + le bouton CTA. Aucun classement révélé.

- [ ] **Step 1: Créer le fichier avec contenu complet**

Contenu exact de `apps/explore-web/src/components/home/coupe/CoupeOnboarding.tsx` :

```tsx
import type { CoupeFactionEntry } from '../../../types/coupe'
import './CoupeHeritages.css'

interface CoupeOnboardingProps {
  factions: CoupeFactionEntry[]
  /** Nom de la saison courante (ex. "Saison du Renouveau"). Affiché en sous-titre. */
  seasonName: string
  /** Pattern URL par factionId (depuis la table factions, pas dans CoupeFactionEntry). */
  patternByFactionId: Record<string, string | null>
  /** Ouvre la FactionModal de sélection. Source : Outlet context (MobileLayout). */
  openFactionModal: () => void
}

/**
 * État "user sans Maison" — présentation neutre des héritages.
 * Pas de scores, pas de classement (anti-bandwagon volontaire, cf. spec §1).
 *
 * Layout : titre section + cadre parchemin contenant
 *   - coupe SVG hero avec halo
 *   - accroche "Une saison. Quatre Maisons."
 *   - texte d'intro
 *   - 4 bannières emblème + nom (cliquables → FactionModal)
 *   - bouton CTA "Choisir ma Maison" (full-width)
 */
export function CoupeOnboarding({
  factions,
  seasonName,
  patternByFactionId,
  openFactionModal,
}: CoupeOnboardingProps) {
  return (
    <>
      <h2 className="coupe-section-title">
        ⚜ Coupe des Héritages
        <span className="coupe-season">— {seasonName}</span>
      </h2>
      <div className="coupe-frame coupe-onboarding-frame">
        <div className="coupe-cup-wrap">
          <div className="coupe-cup-halo" />
          <CoupeCupSvg />
        </div>
        <div className="coupe-tagline">Une saison. Quatre Maisons.</div>
        <div className="coupe-blurb">
          Chaque énigme résolue, chaque lieu visité, chaque récit partagé fait grandir l'héritage de ta Maison. À la fin de la saison, l'une d'elles soulève la Coupe.
        </div>
        <div className="coupe-banners">
          {factions.map(f => (
            <button
              key={f.factionId}
              type="button"
              className="coupe-banner"
              onClick={openFactionModal}
              aria-label={`En savoir plus sur ${f.factionTitle}`}
            >
              <span
                className="coupe-banner-emblem"
                style={{ background: f.factionColor }}
              >
                {patternByFactionId[f.factionId] && (
                  <img
                    src={patternByFactionId[f.factionId] ?? undefined}
                    alt=""
                    className="coupe-banner-emblem-img"
                  />
                )}
              </span>
              <span className="coupe-banner-name">{f.factionTitle}</span>
            </button>
          ))}
        </div>
        <button type="button" className="coupe-cta" onClick={openFactionModal}>
          ⚜ Choisir ma Maison
        </button>
      </div>
    </>
  )
}

/**
 * SVG de coupe doré inline (86×86 quand rendu via .coupe-cup).
 * Définitions de gradients dans <defs>, anses + vasque + reflet + bandeau central
 * + pied + base. Le filter drop-shadow et le sizing sont sur la classe parent.
 */
function CoupeCupSvg() {
  return (
    <svg className="coupe-cup" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="coupe-cup-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d987" />
          <stop offset="50%" stopColor="#d4a857" />
          <stop offset="100%" stopColor="#9a7008" />
        </linearGradient>
        <linearGradient id="coupe-cup-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff5cf" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff5cf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Anses */}
      <path d="M 22 32 Q 8 32 8 50 Q 8 62 22 60" fill="none" stroke="url(#coupe-cup-gold)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 78 32 Q 92 32 92 50 Q 92 62 78 60" fill="none" stroke="url(#coupe-cup-gold)" strokeWidth="4" strokeLinecap="round" />
      {/* Vasque */}
      <path d="M 22 28 L 78 28 L 74 60 Q 50 70 26 60 Z" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1.5" />
      {/* Reflet */}
      <path d="M 28 32 L 38 32 L 36 56 Q 32 56 30 54 Z" fill="url(#coupe-cup-shine)" />
      {/* Bandeau central */}
      <path d="M 30 40 L 70 40 L 68 48 L 32 48 Z" fill="#7a5008" opacity="0.4" />
      {/* Étoile fleur de lys au centre */}
      <text x="50" y="48" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#fff5cf" fontWeight="700">⚜</text>
      {/* Pied colonne */}
      <rect x="44" y="68" width="12" height="14" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      {/* Base */}
      <ellipse cx="50" cy="84" rx="22" ry="4" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      <rect x="28" y="84" width="44" height="6" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      <ellipse cx="50" cy="90" rx="22" ry="3" fill="#9a7008" />
    </svg>
  )
}
```

- [ ] **Step 2: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -5`
Expected: Build OK. Le composant n'est pas encore monté, donc Vite doit l'accepter mais le tree-shaker peut le drop ; on s'assure juste que TS strict passe.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/home/coupe/CoupeOnboarding.tsx
git commit -m "feat(web): CoupeOnboarding — état présentation neutre pour user sans Maison"
```

---

## Task 4: Composant `CoupePodium`

**Files:**
- Create: `apps/explore-web/src/components/home/coupe/CoupePodium.tsx`

**Pourquoi :** Composant pur sans data-fetching, prend `factions` (déjà triées par score desc), le `seasonName`, le `userFactionId`, et les callbacks de clic. Rend top 3 sur podium + 4ème en pied + pilule identité + footer "Voir le classement complet".

- [ ] **Step 1: Créer le fichier avec contenu complet**

Contenu exact de `apps/explore-web/src/components/home/coupe/CoupePodium.tsx` :

```tsx
import type { CoupeFactionEntry } from '../../../types/coupe'
import './CoupeHeritages.css'

interface CoupePodiumProps {
  /** 4 factions triées par score desc (ordre DB en ex aequo, géré côté orchestrateur). */
  factions: CoupeFactionEntry[]
  /** ID de la Maison de l'utilisateur (toujours non-null à ce stade — l'orchestrateur a déjà aiguillé). */
  userFactionId: string
  seasonName: string
  /** Pattern URL par factionId (depuis la table factions). */
  patternByFactionId: Record<string, string | null>
  /** Click sur marche du podium ou ligne 4ème : ouvre FactionMembersModal de cette Maison. */
  onClickFaction: (factionId: string, factionTitle: string, factionColor: string) => void
  /** Click sur titre / fond / footer : ouvre CoupeModal complète. */
  onClickAll: () => void
}

/**
 * État "user dans une Maison" — Podium I-II-III avec 4ème en pied.
 * Couronne 👑 sur le 1er si scores > 0, embl&egrave;me cerclé or pour la Maison du user.
 */
export function CoupePodium({
  factions,
  userFactionId,
  seasonName,
  patternByFactionId,
  onClickFaction,
  onClickAll,
}: CoupePodiumProps) {
  const [first, second, third, fourth] = factions
  const topScore = first?.score ?? 0
  const userFaction = factions.find(f => f.factionId === userFactionId)
  const userRank = userFaction?.rank ?? 0
  const gapToTop = topScore - (userFaction?.score ?? 0)
  const gapToPodium = (third?.score ?? 0) - (fourth?.score ?? 0)

  return (
    <>
      <h2
        className="coupe-section-title"
        onClick={onClickAll}
        style={{ cursor: 'pointer' }}
      >
        ⚜ Coupe des Héritages
        <span className="coupe-season">— {seasonName}</span>
      </h2>
      <div className="coupe-frame coupe-podium-frame">
        <div className="coupe-podium">
          {/* 2ème (gauche) */}
          <PodiumStep
            faction={second}
            position={2}
            isLeader={false}
            isMine={second.factionId === userFactionId}
            patternUrl={patternByFactionId[second.factionId] ?? null}
            onClick={() => onClickFaction(second.factionId, second.factionTitle, second.factionColor)}
          />
          {/* 1er (centre) */}
          <PodiumStep
            faction={first}
            position={1}
            isLeader={topScore > 0}
            isMine={first.factionId === userFactionId}
            patternUrl={patternByFactionId[first.factionId] ?? null}
            onClick={() => onClickFaction(first.factionId, first.factionTitle, first.factionColor)}
          />
          {/* 3ème (droite) */}
          <PodiumStep
            faction={third}
            position={3}
            isLeader={false}
            isMine={third.factionId === userFactionId}
            patternUrl={patternByFactionId[third.factionId] ?? null}
            onClick={() => onClickFaction(third.factionId, third.factionTitle, third.factionColor)}
          />
        </div>

        {/* 4ème en pied */}
        <div
          className={`coupe-outsider${fourth.factionId === userFactionId ? ' coupe-outsider-mine' : ''}`}
          onClick={() => onClickFaction(fourth.factionId, fourth.factionTitle, fourth.factionColor)}
          role="button"
          tabIndex={0}
        >
          <span
            className="coupe-outsider-emblem"
            style={{ background: fourth.factionColor }}
          >
            {patternByFactionId[fourth.factionId] && (
              <img src={patternByFactionId[fourth.factionId] ?? undefined} alt="" className="coupe-outsider-emblem-img" />
            )}
          </span>
          <span>
            <span className="coupe-outsider-name">{fourth.factionTitle}</span>
            {' · '}
            {fourth.score} pts
            {topScore > 0 && (
              <>
                {' · '}à {gapToPodium} du podium
              </>
            )}
          </span>
        </div>

        {/* Pilule identité user */}
        <div className="coupe-mine-pill-wrap">
          <span className="coupe-mine-pill">{minePillLabel(topScore, userRank, gapToTop)}</span>
        </div>

        {/* Footer "Voir le classement complet" */}
        <button type="button" className="coupe-podium-footer" onClick={onClickAll}>
          ▸ Voir le classement complet
        </button>
      </div>
    </>
  )
}

interface PodiumStepProps {
  faction: CoupeFactionEntry
  position: 1 | 2 | 3
  isLeader: boolean
  isMine: boolean
  patternUrl: string | null
  onClick: () => void
}

function PodiumStep({ faction, position, isLeader, isMine, patternUrl, onClick }: PodiumStepProps) {
  const roman = position === 1 ? 'I' : position === 2 ? 'II' : 'III'
  return (
    <div className={`coupe-step coupe-step-${position}`} onClick={onClick}>
      {isLeader ? (
        <span className="coupe-crown" aria-hidden="true">👑</span>
      ) : (
        <span className="coupe-crown-spacer" aria-hidden="true" />
      )}
      <span
        className={`coupe-step-emblem${isMine ? ' coupe-step-mine' : ''}`}
        style={{ background: faction.factionColor }}
      >
        {patternUrl && (
          <img src={patternUrl} alt="" className="coupe-step-emblem-img" />
        )}
      </span>
      <span className="coupe-step-name">{faction.factionTitle}</span>
      <span className="coupe-step-pts" style={{ color: faction.factionColor }}>{faction.score}</span>
      <span className="coupe-step-block">{roman}</span>
    </div>
  )
}

/**
 * Texte de la pilule identité selon le rang et le score.
 * - Toutes Maisons à 0 pt (début saison)         → "⚜ Ta Maison · 0 pts"
 * - User 1er avec score > 0                       → "⚜ Ta Maison mène la course"
 * - User 2-4e avec score > 0                      → "⚜ Ta Maison est Xème · Y du sommet"
 */
function minePillLabel(topScore: number, userRank: number, gapToTop: number): string {
  if (topScore <= 0) return '⚜ Ta Maison · 0 pts'
  if (userRank === 1) return '⚜ Ta Maison mène la course'
  return `⚜ Ta Maison est ${ordinalFr(userRank)} · ${gapToTop} du sommet`
}

function ordinalFr(n: number): string {
  if (n === 1) return '1ère'
  return `${n}ème`
}
```

- [ ] **Step 2: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -5`
Expected: Build OK.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/home/coupe/CoupePodium.tsx
git commit -m "feat(web): CoupePodium — état podium parchemin clair avec 4ème en pied et pilule identité"
```

---

## Task 5: Orchestrateur `CoupeHeritagesSection`

**Files:**
- Create: `apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx`

**Pourquoi :** Composant top-level qui :
1. Récupère le state via `useCoupe(autoLoad=true, pollMs=0)`
2. Récupère les `pattern` URLs des factions via une requête séparée à `factions` (`useCoupe` ne les retourne pas)
3. Ajoute un listener `visibilitychange` → refetch
4. Aiguille rendu Podium / Onboarding selon `userFactionId`
5. Monte localement `FactionMembersModal` et `CoupeModal` avec leur state

- [ ] **Step 1: Créer le fichier avec contenu complet**

Contenu exact de `apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { useCoupe } from '../../../hooks/useCoupe'
import { usePlayerStore } from '../../../stores/playerStore'
import { supabase } from '../../../lib/supabase'
import { FactionMembersModal } from '../../map/modals/FactionMembersModal'
import { CoupeModal } from '../../map/modals/CoupeModal'
import { CoupePodium } from './CoupePodium'
import { CoupeOnboarding } from './CoupeOnboarding'
import type { CoupeFactionEntry } from '../../../types/coupe'

interface CoupeHeritagesSectionProps {
  /** Ouvre la FactionModal de sélection (récupéré via useOutletContext dans HomePage). */
  openFactionModal: () => void
}

interface SelectedFactionState {
  factionId: string
  factionTitle: string
  factionColor: string
}

/**
 * Section Home — Coupe des Héritages.
 *
 * Toujours visible (pas de toggle factionColorMode). Aiguille rendu Podium
 * (user dans une Maison) ou Onboarding (user sans Maison).
 *
 * Refetch :
 *  - au mount (useCoupe autoLoad=true)
 *  - au retour sur l'onglet (visibilitychange)
 *  - PAS de polling 30s (différent du FactionBar carte)
 *
 * Edge cases (return null) :
 *  - state null + loading initial
 *  - error
 *  - season null
 *  - factions.length < 4 (config dev/test, impossible en prod)
 */
export function CoupeHeritagesSection({ openFactionModal }: CoupeHeritagesSectionProps) {
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const { state, loading, error, refresh } = useCoupe(true, 0)
  const [patternByFactionId, setPatternByFactionId] = useState<Record<string, string | null>>({})
  const [selectedFaction, setSelectedFaction] = useState<SelectedFactionState | null>(null)
  const [showCoupeModal, setShowCoupeModal] = useState(false)

  // Refetch quand l'onglet redevient visible
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  // Charger les pattern URLs des factions (table factions, non retourné par get_coupe_state)
  useEffect(() => {
    let cancelled = false
    async function loadPatterns() {
      const { data, error: e } = await supabase.from('factions').select('id, pattern')
      if (cancelled) return
      if (e || !data) {
        console.warn('[CoupeHeritagesSection] failed to load faction patterns', e?.message)
        return
      }
      const map: Record<string, string | null> = {}
      for (const row of data as Array<{ id: string; pattern: string | null }>) {
        map[row.id] = row.pattern
      }
      setPatternByFactionId(map)
    }
    loadPatterns()
    return () => { cancelled = true }
  }, [])

  // Edge cases : section cachée
  if (loading && !state) return null
  if (error) {
    console.warn('[CoupeHeritagesSection] get_coupe_state error:', error)
    return null
  }
  if (!state) return null
  if (!state.season) return null

  // Tri factions par score desc, ex aequo par ordre du tableau retourné par RPC
  // (la RPC retourne déjà l'ordre canonique en cas d'égalité ; on garantit le tri score)
  const sortedFactions: CoupeFactionEntry[] = [...state.factions].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return 0  // ex aequo : on garde l'ordre RPC (qui suit factions.order DB)
  })

  // Hypothèse : 4 Maisons en prod. Cf. spec §4.1.
  if (sortedFactions.length < 4) {
    console.warn('[CoupeHeritagesSection] expected 4 factions, got', sortedFactions.length)
    return null
  }

  const seasonName = state.season.name

  if (userFactionId) {
    return (
      <>
        <CoupePodium
          factions={sortedFactions}
          userFactionId={userFactionId}
          seasonName={seasonName}
          patternByFactionId={patternByFactionId}
          onClickFaction={(factionId, factionTitle, factionColor) =>
            setSelectedFaction({ factionId, factionTitle, factionColor })
          }
          onClickAll={() => setShowCoupeModal(true)}
        />
        {selectedFaction && (
          <FactionMembersModal
            factionId={selectedFaction.factionId}
            factionTitle={selectedFaction.factionTitle}
            factionColor={selectedFaction.factionColor}
            onClose={() => setSelectedFaction(null)}
          />
        )}
        {showCoupeModal && <CoupeModal onClose={() => setShowCoupeModal(false)} />}
      </>
    )
  }

  return (
    <CoupeOnboarding
      factions={sortedFactions}
      seasonName={seasonName}
      patternByFactionId={patternByFactionId}
      openFactionModal={openFactionModal}
    />
  )
}
```

- [ ] **Step 2: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -5`
Expected: Build OK.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx
git commit -m "feat(web): CoupeHeritagesSection — orchestrateur Podium/Onboarding avec refetch on visibility"
```

---

## Task 6: Intégration dans HomePage

**Files:**
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

**Pourquoi :** Récupérer `openFactionModal` du contexte Outlet et monter `<CoupeHeritagesSection>` entre `PlacesSection` et `MapActivityList`.

- [ ] **Step 1: Lire le fichier actuel pour repérer les zones d'édition**

Run: `cat "apps/explore-web/src/pages/HomePage.tsx"`

Repérer :
- les imports en haut (ligne ~1-13)
- le composant `HomePage()` (ligne ~21)
- l'ordre des `<section>` dans le `<main>` (ligne ~59-92)

- [ ] **Step 2: Ajouter les imports**

Ajouter en haut, après les autres imports React Router :

```tsx
import { useNavigate, useOutletContext } from 'react-router-dom'
```

(Remplacer la ligne `import { useNavigate } from 'react-router-dom'` par celle ci-dessus.)

Puis ajouter dans le bloc d'imports composants :

```tsx
import { CoupeHeritagesSection } from '../components/home/coupe/CoupeHeritagesSection'
import type { MobileLayoutContext } from './MobileLayout'
```

- [ ] **Step 3: Récupérer la callback du contexte Outlet**

Dans la fonction `HomePage()`, juste après `const navigate = useNavigate()`, ajouter :

```tsx
const { openFactionModal } = useOutletContext<MobileLayoutContext>()
```

- [ ] **Step 4: Insérer la nouvelle section**

Repérer dans le JSX la section `<section className="home-section home-section--no-padding"><PlacesSection /></section>` et la section juste après (`<section className="home-section"><h2>...</h2><MapActivityList .../></section>`).

Insérer entre les deux la nouvelle section :

```tsx
<section className="home-section">
  <CoupeHeritagesSection openFactionModal={openFactionModal} />
</section>
```

L'ordre final doit être :
1. `<DailyEnigmaCard />` (existant)
2. `<div className="home-card">` Événements & Quêtes (existant)
3. `<PlacesSection />` (existant)
4. **`<CoupeHeritagesSection />` (nouveau)**
5. Activité de la carte (existant)

- [ ] **Step 5: Vérifier le build**

Run: `pnpm --filter explore-web build 2>&1 | tail -8`
Expected: Build OK, tout compile, pas d'erreur TS strict.

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): HomePage — monter CoupeHeritagesSection entre PlacesSection et Activité"
```

---

## Task 7: Validation manuelle, ajustements visuels, commit final

**Pourquoi :** Aucun test automatisé dans la codebase. Validation visuelle en local sur mobile (Chrome DevTools mode mobile + un device réel iOS ou Android si possible).

- [ ] **Step 1: Lancer le dev server**

Run: `pnpm --filter explore-web dev`
Expected: Vite démarre sur le port 3000.

- [ ] **Step 2: Tester en mode mobile (Chrome DevTools)**

Ouvrir `http://localhost:3000/accueil` dans Chrome avec DevTools en mode iPhone 12 Pro (390×844). Vérifier la checklist suivante (cocher mentalement) :

- [ ] La section apparaît bien entre "Lieux récents" et "Activité de la carte"
- [ ] Si l'utilisateur de test a une Maison : on voit le Podium I-II-III, son embl&egrave;me a un contour or si dans le top 3 OU son pied (ligne 4ème) est teinté or s'il est 4ème
- [ ] Couronne 👑 sur le 1er si scores > 0
- [ ] Pilule identité affiche le bon texte (1er → "m&egrave;ne la course", 2-4e → "Xème · Y du sommet", 0 pts → "0 pts")
- [ ] Click sur une marche du podium → ouvre `FactionMembersModal` de cette Maison
- [ ] Click sur le titre / le footer → ouvre `CoupeModal` complète
- [ ] Click sur la ligne 4ème → ouvre `FactionMembersModal` de cette Maison
- [ ] Si l'utilisateur de test n'a pas de Maison : on voit l'Onboarding (coupe SVG + 4 banni&egrave;res + bouton CTA)
- [ ] Click sur une banni&egrave;re → ouvre `FactionModal` de sélection
- [ ] Click sur "Choisir ma Maison" → ouvre `FactionModal` de sélection
- [ ] Bascule de mode (DevTools : changer l'orientation, refocus l'onglet) → la section refetch quand on revient sur l'onglet (visible dans le Network tab : RPC `get_coupe_state` rappelée)

- [ ] **Step 3: Tester l'état "user sans Maison"**

Pour simuler l'état Onboarding sans modifier la prod, faire dans la console du navigateur :

```js
// Forcer userFactionId à null dans le playerStore
window.dispatchEvent(new Event('debug:simulateNoFaction'))
```

OU plus simple : se connecter avec un compte test sans faction. À défaut, modifier temporairement `usePlayerStore` pour forcer `userFactionId = null` (et **rollback avant commit**).

- [ ] **Step 4: Tester desktop (non-régression)**

Sortir du mode mobile DevTools, recharger `http://localhost:3000/`. Vérifier :
- Atterrissage sur `/carte` (desktop) inchangé
- `FactionBar` carte toujours visible sur la carte (si toggle `factionColorMode` activé)
- Pas de page `/accueil` accessible sur desktop (redirige `/carte`)

- [ ] **Step 5: Test iOS (PWA standalone) — si possible**

Si un iPhone est disponible : ouvrir l'app en PWA standalone, naviguer sur `/accueil`. Vérifier :
- La section apparaît correctement (pas de débordement, pas de chevauchement avec le fixed header)
- Les cliques sur banni&egrave;res / podium / footer marchent

- [ ] **Step 6: Ajustements visuels si besoin**

Si la mise en page diffère sensiblement des mockups validés (notamment `padding`, `font-size`, `border-radius`, taille des emblèmes), ajuster `CoupeHeritages.css` jusqu'à approximation correcte. Re-build après chaque ajustement (`pnpm --filter explore-web build`).

- [ ] **Step 7: Run final build pour s'assurer que tout passe**

Run: `pnpm --filter explore-web build 2>&1 | tail -10`
Expected: "✓ built in Xs", aucune erreur TS, aucune erreur Vite.

- [ ] **Step 8: Commit final éventuel (ajustements CSS) et push de la branche**

Si ajustements CSS faits :

```bash
git add apps/explore-web/src/components/home/coupe/CoupeHeritages.css
git commit -m "style(web): CoupeHeritages — ajustements visuels après test device"
```

Push de la branche :

```bash
git push -u origin coupe-heritages-home
```

- [ ] **Step 9: Mise à jour `apps/explore-web/CLAUDE.md`**

Ajouter dans la section "Spécificités cette app" une ligne (sous le format des autres lignes V0.7) qui décrit la nouvelle section. Exemple :

```
- V0.7.9 (10 mai 2026) : section **Coupe des Héritages** sur la home `/accueil`. Composant `CoupeHeritagesSection` dans `components/home/coupe/` (Podium + Onboarding + CSS partagé). Toujours visible (pas de toggle `factionColorMode`). Refetch on `visibilitychange`. Modale `FactionModal` exposée par `MobileLayout` via Outlet context. La `FactionBar` carte reste en place pour V0.7.9.
```

```bash
git add apps/explore-web/CLAUDE.md
git commit -m "docs(web): CLAUDE.md — mention V0.7.9 section Coupe des Héritages home"
git push
```

- [ ] **Step 10: Cleanup local — fermer le dev server**

`Ctrl-C` dans le terminal qui fait tourner `pnpm --filter explore-web dev`.

---

## Out of Scope Reminders (cf. spec §2)

- ❌ Ne pas toucher à `FactionBar` sur la carte (sera dégagée plus tard)
- ❌ Ne pas créer de nouvelle RPC, ni de migration SQL
- ❌ Ne pas ajouter de polling 30s
- ❌ Ne pas faire de version desktop de la home
- ❌ Ne pas ajouter d'animation d'entrée du podium
- ❌ Ne pas modifier le wording d'introduction (texte figé dans le CSS de la spec, modifiable en review utilisateur séparée)

---
