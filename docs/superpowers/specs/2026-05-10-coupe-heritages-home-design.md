# Coupe des Héritages — Section Home — Design

**Date :** 2026-05-10
**Auteur :** Uriel + XO
**Statut :** Design validé par Uriel le 10 mai 2026, prêt pour le plan d'implémentation
**Branche cible :** nouvelle branche depuis `main` (nom à confirmer dans le plan, suggestion `coupe-heritages-home`)

---

## 1. Contexte

La Coupe des Héritages (V0.7 phase 3) est aujourd'hui matérialisée sur la `/carte` mobile via deux composants : la `FactionBar` (jauges verticales schématiques en surimpression de la carte) et le `CoupeBadge` (compteur de score perso dans la toolbar carte). Les deux ne sont visibles que si l'utilisateur a activé le mode `factionColorMode` dans la `HeritagesToggle`.

Avec l'arrivée de la home mobile (V0.7.8, hub des 3 piliers), Uriel veut **rendre la Coupe omniprésente** : toujours visible à l'arrivée sur l'app, sans dépendre d'un toggle, dans une mise en page assumée et soignée. À terme, cette section remplacera la `FactionBar` carte — mais pas dans ce chantier (la `FactionBar` reste en place tant que les usages se cannibalisent pas).

**Inquiétude game design tranchée pendant le brainstorming** : montrer le classement aux utilisateurs sans Maison risque de déclencher un effet bandwagon (tout le monde rejoint le leader). Décision : la section présente **deux états** distincts — un état compétitif (avec Maison) et un état neutre de présentation (sans Maison) qui ne révèle pas le classement.

---

## 2. Périmètre

### Inclus

- Nouvelle section sur la home `/accueil` (mobile-only V1) : `<CoupeHeritagesSection>`
- Deux états de rendu :
  - **Avec Maison** : podium I-II-III en parchemin clair + 4ème en pied + pilule d'identité utilisateur
  - **Sans Maison** : coupe SVG en hero + texte d'introduction + 4 bannières neutres
- Comportements clic granulaires (cf. §4)
- Hook de refetch au retour sur l'onglet (event `visibilitychange`)
- Câblage de la modale `FactionModal` (sélection/changement de maison) accessible depuis le bouton CTA et les bannières onboarding

### Exclus de ce chantier

- **`FactionBar` sur la carte** : reste en place. Sera dégagée plus tard quand le toggle `factionColorMode` sera reconsidéré.
- **`CoupeBadge` toolbar carte** : inchangé.
- **Polling 30s** : pas de polling périodique. Refetch au mount + au retour focus uniquement.
- **Desktop** : la home est mobile-only (cf. `2026-05-09-home-mobile-hub-design.md`). Pas de pivot desktop dans ce chantier.
- **Lore définitif des 4 Maisons** : la spec utilise les vrais `factions.title`, `factions.color` et `factions.pattern` de la DB. Le wording d'introduction de l'état onboarding (le texte sous la coupe) est figé dans ce spec et peut être affiné par Uriel à la review.
- **Animations d'entrée** : pas d'animation de comptage de score, pas de "podium qui se révèle". Statique. Si on en veut plus tard, chantier séparé.
- **Inter-saison** : si pas de saison active (`get_coupe_state` retourne `season: null` ou erreur), la section est masquée (`return null`). La gestion de l'inter-saison fera l'objet d'un design séparé.

---

## 3. Architecture

### 3.1 Placement dans HomePage

Ordre des sections après changement (HomePage.tsx) :

1. `DailyEnigmaCard` (énigme du jour)
2. `home-card` Événements & Quêtes
3. `PlacesSection` (lieux récents)
4. **`CoupeHeritagesSection` (nouvelle)** ← inséré ici
5. `MapActivityList` (activité de la carte)

```tsx
<section className="home-section">
  <CoupeHeritagesSection openFactionModal={openFactionModal} />
</section>
```

### 3.2 Câblage de la `FactionModal`

La `FactionModal` (de sélection des Maisons) est aujourd'hui montée par `MobileLayout.tsx` et déclenchée via une callback `setShowFactionModal(true)` passée à `MobileTopBar`. Pour que `CoupeHeritagesSection` puisse l'ouvrir, `MobileLayout` expose la callback à ses enfants via **Outlet context** de React Router :

```tsx
// MobileLayout.tsx
<Outlet context={{ openFactionModal: () => setShowFactionModal(true) }} />
```

```tsx
// HomePage.tsx
const { openFactionModal } = useOutletContext<{ openFactionModal: () => void }>()
```

Pas de nouveau store. Pas de prop drilling au-delà d'un niveau. Pattern React Router prévu pour ce cas.

### 3.3 Composants nouveaux

Tous dans `apps/explore-web/src/components/home/coupe/`.

| Fichier | Responsabilité |
|---|---|
| `CoupeHeritagesSection.tsx` | Orchestrateur. Fetch via `useCoupe(autoLoad=true, pollMs=0)`. Hook `visibilitychange` pour refetch. Aiguillage rendu Podium / Onboarding selon `userFactionId`. Monte localement `FactionMembersModal` et `CoupeModal`. |
| `CoupePodium.tsx` | État "avec Maison" (C1). Top 3 sur podium, 4ème en pied, pilule "ta maison Xème", footer "▸ Voir le classement complet". |
| `CoupeOnboarding.tsx` | État "sans Maison" (E2). Coupe SVG hero, texte d'introduction, 4 bannières alignées, CTA "⚜ Choisir ma Maison". |
| `CoupeHeritages.css` | Styles partagés (cadre parchemin, embl&egrave;mes, marche or, banni&egrave;res, CTA bouton). |

Si `CoupeHeritagesSection.tsx` dépasse 300 lignes au moment de l'implémentation, extraire les sous-composants. Sinon, OK de garder tout dans le même fichier (Podium et Onboarding sont mutuellement exclusifs).

### 3.4 Pas de nouvelle RPC

Le `useCoupe` hook existant et la RPC `get_coupe_state` couvrent tous les besoins :
- `state.season` → titre saison affiché en sous-titre de la section
- `state.factions[]` → trié par score desc, on prend les 3 premiers pour le podium et le 4ème pour le pied
- `state.myBreakdown?.score` → non utilisé directement (on affiche le score de SA Maison, pas son score perso). À garder en tête pour une éventuelle pilule "tu as contribué Y pts à ta Maison" plus tard.

### 3.5 Pas de modification du store ou de la DB

Couche purement frontend. Aucune migration. Aucun `playerStore` field nouveau.

---

## 4. UX / Comportements

### 4.1 État "avec Maison" — `CoupePodium`

```
┌─────────────────────────────────────────────────┐
│ ⚜ COUPE DES HÉRITAGES                           │
│   — Saison du Renouveau                         │
│ ┌─────────────────────────────────────────────┐ │
│ │           [Cerf]    👑[Lion]    [Dauphin]   │ │
│ │           sylvestre  d'Or       d'Argent    │ │
│ │           412        540        293         │ │
│ │           ┌──┐      ┌──┐                    │ │
│ │           │II│      │I │      ┌──┐          │ │
│ │           │  │      │  │      │III          │ │
│ │           └──┘      └──┘      └──┘          │ │
│ │  ─────────────────────────────────────────  │ │
│ │  [emblème] Corbeau Noir · 164 pts ·         │ │
│ │            à 129 du podium                  │ │
│ │                                             │ │
│ │       [⚜ Ta maison est 2ème · 128 du sommet]│ │
│ │                                             │ │
│ │       ▸ Voir le classement complet          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Données affichées :**
- Titre section : "⚜ Coupe des Héritages — {seasonName}"
- Top 3 (factions[0..2] triés par score desc) sur podium I-II-III
- 4ème (factions[3]) en pied : embl&egrave;me + nom + score + écart au podium (`factions[2].score - factions[3].score`)
- Pilule identité (variantes selon le rang) :
  - User 1er avec score > 0 : "⚜ Ta Maison m&egrave;ne la course"
  - User 2-4e avec score > 0 : "⚜ Ta Maison est {ordinal}ème · {écart} du sommet" — où `écart` = `factions[0].score - userFaction.score`
  - Toutes les Maisons à 0 pt (début saison) : "⚜ Ta Maison · 0 pts"
- Footer cliquable : "▸ Voir le classement complet"

**Cas particuliers du podium :**
- Toutes les Maisons à 0 pt (début de saison) : podium affiché, **pas de couronne** sur le 1er, pilule "Ta Maison · 0 pts"
- Une seule Maison a des points : podium normal, couronne sur la Maison qui a marqué, pilule normale
- Si la Maison de l'utilisateur est sur le podium (top 3) : son embl&egrave;me a un contour or de 2px (`outline: 2px solid #b8860b`)
- Si la Maison de l'utilisateur est 4ème : la ligne 4ème a un fond légèrement teinté or (`background: rgba(184,134,11,0.08)`)
- Hypothèse "4 Maisons en DB" : le design suppose `factions.length === 4`. Si la DB en a moins (configuration dev/test), le code doit dégrader gracieusement (pas de crash sur `factions[3]` undefined). Plan d'implémentation : `if (factions.length < 4) return null` + warn console — c'est un état impossible en prod, on cache la section.

**Comportements clic :**
- Click sur une marche du podium ou la ligne 4ème → ouvre `FactionMembersModal` de cette Maison (state local `selectedFactionId`)
- Click sur le titre de section, le fond du frame, la pilule "ta maison", ou le footer → ouvre `CoupeModal` (state local `showCoupeModal`)
- La pilule "ta maison" pourrait à terme ouvrir directement la `CoupeModal` scrollée sur sa Maison ; pour V1, ouvre la modale au début (pas de scroll).

### 4.2 État "sans Maison" — `CoupeOnboarding`

```
┌─────────────────────────────────────────────────┐
│ ⚜ COUPE DES HÉRITAGES                           │
│   — Saison du Renouveau                         │
│ ┌─────────────────────────────────────────────┐ │
│ │                  [coupe SVG]                │ │
│ │              avec halo doré                 │ │
│ │                                             │ │
│ │         Une saison. Quatre Maisons.         │ │
│ │  Chaque énigme résolue, chaque lieu visité, │ │
│ │   chaque récit partagé fait grandir         │ │
│ │   l'héritage de ta Maison. À la fin,        │ │
│ │   l'une d'elles soulève la Coupe.           │ │
│ │  ─────────────────────────────────────────  │ │
│ │   [Lion]   [Cerf]   [Dauphin]  [Corbeau]    │ │
│ │   d'Or     Sylv.    d'Argent   Noir         │ │
│ │                                             │ │
│ │       [    ⚜ Choisir ma Maison    ]         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Données affichées :**
- Titre section identique
- Coupe SVG dorée centrée (~86px) avec halo doré radial
- Accroche en `font-family: Cinzel`, italic ou non : "Une saison. Quatre Maisons."
- Texte d'introduction (italique, parchemin) : *"Chaque énigme résolue, chaque lieu visité, chaque récit partagé fait grandir l'héritage de ta Maison. À la fin de la saison, l'une d'elles soulève la Coupe."*
- 4 bannières alignées en `flex: 1` chacune (embl&egrave;me + nom court sur 2 lignes max)
- Bouton CTA full-width "⚜ Choisir ma Maison"

**Comportements clic :**
- Click sur une bannière (embl&egrave;me ou nom) → appelle `openFactionModal()` (passé via Outlet context). La modale s'ouvre sur la liste des Maisons. *V1 : pas de pré-scroll/highlight sur la maison cliquée. À envisager pour V2 si UX trop frustrante.*
- Click sur bouton CTA → idem, `openFactionModal()`
- Pas de classement affiché, pas de scores, pas de couronne, pas de drama. Présentation pure des héritages.

### 4.3 Refresh

```ts
// Dans CoupeHeritagesSection
const { state, refresh } = useCoupe(true, 0)

useEffect(() => {
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') refresh()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}, [refresh])
```

- Mount → fetch (autoLoad=true sur le hook)
- Retour sur l'onglet (visibilitychange = visible) → refetch
- Pas de polling 30s (différent du `FactionBar` carte qui en a un)

### 4.4 Loading / Error

- **Loading initial** (`state === null && loading`) : `return null` pendant le fetch. Pas de skeleton — la section apparaît une fois les données disponibles. Si > 600ms (rare), on peut ajouter un skeleton dans une itération future. Pour V1 : flash invisible.
- **Error** (`error` non null) : `return null` + `console.warn('[CoupeHeritagesSection] get_coupe_state failed', error)`. Même pattern que `FactionBar`.
- **`state.season === null`** ou `state.factions.length === 0` : `return null`. Inter-saison ou DB vide → on cache la section, on n'affiche pas un état dégradé.

---

## 5. Détails visuels (palette home)

Tous les tokens sont en cohérence avec le style de la home (parchemin clair `#faf2dd`, sépia `#b8945e`, encre `#2a1f10`).

### Cadre commun (Podium + Onboarding)

- `background: #f4e4b8` (parchemin légèrement plus chaud)
- `border: 1px solid #b8945e`
- `border-radius: 14px`
- `padding: 14px 12px 10px` (Podium) / `padding: 20px 14px 14px` (Onboarding — plus d'air en haut pour la coupe hero)
- `box-shadow: inset 0 0 18px rgba(184,148,94,0.18)` — inner glow sépia subtil

### Marche du 1er sur podium

- `background: linear-gradient(180deg, #e8c869 0%, #b8860b 100%)` (or)
- `box-shadow: inset 0 -2px 4px rgba(74,55,40,0.3)`
- Hauteur 64px (vs 48px pour la 2nde, 36px pour la 3ème)
- Chiffre romain `I` en `font-family: 'Cinzel'`, taille 18px, color `#2a1f10`

### Couronne 👑

- Emoji posé au-dessus de l'embl&egrave;me du leader (16px, `margin-bottom: 2px`)
- Pas affichée si `factions[0].score === 0`

### Embl&egrave;me d'une Maison

- Cercle de 38px (top 3) ou 42px (Onboarding banni&egrave;res) ou 20px (4ème en pied)
- `background: var(--faction-color)` (depuis `factions.color`)
- `<img src={faction.pattern} filter: brightness(0) invert(1)>` à l'intérieur si `pattern` non null (l'embl&egrave;me devient un sigle blanc sur fond couleur — pattern existant, cf. `FactionBar`)
- Si `userFactionId === faction.id` (Podium) : `outline: 2px solid #b8860b; outline-offset: 2px`

### Pilule identité (Podium)

- `padding: 3px 10px`, `border-radius: 999px`
- `background: rgba(184,134,11,0.18)`, `border: 1px solid rgba(184,134,11,0.4)`
- `color: #6a5008`, `font-family: 'Cinzel'`, `font-size: 10px`, `text-transform: uppercase`, `letter-spacing: 0.08em`

### Footer "Voir le classement complet" (Podium)

- `font-size: 10px`, `color: #8a6f4a`, `letter-spacing: 0.1em`, `text-transform: uppercase`
- `text-align: center`, `margin-top: 10px`

### Coupe SVG (Onboarding)

- Inline SVG dans le composant (pas d'asset externe). Hauteur 86px.
- Définitions de gradients `cupGold` et `cupShine` dans `<defs>` (cf. mockup `onboarding-hero.html`).
- Halo : `<div>` absolument positionné autour, `background: radial-gradient(ellipse at center, rgba(232,200,105,0.32) 0%, transparent 60%)`.
- `filter: drop-shadow(0 4px 8px rgba(74,55,40,0.35))` sur le SVG.

### CTA bouton "Choisir ma Maison" (Onboarding)

- Full-width, `padding: 11px 16px`, `border-radius: 999px`
- `background: linear-gradient(180deg, #e8c869 0%, #b8860b 100%)`
- `border: 1px solid #8a6508`
- `color: #2a1f10`, `font-family: 'Cinzel'`, `font-size: 12px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.08em`
- `box-shadow: 0 2px 6px rgba(184,134,11,0.4), inset 0 -2px 3px rgba(74,55,40,0.2)`
- Texte exact : "⚜ Choisir ma Maison"

### Texte d'intro (Onboarding)

- Accroche : "Une saison. Quatre Maisons." en `Cinzel`, 13px, weight 600
- Texte long en `Georgia` italique, 11.5px, color `#6a4f2a`, `line-height: 1.5`, `margin: 0 14px 16px`
- Wording figé pour V1 : *"Chaque énigme résolue, chaque lieu visité, chaque récit partagé fait grandir l'héritage de ta Maison. À la fin de la saison, l'une d'elles soulève la Coupe."*

---

## 6. Tests à effectuer (avant merge)

- [ ] Mobile, user dans une Maison, saison active, embl&egrave;mes chargent → voir Podium correct, Maison surlignée or
- [ ] Mobile, user dans une Maison qui est 4ème → ligne 4ème teintée or, pas de surbrillance podium
- [ ] Mobile, user sans Maison → voir Onboarding, click bannière ouvre `FactionModal`, click CTA ouvre `FactionModal`
- [ ] Click sur une marche du podium → `FactionMembersModal` de cette Maison s'ouvre
- [ ] Click sur titre / fond / footer → `CoupeModal` complète s'ouvre
- [ ] Retour sur l'onglet après absence → refetch (vérifier en console que la RPC est rappelée)
- [ ] `get_coupe_state` renvoie une erreur → section cachée, warning console
- [ ] Inter-saison simulée (RPC retourne `season: null`) → section cachée
- [ ] Toutes Maisons à 0 pt → podium affiché sans couronne, pilule sans rang
- [ ] Desktop : pas de régression — la home `/accueil` n'existe pas sur desktop, la carte n'est pas touchée
- [ ] Build `pnpm --filter explore-web build` passe (TS strict, pas de `any`)

---

## 7. Open questions / TODO avant le plan

Aucun. Le design est figé. Le wording d'introduction peut être affiné par Uriel à la review du spec, mais ça ne change pas le plan d'implémentation (juste une string à modifier).

---
