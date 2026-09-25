---
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Interface — CSS, composants, direction artistique

> Ce qui a déjà cassé à l'écran, et les conventions visuelles arrêtées par Uriel.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## Carousel horizontal CSS — un container flex+overflow-x doit avoir flex:1 dans un wrapper flex pour respecter la largeur parent

**Le piège** (rencontré 2026-05-02 sur les carousels lieux du PlayerProfileModal) :
un container avec `display: flex; overflow-x: auto` qui contient des items à largeur
fixe (`flex: 0 0 auto`) ne respecte PAS automatiquement la largeur de son parent.
Par défaut, le container s'élargit à la somme de ses enfants. Donc même avec
`padding-left: 30px`, le padding existe mais le container déborde du parent →
visuellement les tiles paraissent collées au bord (padding "perdu" dans le scroll).

**Why:** spec CSS — un flex container ou un block avec overflow ne se contraint
pas spontanément à `width: 100%` du parent. Il faut soit `width: 100%` explicite,
soit `min-width: 0` (que `flex: 1` implique automatiquement quand le container
est lui-même dans un flex parent).

**How to apply:** quand je fais un carousel horizontal d'items à largeur fixe :
1. Wrapper en `display: flex` autour du container scroll.
2. Container scroll en `flex: 1` (+ `display: flex; overflow-x: auto; gap; padding`).
3. Items en `flex: 0 0 auto` (largeur fixe).

C'est exactement le pattern de `.player-modal-fragments-wrapper` + `.player-modal-fragments-row`
dans ce projet. Je dois copier ce trio à la lettre, pas inventer un seul élément
combiné qui ne marchera pas.

**Règle dérivée** : si Uriel dit "fais comme X qui marche déjà", je copie X
verbatim — structure HTML + classes CSS + propriétés flex — au lieu de
re-déduire ma propre solution. Inventer un raccourci a coûté cinq commits
et plusieurs allers-retours énervés sur cette session.

## ProfileMenu (desktop) et MobileHeader (mobile) — toujours modifier les deux ensemble

**Le piège** (rencontré 2026-05-02) : j'avais retiré l'option "Référentiel calendaire" de `ProfileMenu` mais j'ai oublié que le menu mobile vit dans `MobileHeader.tsx` séparément — ce dernier n'avait JAMAIS eu l'option calendrier non plus, mais aussi pas le toggle GPS ni "Changer email". Uriel s'est retrouvé sur mobile sans pouvoir désactiver le brouillage GPS — feature critique.

**Why:** les deux composants ont historiquement été dupliqués (style menu différent, hamburger vs avatar circle), pas mutualisés. À chaque ajout d'option dans l'un, l'autre désync silencieusement. Aucune erreur TS, aucun test ne l'attrape.

**How to apply:** dès que je touche `ProfileMenu.tsx` (auth/) ou `MobileHeader.tsx` (map/) :
1. Ouvrir AUSSI l'autre fichier en parallèle.
2. Vérifier que les options du menu sont identiques entre les deux.
3. Si je viens d'ajouter une option dans ProfileMenu, l'ajouter dans MobileHeader avec le même JSX (les classes CSS `profile-dropdown-action` etc. sont communes).
4. Idem pour `useState` / handlers : copier verbatim si la logique est identique.

**À faire en cleanup** : extraire un sous-composant `<UserMenuContent>` qui contient tous les boutons (Voir profil / Faction / Changer email / GPS toggle / Se déconnecter), et l'utiliser depuis les 2 wrappers (ProfileMenu = avatar trigger + dropdown desktop, MobileHeader = hamburger trigger + dropdown mobile). Une seule source de vérité pour les options.

## Textes toujours trop petits

Ne JAMAIS descendre en dessous de 15px pour du texte lisible sur le web. Le body doit être 18px minimum pour du contenu qu'on lit. Les labels/breadcrumbs au minimum 14-15px.

**Why:** Uriel a signalé 3 fois dans la même session que les textes étaient trop petits. Quand XO "corrigeait" il passait de 13→14px, ce qui ne changeait rien. C'est un biais systémique vers l'esthétique "élégante petite" au détriment de la lisibilité.

**How to apply:** À chaque création de CSS, vérifier que AUCUN texte de contenu n'est en dessous de 15px. Body/description/contributions = 18-20px. Labels uppercase = 15-16px minimum. Breadcrumbs = 15px. Boutons = 15px. Ne pas faire de +1px cosmétique quand le problème est structurel.

## UI sobre logiciel — jamais RPG/carton-pâte

Pour toute UI RdC : viser **logiciel sobre + atmosphère parchemin discrète**. Jamais de surcharge décorative façon Skyrim/Hearthstone/RPG.

**Why** : Uriel le 2026-05-01 quand j'ai proposé une modale Campement avec blason scellé, besace cuir, panneau de bois clouté, médaillon ornemental, lueur de feu animée, étoiles : *« Non, ça fait RPG, pas logiciel, ça va être galère. »*

**Comment réussir le ressenti narratif sans glisser dans le RPG** :
- Titres narratifs au lieu d'administratifs ("Mon parcours" plutôt que "Stats", "Mes routes" plutôt que "Lieux explorés")
- Une seule touche "physique" assumée (ex: punaise rouge sur la note épinglée)
- Atmosphère parchemin chaud uniforme, voile très léger en bas si pertinent
- Cards parchemin sobres, pills sépia, polices serif italiques pour les titres
- Préserver le **style actuel de l'application** (cards, pills, fragments existants) — ne pas réinventer la roue à chaque écran

**À NE PAS faire** (rejeté explicitement par Uriel) :
- Blason scellé, médaillon ornemental, besace cuir ouverte, carte parchemin déroulée avec rouleaux, panneau de bois clouté, header en cuir clouté
- Lueur de feu de camp animée, étoiles éparses en arrière-plan
- Tout ce qui ressemble à un inventaire MMO ou à une fiche de personnage Donjon & Dragons

**How to apply** : à chaque proposition d'UI, faire le test « ça ressemble plus à un logiciel pro avec une touche RdC, ou à un jeu RPG ? ». Si RPG → simplifier. La référence d'esthétique de la marque (Chevalier Errant, Friedrich Wanderer) est **cinématographique sobre**, pas vidéoludique.

## GameToast — actorId set ⟹ highlights[0] DOIT être le nom de l'acteur

**Règle :** dans `GameToast.tsx`, le binding clic suit la convention :
- `toast.actorId` set ⟹ `highlights[0]` est le nom de l'acteur (clic = ouvre profil)
- `toast.placeId` set ⟹ `highlights[1]` (ou `[0]` si pas d'actorId) est le nom du lieu (clic = ouvre lieu)

**Why :** Uriel a remonté ce bug **plusieurs fois** ("encore une fois je le répète" — 8/05). Cas concret : toast `harvest_crown` dans `loadRecentActivityToasts.ts` avait `highlights=[place]` mais passait `actorId` → GameToast bindait le clic du lieu au profil acteur. Bug invisible au build, qui survit aux refactors.

**How to apply :**

1. **Toujours auditer le couple (highlights[0], actorId)** quand tu touches `usePlayer.ts` ou `loadRecentActivityToasts.ts` ou tout endroit qui construit un GameToast. Pose-toi : "le premier highlight correspond-il bien au nom passé en `actorId` ?"

2. **Pour les toasts self-only** (récolte, mini-quête, etc.) où le verbe est "Vous + ..." : pousser explicitement `'Vous'` en première position de `highlights` (et garder `actorId` si tu veux que cliquer sur 'Vous' ouvre ton propre profil), OU ne pas passer `actorId` du tout (et alors le `highlights[0]` peut être directement le lieu).

3. **Convention écrite, pas implicite** : si je crée un nouveau type de toast, ajouter un commentaire au-dessus de l'addToast genre :
```ts
// highlights = [actorName, placeName] — actorId mappe sur [0], placeId sur [1]
```

4. **Fix pattern existant** : la fonction `buildCourtToast` (court) utilise déjà un flag `hasActorInHighlights` que les autres types n'ont pas. Si on rebascule un jour ces conventions, généraliser ce flag à GameToast plutôt que de relier sur la position.

**Précédents** : ce bug est arrivé au moins 2 fois en mai 2026. Si une 3e fois, refactorer en flag explicite.

## reference_faction_color_readable_ink

La couleur de Compagnie est **choisie librement par le joueur** (blanc inclus — revendiqué par les Bretons « La blanche hermine »). Utilisée brute, une couleur claire devient **invisible** sur le fond parchemin (#F5E6D3). Bug remonté 25/06, corrigé en ~5 passes (j'ai oublié des spots à chaque fois → faire le sweep GLOBAL `src/` d'emblée, pas dossier par dossier).

**Règle pour toute UI teintée par `faction.color` (`apps/explore-web/src/lib/textFormat.ts`) :**
- **Texte / bordure / accent** (`color:`, `borderColor:`, CSS `var(--faction-ink)`) → `readableInk(hex)` : fonce une couleur trop claire jusqu'au contraste WCAG (blanc → gris lisible ; couleur déjà foncée → inchangée).
- **Pastille pleine** (`background:` = la couleur : dot, avatar, gros bouton) → garder la **vraie** couleur (le blanc = identité) + `readableTextOn(hex)` pour le texte posé dessus + fine bordure pour la détacher du fond.
- Pattern CSS var : poser `--faction-color` (vraie) **et** `--faction-ink` (= `readableInk`) ; le CSS utilise `--faction-ink` pour le texte.

Ne PAS interdire le blanc à la saisie : on règle au **rendu**. Les `tag.color` (palette contrôlée) et bannières admin ne sont PAS concernés.

## Icône Couronne (monnaie) = pièce d'or 🪙, JAMAIS la couronne 👑

**L'icône de la monnaie « Couronne » dans l'app Runes de Chêne est `🪙` (pièce d'or).** Pas `👑`.

**Why :** "Couronne" est le nom de l'unité monétaire (référence à la couronne tchèque/scandinave, terme historique pour une pièce de monnaie en métal précieux), pas à la couronne royale. L'icône reflète ça : c'est une pièce, pas un bijou. Uriel l'a recadré le 7 mai 2026 quand j'ai écrit `+1 👑` dans le toast de découverte. Le pattern visuel est en place dans tout le code (`CrownsBadge`, `EnigmaResult`, `HarvestableChests`, toasts de récolte, `PlaceCourtView`, `CourtChronicle`, `loadRecentActivityToasts`, etc.).

**How to apply :**

- Toute copy user-facing affichant un montant Couronne → utiliser `🪙` comme icône.
- Format compact dans toasts : `+1 🪙` (préféré au verbeux `+1 Couronne` quand l'espace est compté, en cohérence avec `+1 Gloire / +1 Coupe`).
- Format verbeux dans messages plus longs : `... récolté X Couronne(s) 🪙` (icône en suffixe), pattern utilisé dans les toasts de récolte chest et enigma.
- **Ne jamais** utiliser `👑` pour la monnaie Couronne. Si tu vois ce caractère pour signifier la monnaie, c'est un bug à corriger.

## Pilule sous marker = principal mécène (le plus de points, sur place OU à distance)

**Règle absolue figée par Uriel le 9 mai 2026 (en criant — je l'ai déjà fait répéter trop souvent) :**

La pilule sous le marker d'un lieu sur la carte = **la personne qui a le plus de points sur ce lieu**.

- ✅ Peu importe que les points aient été faits sur place (GPS) ou à distance (Couronnes)
- ✅ C'est le total des points sur le lieu qui compte (defense agrégée par user)
- ❌ **Ne pas confondre** avec le "veilleur historique" (celui qui a planté en premier l'étendard) — ce concept n'existe pas comme indicateur visible
- ❌ Ne pas demander à Uriel de re-confirmer cette règle, c'est figé

**Implémentation** : RPC `get_map_veilles` (mig 149) trie les members par `defense_total DESC` puis `user_id ASC`. Le frontend `VeilleurNamePills.tsx` affiche `members[0]` (le top mécène) sous le marker via `pushVeilleOverride`.

**Comprend bien la sémantique** :
- "Veille" = un lieu peint aux couleurs d'une faction (place_veille row existe)
- "Veilleur principal" du lieu = celui qui a le plus contribué à le tenir (top defense)
- "Mécène" et "veilleur" sont synonymes côté UX (terminologie Mécénat V0.7 phase 5 a remplacé Cour)

**Pourquoi je l'oublie** : confusion entre 2 systèmes ("Expédition" V0.7+ Événement P2P livré 6 mai vs "expedition" au sens veille V0.7 = solo d'1 user) + tendance à interpréter "veilleur" comme "celui qui a planté". Cf. mémoire `feedback_decouvrir_vs_visiter_gps.md` qui pointe la même tension distance/GPS.

Si jamais je suis tenté de redemander à Uriel "tu veux X ou Y pour la pilule", **STOP** : la réponse est ici. Top points → premier sous le marker. Toujours.

## Maquettes UX — Visual Companion (brainstorm A/B/C) ou React + pnpm dev (preview pixel-perfect)

## La règle

Quand Uriel demande une maquette UX, choisir entre deux workflows officiels selon le contexte :

### Workflow A — Visual Companion (skill `superpowers:brainstorming`)

**Quand l'utiliser** : exploration de **plusieurs directions A/B/C/D** au stade brainstorming. Pas encore de décision sur la direction, on veut comparer.

**Comment** : invoquer le skill `superpowers:brainstorming` et utiliser le **visual-companion**. Lancer le serveur :

```bash
"C:/Users/uriel/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/scripts/start-server.sh" \
  --project-dir "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
```

Sur Windows : **`run_in_background: true` obligatoire** sur le tool Bash, sinon le serveur bloque la conversation. Le script auto-détecte Windows et passe en foreground mode.

Le serveur retourne un JSON avec :
- `port` (random, ex: 52341)
- `url` (ex: `http://localhost:52341`)
- `screen_dir` (où écrire les HTML)
- `state_dir` (où lire les events de clic)

**Pattern A/B/C** : écrire un fichier HTML dans `screen_dir` (genre `tension-options.html`) avec :
```html
<h2>Question</h2>
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content"><h3>Option A</h3><p>...</p></div>
  </div>
  <!-- B, C, D ... -->
</div>
```

Le frame template du serveur enrobe le contenu (header, CSS thème, infrastructure interactive). On peut soit écrire un fragment (préféré), soit un `<!DOCTYPE html>` complet pour contrôle total.

L'user clique pour sélectionner. Lire `state_dir/events` au tour suivant pour récupérer la sélection.

**Persistence** : avec `--project-dir`, les fichiers vivent dans `<projet>/.superpowers/brainstorm/<session-id>/`. À ajouter à `.gitignore`.

### Workflow B — React mockup + `pnpm dev`

**Quand l'utiliser** : preview **pixel-perfect** d'un composant déjà décidé, avec les vraies CSS variables / fonts / stack du projet. Validation finale avant implémentation prod.

**Comment** :
1. Composant React temporaire dans `apps/explore-web/src/dev/<NomMockup>.tsx` (utilise les vraies `--color-ink`, `--font-signature`, etc.)
2. Route ajoutée dans `App.tsx` : `<Route path="/dev/<topic>" element={<NomMockup />} />`
3. `pnpm dev` en background depuis `apps/explore-web/` (run_in_background: true)
4. URL : `http://localhost:3000/dev/<topic>` (port 3000 fixe)
5. Hot reload natif

### Quand JAMAIS faire un HTML standalone bricolé

Sauf demande explicite ("fais-moi un HTML statique"), je ne crée plus de mockup HTML autonome dans `.superpowers/brainstorm/<date>/mockup.html` à la main. Je passe par l'un des deux workflows officiels.

## Why

Uriel l'a recadré le 8 mai 2026. J'oscillais en silence entre :
- Le Visual Companion (que j'utilisais parfois "spontanément" sans expliquer)
- Le HTML standalone bricolé
- Sans jamais offrir le React + pnpm dev

L'inconstance était frustrante : le Visual Companion est super pratique pour brainstorm A/B/C mais je ne le déclenchais qu'aléatoirement. Il a fallu une enquête sur les plugins installés (`~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/visual-companion.md`) pour identifier l'outil et écrire cette règle.

## How to apply

**Mots-clés qui déclenchent un mockup visuel** : "maquette", "mockup", "preview", "simulation", "fais-moi du visuel", "lance le visual editor", "frontdesign", "visual companion"

**Pour choisir entre A et B** :
- "Plusieurs propositions / directions à comparer" → Workflow A (Visual Companion)
- "Le composant X de la page Y, comment ça rend ?" → Workflow B (React mockup)
- En doute → demander à Uriel : "exploration A/B/C ou preview pixel-perfect ?"

**Toujours lancer en background sur Windows** (`run_in_background: true`).

**Cleanup obligatoire** : à la fin du sprint mockup, supprimer les composants `dev/` ou les fichiers HTML obsolètes. Ne pas laisser pourrir.

## Trace

- 8 mai 2026 — session V0.7.6 — premier essai HTML standalone bricolé pour la Court Tension Bar, recadrage Uriel ("pourquoi pas un serveur React ?"), création composant React + pnpm dev, puis re-recadrage ("avec l'autre système t'utilisais un port différent et 3 propositions"). Fouille dans les plugins pour identifier le Visual Companion. Cette règle ferme la confusion.
