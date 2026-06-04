# Mission — Le Pacte : refonte de la modale Mission

> Spec design · 2026-06-04 · explore-web · `components/missions/MissionModal.tsx`
> Statut : validé en maquette (compagnon visuel), prêt pour le plan d'implémentation.

## Problème

La `MissionModal` actuelle « fait trop événement, pas assez j'accepte la mission » :

- L'adhésion est **silencieuse** : un `useEffect` appelle `joinMission()` dès l'ouverture si l'on n'est pas participant. Aucun geste, aucun seuil.
- La **description** (`m.brief`) est un simple `<p>` coincé entre la cover, le butin et la galerie : peu de place, et surtout **aucun saut de ligne respecté** (texte plat, pas de mise en forme).
- Le seul vrai bouton d'engagement est `🛒 Voir le produit`, un lien discret qui ressemble à « visiter la boutique » plutôt qu'à « relever un défi ».

## Vision

Transformer l'ouverture d'une mission en **pacte à sceller**. Le joueur lit l'ordre, puis franchit un seuil explicite (« Je relève ce défi »). Tant que le pacte n'est pas scellé, le cœur social de la mission (Salon, contributions, soumission) reste **verrouillé**. Le commerce s'invite **dans le moment d'engagement**, pas en lien passif.

Direction de mise en page retenue : **« Le Dossier »** — on lit l'ordre en grand, le pacte clôt la lecture.

## Décisions validées

| Sujet | Décision |
|-------|----------|
| Mécanique du pacte | Le pacte **déverrouille** la mission. Fini l'auto-join silencieux. |
| Lien boutique | **Discret, sous l'ordre**, uniquement si la mission a un produit (`ctaUrl`). |
| Texte riche | **Sauts de ligne / paragraphes** seulement (`white-space: pre-line`). Pas de Markdown, zéro parseur. |
| Nom | On garde **« Mission »** (section panneau + onglet modale inchangés). |
| Bouton-pacte | **Barre d'action collée en bas**, dorée chaude, sceau en relief. Toujours visible au scroll. |
| Confirmation boutique | Au clic, si la mission a un produit → **modale de confirmation** « As-tu déjà le produit ? ». |
| Branche « Non » | « Non » ouvre la boutique **ET** scelle le pacte (l'engagement n'est jamais perdu). |

## Les deux états de l'onglet Mission

### État verrouillé (`!isParticipant`)

De haut en bas, dans la zone scrollable :

1. **Onglets** — `Mission` actif · `🔒 Salon` grisé (non cliquable).
2. **Intro** — eyebrow `Mission · N engagés`, titre, appel (`m.call`) en italique.
3. **Cover** 16:9 avec pastille `J-X` et emblème (inchangé).
4. **L'ordre** — `<h3>L'ordre</h3>` + la description (`m.brief`) en `white-space: pre-line`, avec une vraie respiration verticale. **C'est le héros de l'écran.** Sous l'ordre, si `m.ctaUrl` : lien discret `🛒 {ctaLabel}` (style pointillé sobre).
5. **Butin** — chips Gloire / Couronnes / `rewardHint` (inchangé) + note « Récompense fixée à la validation ».

Collée en bas (hors zone scroll), une **barre d'action** : bouton plein largeur `⚔ Je relève ce défi`, gradient doré (`#b9803f → #8a5a26`), relief de sceau, ombre portée chaude. Au-dessus de la barre, un fondu pour que le contenu scrollé passe proprement dessous.

> Le rappel « 🔒 Le Salon et les contributions s'ouvrent une fois le pacte scellé » des maquettes intermédiaires est **abandonné** : la barre d'action dorée + l'onglet Salon grisé suffisent à signifier le verrou sans surcharger.

### État débloqué (`isParticipant`)

1. **Onglets** — `Mission` · `Salon` (les deux actifs).
2. **Bandeau « engagé »** — remplace la barre d'action. Encart vert (`rgba(94,112,68,…)`) : sceau vert estampillé `✓` + « **Pacte scellé.** Tu es l'un des N engagés. » Placé juste sous l'intro/cover.
3. **L'ordre** + lien boutique discret (identiques).
4. **Butin** (identique).
5. **Les contributions · N** — galerie 3 colonnes (existant).
6. **Statut pending** si `myStatus === 'pending'` (existant).
7. **Action principale** — `📷 Ajouter ma contribution` (existant, encre noire) **non collée** : c'est l'action de l'engagé, pas le seuil.

## La modale de confirmation (« As-tu déjà le produit ? »)

Déclenchée par le clic sur `Je relève ce défi`.

- **Si `m.ctaUrl` est absent** (mission sans produit) → pas de modale, on scelle directement (`joinMission` → état débloqué).
- **Si `m.ctaUrl` est présent** → petit dialog par-dessus la modale Mission (overlay propre à la modale, pas un second portal plein écran) :
  - Vignette produit (emblème ou cover en fallback) + question : « Avant de sceller — As-tu déjà **{ctaLabel}** pour accomplir ta mission ? »
  - Bouton primaire **`⚔ Oui — je scelle le pacte`** → `joinMission`, ferme le dialog, bascule en état débloqué.
  - Bouton secondaire **`🛒 Pas encore — montre-moi la boutique`** → ouvre `m.ctaUrl` (`target=_blank`) **et** `joinMission`, puis bascule en état débloqué.
  - Note de bas : « Dans les deux cas, te voilà engagé. »

## Flux d'engagement (machine à états)

```
ouverture modale
  └─ getMissionState(slug)
       ├─ isParticipant === true  → rendu ÉTAT DÉBLOQUÉ
       └─ isParticipant === false → rendu ÉTAT VERROUILLÉ
                                       └─ clic « Je relève ce défi »
                                            ├─ pas de ctaUrl → joinMission() → DÉBLOQUÉ
                                            └─ ctaUrl → dialog confirmation
                                                 ├─ « Oui »  → joinMission() → DÉBLOQUÉ
                                                 └─ « Non »  → window.open(ctaUrl) + joinMission() → DÉBLOQUÉ
```

L'optimisme local suffit : après `joinMission()` on passe `isParticipant: true` en state et on incrémente `participantsCount` localement (déjà le pattern actuel). En cas d'erreur RPC, on reste en état verrouillé + toast d'erreur.

## Changements techniques

- **`MissionModal.tsx`**
  - Retirer l'auto-join du `useEffect` (lignes ~22-25). On charge l'état tel quel ; le `useEffect` ne join plus.
  - Nouvel état local : `confirming: boolean` (dialog produit ouvert), `sealing: boolean` (RPC en vol).
  - Rendu conditionnel verrouillé/débloqué sur `m.isParticipant`.
  - Handler `sealPact(openShop: boolean)` : `joinMission(slug)` → maj state optimiste ; si `openShop`, `window.open(m.ctaUrl)` d'abord (geste utilisateur préservé).
  - Onglet `Salon` non cliquable tant que `!isParticipant`.
- **`MissionModal.css`**
  - `.mission-modal-brief` → ajouter `white-space: pre-line`.
  - Nouvelle barre d'action collée (`.mission-modal-pactbar` + `.mission-modal-pact`), bandeau engagé (`.mission-modal-engaged`), dialog confirmation (`.mission-modal-confirm*`).
  - Le `.mission-modal-cta` (lien boutique) reste mais passe en style « lien discret pointillé » sous l'ordre.
- **Pas de SQL.** `get_mission_state` expose déjà `isParticipant`, `ctaUrl`, `ctaLabel`, `participantsCount`. `join_mission` existe.

## Hors scope (YAGNI)

- Markdown dans le brief (sauts de ligne suffisent).
- Animation célébratoire du sceau au moment du clic (à voir plus tard si l'envie vient — pas bloquant).
- État « engagé » propagé hors modale (badge sur la carte du panneau, compteur, notif). Parqué.
- Renommage de la feature.

## Critères de réussite

- Ouvrir une mission **ne join plus** automatiquement (vérifiable : `participants` n'augmente pas tant qu'on n'a pas scellé).
- Le brief affiche ses sauts de ligne.
- Le bouton-pacte est visible sans scroller, et le reste pendant le scroll.
- Cliquer « Je relève ce défi » sur une mission avec produit ouvre la confirmation ; « Non » ouvre la boutique et engage ; « Oui » engage.
- Une fois engagé, Salon + contributions + soumission sont accessibles, et le bandeau « Pacte scellé » remplace la barre d'action.
