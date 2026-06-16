# Refonte des actions de La Cour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre visibles et explicites les trois gestes de La Cour (soutenir le veilleur / prendre pour soi / soutenir un attaquant) en sortant le 3e geste de l'accordéon caché, avec un cadrage de coût uniforme « +1 ».

**Architecture :** Refonte front-only. La zone d'actions de `PlaceCourtView` affiche 1/2/3 boutons selon l'état du lieu ; un 3e bouton `🤝 Soutenir un attaquant (N)` déplie inline la liste nominative des attaquants (avatar + nom + faction + score + tap). L'action « soutenir un attaquant » est retirée de `PatronsList`, qui devient un palmarès en lecture seule. Aucune migration SQL : `get_place_court_state` renvoie déjà `challengers[]`.

**Tech Stack :** React 18 + TypeScript strict, Vite, Zustand, CSS par composant, Vitest (logique pure uniquement — pas de React Testing Library dans le projet).

**Spec :** `docs/superpowers/specs/2026-06-16-cour-refonte-actions-design.md`

---

## File Structure

- **Create** `apps/explore-web/src/lib/courtActionsVisibility.ts` — helper pur : décide quels boutons afficher selon `(vacant, challengerCount)`. Une seule responsabilité, testable isolément.
- **Create** `apps/explore-web/src/lib/courtActionsVisibility.test.ts` — test Vitest du helper.
- **Modify** `apps/explore-web/src/components/places/details/PlaceCourtView.tsx` — câblage helper, cadrage `+1`, indicateur de solde, 3e bouton + liste dépliable, retrait des props d'action passées à `PatronsList`.
- **Modify** `apps/explore-web/src/components/places/details/PlaceCourtView.css` — styles solde + 3e bouton + liste attaquants.
- **Modify** `apps/explore-web/src/components/places/details/PatronsList.tsx` — retrait des props/boutons d'action → lecture seule.
- **Modify** `apps/explore-web/src/components/places/details/PatronsList.css` — nettoyage des styles de bouton orphelins.
- **Modify** `apps/explore-web/CHANGELOG.md` — bump version (entrée V0.9.70).

---

## Task 1 : Helper pur de visibilité des boutons

Verrouille la règle clé « le 3e bouton n'apparaît qu'en présence d'au moins un attaquant ».

**Files:**
- Create: `apps/explore-web/src/lib/courtActionsVisibility.ts`
- Test: `apps/explore-web/src/lib/courtActionsVisibility.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Create `apps/explore-web/src/lib/courtActionsVisibility.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { getCourtActionsVisibility } from './courtActionsVisibility'

describe('getCourtActionsVisibility', () => {
  it('lieu vierge : seul le bouton "prendre/poser" est visible', () => {
    expect(getCourtActionsVisibility(true, 0)).toEqual({
      showSupport: false,
      showContest: true,
      showAttackers: false,
    })
  })

  it('lieu veillé sans attaquant : soutenir + prendre, pas de 3e bouton', () => {
    expect(getCourtActionsVisibility(false, 0)).toEqual({
      showSupport: true,
      showContest: true,
      showAttackers: false,
    })
  })

  it('lieu veillé avec au moins un attaquant : les trois boutons', () => {
    expect(getCourtActionsVisibility(false, 2)).toEqual({
      showSupport: true,
      showContest: true,
      showAttackers: true,
    })
  })

  it('un lieu vierge n\'affiche jamais le 3e bouton même si challengerCount > 0', () => {
    expect(getCourtActionsVisibility(true, 3).showAttackers).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run: `cd apps/explore-web && pnpm test src/lib/courtActionsVisibility.test.ts`
Expected: FAIL — `Failed to resolve import './courtActionsVisibility'` / `getCourtActionsVisibility is not a function`.

- [ ] **Step 3 : Implémenter le helper**

Create `apps/explore-web/src/lib/courtActionsVisibility.ts` :

```ts
// Décide quels boutons d'action afficher dans La Cour selon l'état du lieu.
// Règle clé : le bouton « Soutenir un attaquant » n'apparaît que sur un lieu
// veillé ayant au moins un challenger (sinon il n'y a personne à soutenir).

export interface CourtActionsVisibility {
  /** « Soutenir {veilleur} » — uniquement si le lieu est veillé. */
  showSupport: boolean
  /** « Prendre le lieu pour moi » (veillé) ou « Poser ma marque » (vierge) — toujours. */
  showContest: boolean
  /** « Soutenir un attaquant (N) » — veillé ET au moins un challenger. */
  showAttackers: boolean
}

export function getCourtActionsVisibility(
  vacant: boolean,
  challengerCount: number,
): CourtActionsVisibility {
  return {
    showSupport: !vacant,
    showContest: true,
    showAttackers: !vacant && challengerCount > 0,
  }
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run: `cd apps/explore-web && pnpm test src/lib/courtActionsVisibility.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/lib/courtActionsVisibility.ts apps/explore-web/src/lib/courtActionsVisibility.test.ts
git commit -m "feat(cour): helper pur de visibilite des boutons d'action"
```

---

## Task 2 : Cadrage « +1 » uniforme + indicateur de solde

Remplace l'ancien coût `−1 🪙` par l'affordance `+1` sur tous les boutons, et rend le solde visible près des actions (le coût se lit alors via le solde qui descend).

**Files:**
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.tsx`
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.css`

- [ ] **Step 1 : Câbler le helper de visibilité**

Dans `PlaceCourtView.tsx`, ajouter l'import en tête (à côté des autres imports `lib`) :

```tsx
import { getCourtActionsVisibility } from '../../../lib/courtActionsVisibility'
```

Puis, juste avant le `return (` (après le calcul de `optimisticChallengers`), ajouter :

```tsx
  const actionsVis = getCourtActionsVisibility(vacant, optimisticChallengers.length)
```

- [ ] **Step 2 : Remplacer le coût du bouton « Soutenir » par « +1 »**

Dans le bouton `court-btn-support`, remplacer :

```tsx
            <span className="court-btn-cost">−1 🪙</span>
```

par :

```tsx
            <span className="court-btn-cost">+1</span>
```

- [ ] **Step 3 : Remplacer le coût du bouton « Influencer/Prendre » par « +1 »**

Dans le bouton `court-btn-contest`, remplacer :

```tsx
            {!contestBlockedAsMember && <span className="court-btn-cost">−1 🪙</span>}
```

par :

```tsx
            {!contestBlockedAsMember && <span className="court-btn-cost">+1</span>}
```

- [ ] **Step 4 : Renommer le libellé du bouton « Influencer » → « Prendre le lieu pour moi »**

Toujours dans `court-btn-contest`, remplacer :

```tsx
              {creatingExp ? 'Préparation…' : (vacant ? 'Poser ma marque' : 'Influencer')}
```

par :

```tsx
              {creatingExp ? 'Préparation…' : (vacant ? 'Poser ma marque' : 'Prendre le lieu pour moi')}
```

- [ ] **Step 5 : Ajouter l'indicateur de solde juste avant la zone d'actions**

Repérer la ligne `{/* Boutons tap-rafale */}` suivie de `<div className="court-actions">`. Insérer juste **avant** ce commentaire :

```tsx
      {/* V0.9.70 — solde visible près des actions : le « coût » se lit ici (le
          compteur descend à chaque tap), puisque les boutons cadrent en « +1 ». */}
      <div className="court-balance">
        <span className="court-balance-icon" aria-hidden>🪙</span>
        <span className="court-balance-label">Tes Couronnes</span>
        <span className="court-balance-amount">{balance}</span>
      </div>
```

- [ ] **Step 6 : Ajouter le style du solde**

Dans `PlaceCourtView.css`, ajouter à la fin du fichier :

```css
/* V0.9.70 — solde de Couronnes affiché près des actions (cadrage « +1 ») */
.court-balance {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(74, 55, 40, 0.7);
  margin: 2px 0 -4px;
}
.court-balance-icon { font-size: 14px; line-height: 1; }
.court-balance-label { letter-spacing: 0.02em; }
.court-balance-amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-ink, #4a3728);
}
```

- [ ] **Step 7 : Vérifier le build TypeScript**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK, aucune erreur TS. (`actionsVis` est déclaré mais pas encore consommé par le JSX — il le sera en Task 3 ; s'il déclenche un warning « unused » bloquant, passer directement le Step 1 de Task 3 avant de rebuild.)

- [ ] **Step 8 : Commit**

```bash
git add apps/explore-web/src/components/places/details/PlaceCourtView.tsx apps/explore-web/src/components/places/details/PlaceCourtView.css
git commit -m "feat(cour): cadrage +1 uniforme, solde visible, libelle 'Prendre le lieu pour moi'"
```

---

## Task 3 : 3e bouton + liste d'attaquants dépliable (avec avatars)

Le cœur de la refonte : surfacer le geste « soutenir un attaquant ».

**Files:**
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.tsx`
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.css`

- [ ] **Step 1 : Ajouter l'état d'ouverture de la liste**

Dans `PlaceCourtView.tsx`, à côté des autres `useState` (après `const [creatingExp, setCreatingExp] = useState(false)`), ajouter :

```tsx
  const [attackersOpen, setAttackersOpen] = useState(false)
```

- [ ] **Step 2 : Conditionner l'affichage du bouton « Soutenir » au helper**

Remplacer la condition d'ouverture du bouton support `{!vacant && (` par `{actionsVis.showSupport && (`. (Le contenu du bouton reste identique.)

- [ ] **Step 3 : Ajouter le 3e bouton dans `.court-actions`**

Juste **après** la fermeture du bouton `court-btn-contest` (la balise `</button>` qui précède la fermeture `</div>` de `.court-actions`), insérer :

```tsx
          {actionsVis.showAttackers && (
            <button
              type="button"
              className={`court-btn-attackers${attackersOpen ? ' is-open' : ''}`}
              onClick={() => setAttackersOpen(o => !o)}
              aria-expanded={attackersOpen}
              aria-controls="court-attackers-list"
            >
              <span className="court-btn-icon">🤝</span>
              <span className="court-btn-label">Soutenir un attaquant ({optimisticChallengers.length})</span>
              <span className="court-btn-chevron" aria-hidden>{attackersOpen ? '▴' : '▾'}</span>
            </button>
          )}
```

- [ ] **Step 4 : Ajouter la liste dépliable après `.court-actions`**

Juste **après** la balise `</div>` qui ferme `<div className="court-actions">`, insérer :

```tsx
      {actionsVis.showAttackers && attackersOpen && (
        <div id="court-attackers-list" className="court-attackers-list">
          {optimisticChallengers.map(c => {
            const isYou = c.userId === userId
            const initial = c.displayName?.trim().charAt(0).toUpperCase() || '?'
            return (
              <div key={c.userId} className={`court-attacker-row${isYou ? ' is-you' : ''}`}>
                <span
                  className="court-attacker-avatar"
                  style={{ borderColor: c.factionColor ?? '#8b3a3a', backgroundColor: c.factionColor ?? '#8b3a3a' }}
                >
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt="" />
                    : <span className="court-attacker-initial">{initial}</span>}
                </span>
                <button
                  type="button"
                  className="court-attacker-name"
                  onClick={() => useMapStore.getState().setSelectedPlayerId(c.userId)}
                  title={`Voir le profil de ${c.displayName}`}
                >
                  {c.displayName}
                  {c.factionPattern && c.factionColor && (
                    <span
                      className="court-attacker-faction-icon"
                      style={{
                        backgroundColor: c.factionColor,
                        WebkitMaskImage: `url(${c.factionPattern})`,
                        maskImage: `url(${c.factionPattern})`,
                      }}
                      aria-hidden
                    />
                  )}
                  {isYou && <span className="court-attacker-you">(vous)</span>}
                </button>
                <span className="court-attacker-score">⚔ {c.score}</span>
                {!isYou && c.expeditionId && (
                  <button
                    type="button"
                    className="court-attacker-tap"
                    onClick={() => queueSupportTap(c)}
                    disabled={balance < 1}
                    aria-label={`Soutenir ${c.displayName}`}
                  >
                    +1
                    {bursts.filter(b => b.key === `chal:${c.userId}`).map(b => (
                      <span key={b.id} className="court-attacker-burst">+1</span>
                    ))}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
```

- [ ] **Step 5 : Ajouter les styles du 3e bouton et de la liste**

Dans `PlaceCourtView.css`, ajouter à la fin du fichier :

```css
/* V0.9.70 — 3e bouton « Soutenir un attaquant » (teinte ambre = ralliement) */
.court-btn-attackers {
  flex-basis: 100%;
  background: linear-gradient(180deg, rgba(245, 235, 210, 0.95), rgba(234, 222, 192, 0.92));
  color: #6a4f1c;
}
.court-btn-attackers .court-btn-icon { color: #b8860b; }
.court-btn-attackers:hover:not(:disabled) {
  background: linear-gradient(180deg, rgba(250, 240, 216, 0.98), rgba(242, 230, 200, 0.95));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 2px 6px rgba(184, 134, 11, 0.22);
}
.court-btn-chevron { font-size: 12px; opacity: 0.7; margin-left: 2px; }

/* V0.9.70 — liste dépliable des attaquants soutenables */
.court-attackers-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: -6px 0 2px;
  padding: 6px 10px;
  border: 1px solid rgba(184, 134, 11, 0.25);
  border-radius: 10px;
  background: rgba(245, 235, 210, 0.35);
}
.court-attacker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
}
.court-attacker-row + .court-attacker-row {
  border-top: 1px solid rgba(193, 154, 107, 0.18);
}
.court-attacker-row.is-you {
  outline: 1.5px dashed rgba(74, 55, 40, 0.3);
  outline-offset: -1px;
  border-radius: 6px;
}
.court-attacker-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #8b3a3a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.court-attacker-avatar img { width: 100%; height: 100%; object-fit: cover; }
.court-attacker-initial {
  font-family: var(--font-accent, 'Cormorant Garamond', serif);
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}
.court-attacker-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 14px;
  color: var(--color-ink, #4a3728);
  cursor: pointer;
  text-align: left;
}
.court-attacker-name:hover {
  text-decoration: underline;
  text-decoration-color: rgba(193, 154, 107, 0.6);
  text-underline-offset: 3px;
}
.court-attacker-faction-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  opacity: 0.85;
}
.court-attacker-you { opacity: 0.6; font-style: italic; font-size: 12px; }
.court-attacker-score {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 12px;
  color: #7a2828;
  white-space: nowrap;
}
.court-attacker-tap {
  position: relative;
  flex-shrink: 0;
  padding: 5px 12px;
  font-family: var(--font-accent, 'Cinzel', 'Cormorant Garamond', serif);
  font-size: 13px;
  font-weight: 700;
  border: 1px solid rgba(184, 134, 11, 0.5);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.14);
  color: #b8860b;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.08s ease;
}
.court-attacker-tap:hover:not(:disabled) { background: rgba(212, 175, 55, 0.24); }
.court-attacker-tap:active:not(:disabled) { transform: scale(0.94); }
.court-attacker-tap:disabled { opacity: 0.4; cursor: not-allowed; }
.court-attacker-burst {
  position: absolute;
  top: -4px;
  right: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #b8860b;
  pointer-events: none;
  animation: court-burst 0.85s ease-out forwards;
}
```

(`@keyframes court-burst` est déjà défini plus haut dans ce fichier — on le réutilise.)

- [ ] **Step 6 : Vérifier le build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK, aucune erreur TS, `actionsVis` désormais consommé.

- [ ] **Step 7 : Commit**

```bash
git add apps/explore-web/src/components/places/details/PlaceCourtView.tsx apps/explore-web/src/components/places/details/PlaceCourtView.css
git commit -m "feat(cour): 3e bouton + liste depliable des attaquants soutenables (avatars)"
```

---

## Task 4 : `PatronsList` en lecture seule (une seule surface d'action)

Retire le bouton « Soutenir » du palmarès : l'action vit désormais dans le 3e bouton de la zone d'actions.

**Files:**
- Modify: `apps/explore-web/src/components/places/details/PatronsList.tsx`
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.tsx`
- Modify: `apps/explore-web/src/components/places/details/PatronsList.css`

- [ ] **Step 1 : Retirer les props d'action de l'interface `PatronsListProps`**

Dans `PatronsList.tsx`, supprimer ces trois entrées de l'interface `PatronsListProps` (avec leurs commentaires) :

```tsx
  /** V0.8.23 — tap « Soutenir » sur un challenger (1 clic = 1 Couronne créditée). */
  onSupportTap?: (c: Challenger) => void
  /** V0.8.23 — désactive les boutons Soutenir (plus de Couronnes en stock). */
  supportDisabled?: boolean
  /** V0.8.23 — bursts en cours, clé `chal:<userId>` pour un challenger. */
  bursts?: { id: number; key: string }[]
```

- [ ] **Step 2 : Retirer ces props de la signature de la fonction**

Remplacer la déstructuration :

```tsx
export function PatronsList({ patrons, currentUserId, veilleurUserId, scoreVeilleur, expeditionTitle, coVeilleurs, challengers = [], onSupportTap, supportDisabled, bursts = [] }: PatronsListProps) {
```

par :

```tsx
export function PatronsList({ patrons, currentUserId, veilleurUserId, scoreVeilleur, expeditionTitle, coVeilleurs, challengers = [] }: PatronsListProps) {
```

- [ ] **Step 3 : Retirer le bouton « Soutenir » du bloc challenger**

Dans le `.map` des challengers, supprimer entièrement ce bloc :

```tsx
                {onSupportTap && currentUserId !== c.userId && c.expeditionId && (
                  <button
                    type="button"
                    className="patron-support-btn"
                    onClick={() => onSupportTap(c)}
                    disabled={supportDisabled}
                    title={`Soutenir ${c.displayName} (1 🪙)`}
                  >
                    🪙 Soutenir
                    {bursts.filter(b => b.key === `chal:${c.userId}`).map(b => (
                      <span key={b.id} className="patron-support-burst">+1</span>
                    ))}
                  </button>
                )}
```

- [ ] **Step 4 : Retirer les props d'action passées par `PlaceCourtView`**

Dans `PlaceCourtView.tsx`, dans le rendu `<PatronsList ... />`, supprimer ces trois lignes :

```tsx
        onSupportTap={queueSupportTap}
        supportDisabled={balance < 1}
        bursts={bursts}
```

> Note : `queueSupportTap`, `balance` et `bursts` restent utilisés ailleurs (liste d'attaquants de Task 3) — ne pas supprimer leurs déclarations.

- [ ] **Step 5 : Nettoyer le CSS orphelin de `PatronsList.css`**

Dans `PatronsList.css`, supprimer les règles devenues mortes :

```css
.patron-support-btn {
  position: relative;
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid rgba(212, 175, 55, 0.5);
  border-radius: 6px;
  background: rgba(212, 175, 55, 0.12);
  color: #d4af37;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.08s ease;
}
.patron-support-btn:hover {
  background: rgba(212, 175, 55, 0.22);
}
.patron-support-btn:active {
  transform: scale(0.94);
}
.patron-support-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Burst « +1 » qui s'envole depuis le bouton Soutenir (cf. court-btn-burst) */
.patron-support-burst {
  position: absolute;
  top: -4px;
  right: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #d4af37;
  pointer-events: none;
  animation: patron-support-burst-rise 0.9s ease-out forwards;
}
@keyframes patron-support-burst-rise {
  0%   { opacity: 0; transform: translateY(0) scale(0.8); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-22px) scale(1.1); }
}
```

- [ ] **Step 6 : Vérifier le build (aucun import/var orphelin)**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK. Si TS signale `Challenger` importé mais inutilisé dans `PatronsList.tsx`, vérifier : il reste utilisé par la prop `challengers?: Challenger[]` → l'import doit rester. Aucune erreur attendue.

- [ ] **Step 7 : Commit**

```bash
git add apps/explore-web/src/components/places/details/PatronsList.tsx apps/explore-web/src/components/places/details/PatronsList.css apps/explore-web/src/components/places/details/PlaceCourtView.tsx
git commit -m "refactor(cour): PatronsList en lecture seule (action remontee dans la zone d'actions)"
```

---

## Task 5 : Vérification manuelle, changelog, déploiement

Pas d'infra de test composant (RTL) dans le projet → vérification à l'écran sur les trois états.

**Files:**
- Modify: `apps/explore-web/CHANGELOG.md`

- [ ] **Step 1 : Lancer l'app en dev**

Run: `cd apps/explore-web && pnpm dev`
Ouvrir http://localhost:3000.

- [ ] **Step 2 : Vérifier l'état « lieu vierge »**

Ouvrir un lieu vierge (vacant) → onglet Infos → La Cour.
Attendu : un seul bouton `⚔ Poser ma marque` avec `+1`. Pas de bouton « Soutenir », pas de 3e bouton. Indicateur « Tes Couronnes : N » visible.

- [ ] **Step 3 : Vérifier l'état « veillé, 0 attaquant »**

Ouvrir un lieu veillé sans challenger.
Attendu : deux boutons `🛡 Soutenir {veilleur}` + `⚔ Prendre le lieu pour moi`, chacun avec `+1`. Pas de 3e bouton. Jauge de tension + facepile (avatar veilleur avec 👑) + gélule compagnie si veille à plusieurs : intacts.

- [ ] **Step 4 : Vérifier l'état « veillé, ≥1 attaquant » + dépliage**

Ouvrir un lieu sous pression (au moins un challenger).
Attendu : 3e bouton `🤝 Soutenir un attaquant (N)`. Au clic, la liste se déplie : chaque attaquant a avatar + nom (clic → profil) + icône faction + score + bouton `+1`. Taper `+1` : burst animé, score optimiste +1, solde « Tes Couronnes » décrémenté. Le tap sur sa propre ligne n'a pas de bouton (mention « (vous) »).

- [ ] **Step 5 : Vérifier le palmarès « Mécènes du lieu »**

Déplier l'accordéon « Mécènes du lieu ».
Attendu : standings complets (mécène #1, ↳ Soutiens, ⚔ Challengers + leurs ↳ Soutiens) — mais **plus aucun bouton « Soutenir »** dans cette liste. Noms cliquables → profils.

- [ ] **Step 6 : Vérifier solde 0**

Avec un compte à 0 Couronne (ou après dépense) : tous les boutons d'action + taps `+1` désactivés, message « Vous n'avez plus de Couronnes… » affiché.

- [ ] **Step 7 : Bump version dans le CHANGELOG**

Dans `apps/explore-web/CHANGELOG.md`, insérer tout en haut du fichier (avant `# ALPHA V0.9.69`) :

```markdown
# ALPHA V0.9.70
## La Cour, enfin limpide : soutenir, conquérir, rallier

La fiche de lieu montre désormais d'un coup d'œil **les trois façons d'agir** : soutenir le veilleur en place, prendre le lieu pour toi, ou **rallier un attaquant** déjà lancé (y compris d'une autre Maison — les alliances spontanées sont de retour au grand jour). Le bouton « Soutenir un attaquant » déploie la liste des prétendants avec leur portrait, et ton solde de Couronnes reste sous les yeux à chaque geste.

---

```

- [ ] **Step 8 : Build final**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK.

- [ ] **Step 9 : Commit + push**

```bash
git add apps/explore-web/CHANGELOG.md
git commit -m "feat(cour): V0.9.70 - refonte des actions de La Cour (3 gestes explicites)"
git push
```

- [ ] **Step 10 : Déploiement Netlify (manuel)**

Run: `cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build`
(Le déploiement est manuel — jamais d'auto-deploy Git. Vérifier en prod sur app.runesdechene.com après.)

---

## Self-Review (effectuée)

**Couverture spec :**
- Boutons adaptatifs 1/2/3 → Task 1 (helper) + Task 3 (câblage). ✔
- Libellés explicites « pour qui » → Task 2 Step 4 (« Prendre le lieu pour moi »), Task 3 (« Soutenir un attaquant (N) »), bouton support garde le nom du veilleur (inchangé). ✔
- 3e bouton masqué si 0 attaquant → Task 1 (`showAttackers`) + test. ✔
- Dépliage liste attaquants avec avatars → Task 3 Step 4-5. ✔
- Cadrage « +1 » partout + solde visible → Task 2. ✔
- Tap-rafale / create_challenger / garde-fous solde+membre / vacant → conservés (code existant non touché sur ces points). ✔
- Éléments de clarté préservés (jauge, facepile, gélule, ligne veilleur, statut) → aucun changement sur `CourtTensionBar` ni sur les lignes veilleur. ✔
- `PatronsList` lecture seule → Task 4. ✔
- Zéro SQL → confirmé, aucune tâche migration. ✔

**Placeholders :** aucun TODO/TBD ; tout le code est fourni.

**Cohérence des types :** `getCourtActionsVisibility(vacant: boolean, challengerCount: number)` identique entre helper, test et appel ; `Challenger` (avec `avatarUrl`, `factionColor`, `factionPattern`, `expeditionId`, `score`, `supporters`) tel que défini dans `types/court.ts` ; `queueSupportTap(c: Challenger)`, `bursts: {id,key}[]` clé `chal:<userId>` cohérents avec l'existant.
