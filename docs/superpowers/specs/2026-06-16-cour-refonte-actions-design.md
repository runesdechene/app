# Refonte des actions de La Cour — clarté des 3 gestes

> Spec design — 2026-06-16
> App : `explore-web` · Fiche de lieu, onglet Infos · Composants `PlaceCourtView` + `PatronsList`

## Problème

Les joueurs ne comprennent pas **comment influencer quelqu'un**. Diagnostic confirmé (les trois à la fois) :

1. **Le 3e geste est caché** — soutenir un challenger précis (alliance cross-faction) n'existe aujourd'hui que dans l'accordéon **replié** « Mécènes du lieu » → personne ne le découvre.
2. **Vocabulaire ambigu** — le bouton « Influencer » ne dit pas *pour qui*.
3. **Pas de modèle mental clair** — les actions sont hétérogènes (2 boutons + 1 liste cachée), donc on ne perçoit pas qu'il s'agit d'un affrontement entre camps qu'on peut librement financer.

## Objectif

Rendre **visibles et explicites les trois gestes** sans perdre l'alliance spontanée cross-faction :

- Soutenir le veilleur en place,
- Prendre le lieu pour soi,
- Soutenir un attaquant existant (rallier un prétendant, faiseur de roi).

Décision écartée : réduire à 2 boutons (soutenir veilleur / soutenir les attaquants de sa faction). Rejetée car elle tue le soutien cross-faction et l'alliance spontanée — qui est un pilier voulu du jeu.

## Direction retenue — « B : trois boutons explicites »

On **garde la structure actuelle** (jauge de tension + facepile + actions) et on fait **remonter le 3e geste** de l'accordéon vers la zone d'actions, sous forme d'un bouton nommé sans ambiguïté qui déplie la liste des attaquants.

### Zone d'actions — boutons adaptatifs selon l'état

| État du lieu | Boutons affichés |
|---|---|
| **Vierge** (vacant) | 1 : `⚔ Poser ma marque` |
| **Veillé, 0 attaquant** | 2 : `🛡 Soutenir {veilleur}` · `⚔ Prendre le lieu pour moi` |
| **Veillé, ≥1 attaquant** | 3 : + `🤝 Soutenir un attaquant (N) ▾` |

### Cadrage du coût — « +1 » partout (uniforme)

Tous les boutons d'action utilisent le **même cadrage « apport »** : chaque tap affiche **`+1`** (le point ajouté au camp), pas un coût par bouton. La règle « ça coûte 1 Couronne » reste vraie et **lisible via le solde global de Couronnes** (compteur HUD) qui décrémente à chaque tap.

- On **retire le libellé de coût `−1 🪙`** des boutons (l'ancien mélangeait `−1 🪙` + burst `+1`, source d'incohérence).
- **Exigence** : le solde de Couronnes du joueur doit rester **visible à proximité des actions** pendant les taps, pour que la dépense reste perceptible. Si le joueur tombe à 0, message « plus de Couronnes » + boutons désactivés (inchangé).
- Le `+1` sert à la fois d'**affordance statique** (ce tap ajoute +1 au camp) et d'**animation burst** au clic.

- **Libellés explicites « pour qui »** (lèvent l'ambiguïté) :
  - Bouton 1 reprend le **nom du veilleur** (solo : `Soutenir Léa` ; compagnie : `Soutenir {nom d'expédition}`), couleur faction du veilleur (doré si neutre).
  - Bouton 2 : `Prendre le lieu pour moi`, couleur faction du joueur.
  - Bouton 3 : `Soutenir un attaquant (N)` avec **compteur N** = nombre de challengers, pour signaler d'emblée qu'il y a des gens à rallier.
- **Le 3e bouton n'apparaît qu'en présence d'au moins un attaquant** (sinon masqué — interface épurée quand c'est calme, et le bouton « surgit » au bon moment = auto-pédagogie).

### Dépliage du 3e bouton

Au clic, la **liste des attaquants en cours** se déplie *inline* sous le bouton (chevron `▾` → `▴`). Chaque ligne attaquant :

- **avatar** (image ou initiale fallback, bordure/fond couleur faction) — cliquable → profil joueur ;
- **nom** + **icône de faction** (pattern masqué + couleur) ;
- **score** d'attaque ;
- bouton **tap de soutien** au cadrage uniforme **`+1`** (cf. section « Cadrage du coût »). Au clic : 1 Couronne débitée au joueur (visible via le solde global), 1 point crédité au score du challenger ; cross-faction libre.

> Cohérence visuelle : les avatars de cette liste reprennent le même traitement que la facepile de la jauge.

### Comportements conservés (existant — ne rien casser)

- **Tap-rafale** : 1 clic = 1 Couronne, score optimiste + animation burst `+1`, debounce + flush vers `invest_crowns`.
- **`Prendre le lieu pour moi`** crée l'expédition-challenger au 1er tap (`create_challenger_expedition`), puis enchaîne le tap.
- **Garde-fous** : bouton désactivé si solde < 1 🪙 ; `Prendre pour moi` désactivé si le joueur est **membre de la compagnie veilleuse** (on ne s'attaque pas soi-même) ; message « plus de Couronnes » sous les boutons.
- **Faiseur de roi** : le challenger soutenu qui dépasse la défense prend le trône (logique serveur inchangée).

### Éléments de clarté à PRÉSERVER intégralement (`CourtTensionBar`)

- **Jauge de tension segmentée** : segment défense + 1 segment par challenger (top-3 + `+N autres`), largeur proportionnelle au score, couleur faction, scores inscrits si segment ≥ 18 %, indice « bascule imminente » quand menace ≥ défense/2.
- **Facepile d'avatars** : défense à gauche (lead décoré 👑), attaquants à droite (leader marqué « menace »), overflow `+N`, chaque avatar cliquable → profil.
- **Gélule compagnie** `🤝 {expédition}` côté défense pour la veille à plusieurs (au lieu de répéter les avatars).
- **Ligne veilleur** : « Veillé par {nom} / par N compagnons », mention « Acquis par sa visite » vs « tient ce lieu à distance », date de plantation.
- **Pilule de statut** top-right (Paisible / Convoité / Sous pression / En siège / Lieu vierge).

### « Mécènes du lieu » (`PatronsList`) → palmarès en lecture seule

L'accordéon reste sous les actions comme **palmarès détaillé** (qui finance qui : mécène principal, soutiens, challengers + leurs soutiens). Mais ses **boutons d'action « Soutenir » sont retirés** : l'action de soutenir un attaquant remonte dans le 3e bouton → **une seule surface d'action**, plus de doublon source de confusion. PatronsList devient purement informatif (noms cliquables → profils, scores).

## Périmètre technique

- **Aucune migration SQL.** `get_place_court_state` renvoie déjà tout le nécessaire : `challengers[]` (score, `supporters`, `expeditionId`, faction), `topPatrons`, `veilleur`, `callerContext`.
- **Front uniquement** :
  - `PlaceCourtView.tsx` : refonte de la zone `.court-actions` → logique d'affichage adaptatif (1/2/3 boutons), nouveau 3e bouton dépliant + sous-liste attaquants avec avatars et tap (réutilise `queueSupportTap` / `pushTap` existants).
  - `PatronsList.tsx` : retrait des boutons `onSupportTap` (et props associées `supportDisabled`, `bursts` si plus utilisées) → composant lecture seule.
  - CSS : `PlaceCourtView.css` (3e bouton + sous-liste), `PatronsList.css` (nettoyage).
- **Pas de régression** sur : tap-burst optimiste, gestion solde, cas vacant, cas membre-de-compagnie, veille à plusieurs (gélule + facepile).

## Hors périmètre (YAGNI)

- Pas de refonte de la jauge ni de la facepile (préservées telles quelles).
- Pas de nouveau modèle de données ni de RPC.
- Pas de refonte de l'onboarding/tutoriel de La Cour (à part le fait que l'UI devienne auto-explicative).

## Critères de succès

- Un joueur découvre les trois gestes **sans déplier d'accordéon**.
- « Soutenir un attaquant » est compris comme « rallier quelqu'un d'autre » grâce au libellé + à la liste nominative avec avatars.
- Aucune régression visuelle sur jauge / avatars / gélule compagnie / statuts.
