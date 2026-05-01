# V0.7 — Articulation Campement / Quêtes / Influence à distance

> **Statut** : méta-spec d'articulation, design validé Uriel le 2026-05-01.
> **Rôle** : cadre commun aux 3 sous-systèmes V0.7 à venir, fixe leurs frontières et leur ordre d'implémentation.
> **Suite V0.7** : déclenchée après livraison V0.7.0 (Niveaux, Couronnes, Coupe, Gloire refondue, Veille — déployée le 2026-05-01).
> **Sous-spécifications à venir** : un sous-spec dédié pour chacun des trois sous-systèmes (Campement, Quêtes, Influence à distance), avec son propre brainstorm de détail si nécessaire avant le plan d'implémentation.

---

## 1. Contexte & motivation

V0.7.0 a livré le système de **Niveaux** (refonte Gloire en XP), les **Couronnes** (cap 15/jour, source/sink), la **Coupe** (saison), la **Veille** (gardienage GPS) et la refonte des **toasts/wordings**. Voir [`2026-05-01-v07-niveaux-design.md`](2026-05-01-v07-niveaux-design.md), [`2026-04-30-v07-veille-plantage.md`](2026-04-30-v07-veille-plantage.md).

Restent **3 sous-systèmes** que Uriel veut livrer avant l'été 2026 (objectif : *« que les gens puissent se rencontrer et partir à l'aventure ensemble d'ici cet été »*) :

1. **Campement** — base permanente du joueur sur la carte, profil transformé en lieu géographique. Remplace `TerritoryPanel` (système de naming de territoires de V0.4-0.5, encore actif en passation douce).
2. **Système de quêtes** — V0.7.0 livre uniquement les mini-quêtes journalières (anti-farm + onboarding). L'archi technique anticipe les expéditions multi-joueurs (V0.8) et les quêtes éditoriales/Campement (V0.7+).
3. **Influence à distance via Couronnes** — mécénat. Permettre d'agir sur des lieux qu'on n'atteindra jamais en GPS, en investissant des Couronnes. Référence : [`project_v07_phase5_influence_distance.md`](../../../.. mémoire) — 4 règles validées, 5 questions techniques restant à trancher.

Ces trois sous-systèmes ne sont **pas indépendants** :
- Le **Campement** consomme des Couronnes (poser/déplacer)
- Les **Quêtes** rapportent des Couronnes (et de l'XP)
- L'**Influence à distance** consomme des Couronnes (mécénat)
- À terme, des Quêtes pourront être émises depuis un Campement (V0.7+) ou être des expéditions multi-joueurs avec point de ralliement (V0.8)

D'où la nécessité de cette méta-spec qui pose le cadre transverse avant que chaque sous-système soit détaillé seul.

---

## 2. Décisions stratégiques (résumé exécutif)

| Décision | Choix retenu | Raison principale |
|---|---|---|
| **Articulation des 3 systèmes** | Méta-spec d'articulation avant 3 sous-specs séparés | Évite que le Campement soit designé seul puis qu'on découvre trop tard qu'il aurait dû héberger les quêtes |
| **Ordre d'implémentation** | 1. Campement → 2. Quêtes → 3. Influence à distance | Campement = pivot UX visible, Quêtes = couche fine au-dessus, Influence à distance = cerise mécénat quand l'économie tourne |
| **Économie Couronnes** | Boucle fermée : Sources (récolte journalière + quêtes) ↔ Sinks (Campement + mécénat) | Un seul jeton transverse, lisibilité maximale |
| **Scope V0.7 des quêtes** | Mini-quêtes journalières seules, archi anticipe expéditions et quêtes éditoriales/Campement | Pareto : on livre ce qui débloque l'anti-farm, on prépare le terrain pour la suite sans la coder |
| **Récompenses quêtes** | XP + petite Couronne pour journalières · Tampons exclusivement pour quêtes éditoriales et expéditions (V0.7+) | Maintient la valeur narrative des tampons (souvenirs) |
| **Présence des joueurs sur la carte** | Bandeau d'avatars permanent compact en haut + traces GPS récentes 7j sur les lieux foulés. Pas de tracking temps réel par défaut. | Sentiment "la carte vit" sans dérive vers le tracking-Strava-toxique |
| **2 modes de Campement** | 🏕️ Fixe (par défaut, payé Couronnes) / 🛞 Nomade (caravane GPS avec imprécision configurable) | Réconcilie les joueurs anti-GPS (fixe) et les pro-GPS (nomade), au choix individuel |
| **LOD à 3 paliers** | Tous les Campements toujours visibles, mais rendu adaptatif selon zoom (riche → compact → marker WebGL natif) | Pas de cluster (Uriel veut tous voir), perf gérée par LOD au lieu de capping |

---

## 3. Vocabulaire & conventions UI

### 3.1 Naming canonique (à respecter dans la spec et l'implémentation)

Aligner sur l'app actuelle (`PlayerProfileModal.tsx`, V0.7.0). La spec utilise les noms suivants :

| Terme spec | Naming UI canonique | Note |
|---|---|---|
| Campement (= profil transformé) | "Campement de [Nom]" | Nouveau (V0.7+) |
| Note éphémère du joueur | "Note" | Naming par défaut. À reconsidérer si "Mot du moment" parle plus en contexte UI (à trancher dans sous-spec Campement) |
| Mur de messages | "Mur" (singulier) ou "Carnet de visite" | Tranché plus tard, "Mur" par défaut |
| Lieux créés par le joueur | "Ajoutés" (onglet existant) | **Ne pas dire "Cartographiés"** dans l'UI — vocabulaire interne uniquement |
| Lieux foulés / explorés GPS | "Explorés" (onglet existant) | Lifetime |
| Lieux foulés récemment | "Visités récemment" | **Nouveau** — section dédiée à 7 jours dans la modale Campement, distincte de l'onglet "Explorés" lifetime existant |
| Lieux veillés | "Veillés" (onglet existant V0.7.0) | Rôle actif de gardien |
| Fragments collectés | **"Fragments possédés"** | Naming canonique strict (cf. `player-modal-fragments-title`) |

### 3.2 Vocabulaire des actions joueur (rappel V0.7.0)

| Verbe joueur (UI) | Action interne |
|---|---|
| **Découvrir** | Sortir un lieu du brouillard (« Le brouillard se lève sur X »). XP : 0 (anti-farm). |
| **Fouler** | Aller physiquement sur place (GPS confirmé). XP : +3 (visite), +1 (revisite). |
| **Cartographier** | Inscrire un nouveau lieu dans la base. UI : "Ajouter un lieu". XP : +20. |

À étendre avec V0.7+ :

| Verbe | Action |
|---|---|
| **Aménager** | Personnaliser son Campement (note, bannière, musique, déco — V0.7+ progressive) |
| **Laisser un mot** | Poster sur le Mur d'un autre Campement |
| **Mécéner** (proposition) | Investir des Couronnes en Influence à distance — naming à valider |

---

## 4. Économie Couronnes (transverse)

Boucle fermée à grande lisibilité, garante que les 3 sous-systèmes coexistent :

### Sources

| Source | Rendement | Cap | Statut |
|---|---|---|---|
| Récolte journalière (V0.7.0) | Variable selon activité | 15 / jour | ✅ livré |
| Quêtes journalières | +1 ou +2 par quête (3-5/jour) | aucun cap, mais limité par #quêtes/jour | ⏳ V0.7 (sous-spec Quêtes) |
| Quêtes éditoriales (par la marque) | Variable | aucun | ⏳ V0.7+ |
| Quêtes émises depuis un Campement | Auto-régulé (le joueur paie la récompense) | aucun | ⏳ V0.7+ |
| Expéditions multi-joueurs | Variable | aucun | ⏳ V0.8 |

### Sinks

| Sink | Coût | Statut |
|---|---|---|
| **Poser son Campement** la première fois | Gratuit ou symbolique (à trancher dans sous-spec Campement) | ⏳ V0.7 |
| **Déplacer son Campement** | Croissant selon **distance aux lieux foulés** par le joueur (poser à 2 km de chez soi : ~5 Couronnes ; à Tokyo : ~200 Couronnes) | ⏳ V0.7 |
| **Activer mode nomade** | Gratuit (toggle simple) | ⏳ V0.7 |
| **Investir en mécénat** (Influence à distance) | 30-50 Couronnes pour faire basculer un lieu (≈ 1 mois de récolte solo) | ⏳ V0.7 (sous-spec Influence à distance) |
| **Défendre son lieu veillé** (Influence à distance — décroître l'attaque) | À calibrer (≈ symétrique à l'investissement attaquant) | ⏳ V0.7 (sous-spec Influence à distance) |

### Calibration

À calibrer dans les sous-spec, en visant un équilibre où :
- Un joueur actif récolte ~10-15 Couronnes/jour (cap actuel)
- Déplacer son Campement localement = ~1/2 jour de récolte
- Faire basculer un lieu en mécénat distant = ~1 mois de récolte (acte rare et investi)
- Aménager son Campement (V0.7+) = consommables narratifs, pas critique

---

## 5. Sous-système 1 — Campement

### 5.1 Définition

Le Campement est la **transformation du profil joueur en lieu géographique sur la carte**. Pas une nouvelle entité distincte du profil — c'est *le profil* qui devient un Campement, ancré spatialement.

Origine du besoin (Uriel) : *« beaucoup de joueuses ne sont pas à l'aise avec la position GPS en temps réel. L'idée c'est de remplacer le partage de position par un point déclaré, où chacun crée sa petite seigneurie. »*

### 5.2 Caractéristiques validées

| Aspect | Décision |
|---|---|
| Cardinalité | **1 Campement par joueur**, obligatoire |
| Placement | **Libre** sur la carte. Coût en Couronnes selon distance aux lieux foulés du joueur (auto-régulation économique, pas de règle moralisatrice) |
| Modes | 🏕️ **Fixe** (point ancré) / 🛞 **Nomade** (caravane qui suit la position GPS, imprécision configurable, défaut ~500m, ajustable par le joueur) |
| Bascule | Toggle dans la modale du Campement. Désactiver Nomade → retour au point Fixe mémorisé. Activer Nomade → quitte le point Fixe sans le perdre |
| Visibilité | **Toujours affiché**, même hors ligne (juste un peu plus discret — couleur atténuée si offline) |
| Donne le nom au territoire qui l'entoure | Oui — remplace le `TerritoryPanel` (les RPCs `propose_territory_name`, `vote_territory_name`, `get_territory_votes` doivent être migrées en no-op au moment du dev — cf. mémoire `project_v07_territory_panel_todo.md`) |

### 5.3 Vision long terme — "Mon chez-moi"

Philosophie centrale : *« Le Campement, c'est mes souvenirs. J'ai envie de l'aménager, j'ai envie d'en faire quelque chose de bien. »*

Éléments d'aménagement progressivement débloquables (**V0.7+, pas dans le V0.7.0 initial**) :

- **Bannière** (illustration en haut de la modale du Campement)
- **Musique** (lien vers une chanson — Spotify/YouTube/lien direct, intégré comme un mini-player)
- **Déco** (éléments visuels autour du Campement sur la carte)
- **Skin évolutif selon niveau** (feu de camp → tente → maison forte → château). V0.7.0 livre **2 assets seulement** : feu de camp (mode Fixe) + chariot (mode Nomade). L'évolution skin selon niveau est V0.7+.
- **Suggestion automatique du mode nomade** au login si la position GPS détectée est éloignée de la position GPS habituelle moyenne (= moyenne mobile des positions de login). V0.7+.

Ces éléments doivent être **anticipés dans la modélisation** (table flexible, champs nullable) sans être implémentés dans V0.7.0.

### 5.4 Sur la carte — composition visuelle

Esthétique : **médaillon parchemin sépia** style RdC (proche de la maquette PNG `Prototype Campement.png` produite par Uriel le 2026-05-01).

Composition palier 1 (zoom rapproché) :
- Médaillon ovale ornemental
- **Avatar du joueur** en cercle haut
- **« Campement de [Nom] »** en italique serif
- **Note éphémère** du joueur sur 1-2 lignes
- **Vignette dessinée** (feu de camp si Fixe, chariot si Nomade)

### 5.5 LOD à 3 paliers (gestion de la performance)

Tous les Campements sont **toujours visibles** (Uriel : pas de cluster). La perf est gérée par adaptation du rendu selon zoom :

| Zoom | Rendu | Tech |
|---|---|---|
| **Rapproché** (≥ 12, ville) | Médaillon parchemin riche : avatar + nom + note + vignette | Marker HTML/SVG (joli mais coûteux) |
| **Moyen** (8-12, région) | Médaillon compact : avatar + prénom seul. Bordure dorée pulsante = mode nomade. | Marker HTML léger |
| **Dézoom** (< 8, France/monde) | Petit point coloré héritage + mini-icône (feu/chariot, 12px). Halo doré pulsant si nomade. | **Layer natif MapLibre WebGL** — supporte 5000+ markers sans broncher |

Transition progressive (zoom/dézoom) sans rechargement.

### 5.6 Bandeau de présence sociale

Pour qu'un joueur **voie qui est connecté** sans dépendre du zoom de la carte :

- **Bandeau permanent compact** en haut, sous le HUD (prend ~7% de hauteur écran)
- **Auto-scroll horizontal** (vitesse ~1 avatar/seconde, pause au tap, reprise après ~2s d'inactivité)
- **Toi en premier**, fixe à gauche (ne scroll pas)
- **Ordre prioritaire** : (1) avec note 📜, (2) connectés sans note triés activité récente, (3) actifs dernières 24h
- **Avatars 36px** avec :
  - Pastille verte = en ligne maintenant
  - Badge 📜 = note posée à voir (lié aux notifications)
  - Mini-icône bas-gauche = mode (🏕️ fixe / 🛞 nomade)
- **Tap sur avatar** → la carte se **téléporte/zoom** sur le Campement de la personne (animation pan+zoom ~700ms)
- À l'arrivée, le médaillon riche du Campement affiche sa note (palier 1), depuis lequel un tap ouvre la modale complète

**Note technique** : la barre de progression actuelle des lieux découverts (zone du haut) doit être **déplacée** pour libérer la place. Emplacement candidat : intégrée à un autre élément du HUD ou en bas dans le bottom nav. À traiter dans le sous-spec Campement.

**Pas de redondance avec la note affichée sur la carte** :
- À zoom rapproché → la note s'affiche directement dans le médaillon de la carte
- À dézoom → la note disparaît du médaillon, et c'est là que le badge 📜 du bandeau prend tout son sens (signal qu'il y a une note quelque part)

### 5.7 Modale du Campement

S'ouvre au tap sur un médaillon de Campement (sien ou autre).

**Layout** :
- **Desktop** (≥ 768px) : 1 colonne principale + **drawer Mur** repliable à droite. Layout asymétrique **~68/32** (drawer ouvert) ou **~95/5** (drawer fermé). Pas de double colonne 50/50. Drawer ouvert par défaut, repliable si l'utilisateur veut plus d'espace.
- **Mobile** (< 768px) : bottom sheet draggable (peek 30% / half 70% / full 95%). Pas de drawer latéral (pas la place). Le Mur est accessible via une vue plein écran dédiée (slide-in droite) au tap d'un bouton "📜 Mur (5)".

**Sections (colonne principale, ordre)** :

1. **Header** : avatar grand + nom (« Campement de [Nom] ») + **titre composé en sous-titre discret** (« Maître Légionnaire de Rome ») + faction + pills (NV X, mode 🏕️/🛞, distance "à 18 km")
2. **Note** : bulle parchemin avec la note éphémère du moment (éditable in-place si le Campement est mien, sinon lecture seule)
3. **Stats clés** : 5 valeurs en ligne, fond crème pointillé : 🪙 Couronnes · 🏆 Coupe · 🎖️ Gloire · 🏞️ Foulés · ⛏️ Cartographiés (ou "Ajoutés" en UI)
4. **Titres** : pills sépia en ligne. Pas de titre redondant ("Titres" pas "Titres et Hauts faits")
5. **Fragments possédés** : grille de cartes mini-illustrées encadrées. **Préserver le design existant** (`player-modal-fragments`, `player-modal-fragments-row`). Naming canonique strict.
6. **Lieux Ajoutés** (créés par le joueur) — scroll horizontal, ~5 cards visibles
7. **Lieux Veillés** (rôle actif de gardien) — scroll horizontal, bordure rouge + badge "Veille active"
8. **Visités récemment** (7 derniers jours) — scroll horizontal, fond crème pâle, timestamp ("il y a 2h", "hier")

**Pas de barre d'actions en bas** (Uriel : *« le bouton "Voir son Campement sur la carte" est inutile, on a forcément ouvert la modale par là »*).

### 5.7.bis Direction visuelle — "sobre + chaude"

Direction validée Uriel le 2026-05-01 après itérations visuelles. Critère central : **logiciel sobre, pas RPG**. La modale doit donner le **ressenti** de Campement sans tomber dans le carton-pâte façon Skyrim/Hearthstone.

**À faire (touches signifiantes, peu coûteuses)** :
- **Atmosphère discrète** : voile chaud très léger en bas de modale (subtil, pas un effet de feu de camp animé). Texture parchemin chaud uniforme en fond.
- **Titres narratifs** au lieu d'administratifs :
  - "Mon parcours" plutôt que "Stats"
  - "Mes titres" plutôt que "Titres & Hauts faits"
  - "Fragments possédés" (naming canonique, déjà existant)
  - "Lieux ajoutés" / "Lieux veillés" / "Visités récemment" (existants ou nouveaux mais sobres)
  - "Mur · les mots des passants" pour le drawer
- **Note épinglée par une punaise rouge** discrète (seul élément "physique" assumé — la note est posée sur la modale, pas une bulle plate)
- **Drawer Mur** : fond très légèrement décalé (~8% d'opacité chaude) pour le distinguer, sans texture "bois clouté"
- **Style actuel de l'application préservé** : cards parchemin existantes, pills sépia, polices serif italiques pour les titres narratifs et noms

**À ne pas faire (rejeté Uriel — "trop RPG")** :
- ❌ Blason scellé pour les stats
- ❌ Médaillon ornemental pour les titres
- ❌ Besace cuir ouverte pour les fragments
- ❌ Carte parchemin déroulée avec rouleaux pour les lieux
- ❌ Panneau de bois clouté avec planches verticales pour le mur
- ❌ Lueur de feu de camp animée
- ❌ Étoiles éparses en arrière-plan
- ❌ Header en cuir clouté avec coutures dorées

**Justification** : ces éléments font *« RPG, pas logiciel »* et seraient *« galère »* à coder/maintenir cross-device. Les 2 ajouts (titres narratifs + punaise sur note) suffisent à passer de *« page de profil »* à *« espace personnel du voyageur »* sans ralentir le dev ni complexifier les assets.

Maquette de référence : `.superpowers/brainstorm/<session>/content/campement-vision-A-sobre.html`

**Drawer Mur** (à droite, repliable) :
- État fermé (52px) : icône 📜, compteur (5), pulse rouge si non-lu, label vertical "Mur · 1 non lu"
- État ouvert (~36% largeur) :
  - Bouton **"📜 Laisser un mot"** en haut (CTA principal)
  - Notes d'aventurier en colonne verticale (parchemin sépia vieilli, encre brune, légère rotation, coin replié subtil — **pas** des post-its colorés Instagram)
  - Chaque note : auteur + horodatage + texte + badge "↩ N réponses" + pulse rouge si non-lu
  - Tap sur note → ouvre le **fil de discussion** (sous-vue ou modale par-dessus) — conversation à 2 strict (auteur du mot ↔ propriétaire du Campement, **pas** de chat ouvert)

### 5.8 Bouton "+" sur la carte (étendu)

Le bouton "+" actuel (qui propose "Ajouter un lieu") doit être étendu en V0.7+ :
- Tap → menu : **"Ajouter un lieu"** / **"Ajouter une note sur mon Campement"**

À détailler dans le sous-spec Campement.

### 5.9 Notifications push (V0.7)

Liées au Mur et aux Campements :
- *« [Auteur] a laissé un mot sur ton Campement »*
- *« [Auteur] t'a répondu sur le Campement de [Propriétaire] »*
- Tap sur la notif → ouvre directement la note concernée

À détailler dans le sous-spec Campement (intégration FCM/Web Push, déjà partiellement en place).

---

## 6. Sous-système 2 — Quêtes

### 6.1 Scope V0.7.0 (livraison initiale)

**Mini-quêtes journalières automatiques uniquement.**

- 3-5 quêtes générées par jour, par joueur
- Exemples : *« Découvrir 1 lieu aujourd'hui (+5 XP) »*, *« Fouler 2 lieux GPS (+10 XP, +1 Couronne) »*, *« Investir 5 Couronnes en mécénat (+1 Couronne) »*
- **Récompense V0.7.0** : XP + petite Couronne (pas de tampon, pas d'objet narratif)
- **But premier** : *anti-farm de la découverte* (qui rapporte 0 XP en brut depuis V0.7.0) + onboarding gratifiant
- **But secondaire** : poser la base technique du système de quêtes pour la suite

### 6.2 Hors scope V0.7.0 — anticipations techniques requises

L'archi de quêtes doit être conçue dès V0.7.0 pour supporter les types suivants **sans refactor** plus tard :

| Type futur | Description | Statut |
|---|---|---|
| **Quêtes éditoriales (par la marque)** | Uriel publie via le Hub : *« Mois du Romanesque — fouler 3 châteaux médiévaux (+50 XP, badge Romanesque) »*. Apporte du contenu narratif et un levier de com. | ⏳ V0.7+ |
| **Quêtes émises depuis un Campement** | Un joueur peut publier une quête depuis son Campement : *« Fouler l'Abbaye de Cluny et laisser-moi un mot — 10 Couronnes »* (le joueur paie la récompense). Connecte directement Campement et Quêtes. | ⏳ V0.7+ |
| **Expéditions multi-joueurs** | Mission collective avec **slots**, **chat de quête**, validation collective. Permet aux joueurs de se rencontrer et partir à l'aventure ensemble. | ⏳ V0.8 |

### 6.3 Récompenses — règles transverses

| Récompense | Quêtes journalières (V0.7.0) | Quêtes éditoriales (V0.7+) | Expéditions (V0.8) |
|---|---|---|---|
| XP | ✅ | ✅ | ✅ |
| Couronnes | +1-2 | +variable | +variable |
| **Tampons / Stickers** (collectibles narratifs affichés sur le Campement) | ❌ jamais | ✅ exclusif | ✅ exclusif |

**Règle fondatrice** : les tampons sont exclusifs aux quêtes éditoriales et aux expéditions. **Ne pas les attribuer aux quêtes journalières** sous peine de banaliser leur valeur narrative (un tampon doit raconter une histoire, pas s'accumuler par centaines).

Le sous-système Tampons sera designé en V0.7+ avec son propre brainstorm. La modale du Campement V0.7.0 ne contient **pas** de section Tampons (ne pas afficher de section vide).

### 6.4 Architecture technique anticipée

À détailler dans le sous-spec Quêtes. Direction proposée :

- Table `quests` polymorphe avec champ `type` ENUM (`daily` | `editorial` | `campement_issued` | `expedition`)
- Table `quest_participants` (1 ligne par joueur engagé) — utile dès les daily mais nécessaire pour expéditions
- Table `quest_rewards` ou JSON structuré de récompenses (XP, Couronnes, tampon_id...)
- RPC d'attribution / completion / claim
- UI : un "**Tableau de Quêtes**" affichant les quêtes journalières au lancement de l'app (modale ou écran dédié à designer dans le sous-spec)

---

## 7. Sous-système 3 — Influence à distance via Couronnes

### 7.1 Cadrage déjà validé (mémoire)

Référence : mémoire `project_v07_phase5_influence_distance.md` du 2026-05-02.

**4 règles validées** par Uriel pour ne pas réintroduire le frein psychologique de V0.5 :

1. **Influence se gagne uniquement par dépense intentionnelle de Couronnes**. Pas par like, lecture, photo, carnet. Le joueur clique explicitement *« investir X Couronnes pour la faction Y sur ce lieu »*.
2. **Coût douloureux pour supplanter** : ~30-50 Couronnes (≈ 1 mois de récolte solo). Faire tomber un lieu = vrai investissement collectif, pas un clic facile.
3. **Le GPS reste l'autorité ultime** : un veilleur qui revient physiquement reprend le contrôle instantanément, gratuit, peu importe combien de Couronnes ont été investies. La marche prime sur l'or.
4. **Le veilleur peut défendre** son lieu en investissant ses propres Couronnes pour faire **décroître** l'influence ennemie. Levier actif, pas seulement subir.

### 7.2 Métaphore narrative

*« Comme si on était un mécène, qu'on faisait du mécénat ou de l'influence. »* (Uriel)

Le joueur paie cher en Couronnes pour **veiller à distance** sur un lieu lointain qu'il ne peut pas atteindre physiquement (ex : Mongolie, autre pays). C'est un **acte d'investissement symbolique**, qui se mérite et qui se raconte. À noter dans le naming/wording UI.

### 7.3 Questions encore ouvertes (à trancher dans le sous-spec dédié)

| Question | Options identifiées | Notes |
|---|---|---|
| Soustraction vs compteurs parallèles ? | (A) 1 Couronne défense annule 1 Couronne attaque ; (B) compteurs par faction non-veilleur, défense retire de la plus haute | À calibrer pour cas multi-faction attaquant |
| Soutien à une faction qui n'est pas la sienne ? | Probablement oui (V0.5 le permettait via `p_target_faction_id`) | Drôlerie politique : un Celte qui boost les Vikings pour faire chier les Romains |
| Que faire des points d'influence V0.5 actuels (`users.influence_stock`) ? | (A) Conversion en Couronnes au ratio X ; (B) cleanup (les points V0.5 expirent) | Transition mig 022 a défrisé la RPC en attendant ; à trancher au moment du sous-spec |
| Visibilité côté user ? | Jauge par lieu "Vikings 25 / Celtes 18 / Romains 12" ? Seuil affiché ? Notification au veilleur quand attaqué ? | À designer |
| La bascule donne quoi ? | Le lieu devient "tenu par la faction X" (couleur du territoire change). **Pas de veilleur individuel posé** : le lieu attend qu'un humain de la faction y aille en GPS. | L'investisseur principal pourrait avoir un titre/mention "Instigateur de la prise de X" mais pas la veille |

### 7.4 Séquencement par rapport au merge V0.7

Important : la **Phase 5 (Influence à distance) doit arriver avec le pack V0.7 complet** pour éviter une période où prod a deux systèmes parallèles. Mais elle vient **après** le Campement et les Quêtes selon l'ordre fixé en §2.

État technique au 2026-05-01 :
- `place_influence_action` : défrisée (mig 022), comportement V0.5 d'origine
- `_place_influence_action_internal` : intacte depuis baseline
- Tables `place_influence`, `user_place_influence` : actives, alimentées
- `InfluenceFrame.tsx` : `readOnly` retiré sur la branche `v07-veille-plantage` (mais sur `main` = prod, le `readOnly` n'existait pas — donc prod fonctionne sans deploy)

---

## 8. Ordre d'implémentation

**Approche 1 : séquentielle stricte 1 → 2 → 3.**

Justification (cf. §2) :
1. **Campement** = pivot UX, changement le plus visible. V0.7.X livrée seule = effet "wow" qui annonce la nouvelle expérience.
2. **Quêtes journalières** = couche fine au-dessus. V0.7.X+1, ne dépend pas techniquement du Campement (mais un tampon de quête éditoriale future s'affichera sur le Campement → c'est cohérent que le Campement soit déjà là).
3. **Influence à distance** = mécénat. V0.7.X+2, arrive quand l'économie Couronnes est mature : joueurs ont accumulé, ont un Campement à entretenir, des quêtes pour gagner plus. La proposition *« investis 30 Couronnes pour le mécénat à Tokyo »* prend tout son sens.

**Pas d'approche parallèle** : Uriel a tranché — séquentielle propre, chaque pièce sort en prod et marine avant la suivante. Évite la dispersion.

---

## 9. Sous-spécifications à venir

Cette méta-spec est le **cadre d'articulation**. Chacun des 3 sous-systèmes aura son propre sous-spec déclenché par un brainstorm dédié si nécessaire :

| Sous-spec | Filename prévu | Phase brainstorm complémentaire ? |
|---|---|---|
| 1. Campement | `2026-05-XX-v07-campement-design.md` | Détails restants : transition `TerritoryPanel` → naming territorial par Campement, schéma DB (tables `campements`, `campement_messages`, `campement_message_threads`), vue détaillée du fil de discussion au tap d'une note, position GPS habituelle (moyenne), barre de progression à déplacer. |
| 2. Quêtes | `2026-05-XX-v07-quetes-design.md` | Modèle de génération journalière, calibration des récompenses, UI "Tableau de Quêtes", anticipations techniques propres (slots, chat de quête, etc.). |
| 3. Influence à distance | `2026-05-XX-v07-influence-distance-design.md` | Trancher les 5 questions ouvertes (cf. §7.3), refondre `place_influence_action` proprement, transition stock V0.5. |

**Workflow** : pour chaque sous-spec, on (1) brainstorme les zones non encore tranchées, (2) écrit le sous-spec, (3) écrit le plan d'implémentation, (4) implémente.

---

## 10. Risques & dépendances

### 10.1 Risques

| Risque | Mitigation |
|---|---|
| **Performance carte avec tous les Campements affichés** | LOD à 3 paliers (§5.5). Layer natif MapLibre WebGL au dézoom. À tester sur device bas de gamme dès le sous-spec Campement. |
| **Naming UI qui dérive du naming canonique existant** | §3.1 fixe les noms canoniques. Le sous-spec Campement doit citer explicitement les composants existants (`PlayerProfileModal.tsx`) qui doivent être adaptés ou remplacés. |
| **Surcharge des notifications** | Dans le sous-spec Campement : permissions claires, paramètres user pour désactiver certaines notifs. |
| **Économie Couronnes déséquilibrée** | Calibrer dans chaque sous-spec à partir des hypothèses §4. Probablement ajustements post-livraison. |
| **Régression du `TerritoryPanel`** existant | Migrer en no-op les 3 RPCs (`propose_territory_name`, `vote_territory_name`, `get_territory_votes`) au moment du dev Campement. Cf. mémoire `project_v07_territory_panel_todo.md`. |
| **La modale ne "respire" pas assez le Campement** (risque exprimé Uriel le 2026-05-01) | **Mitigation tranchée le 2026-05-01** (cf. §5.7.bis) : direction "sobre + chaude" — atmosphère discrète + titres narratifs ("Mon parcours", "Mes titres", "Mes routes") + punaise rouge sur la note. **Ne pas** glisser vers du RPG (blason, besace, bois clouté, lueur de feu) — Uriel a explicitement rejeté ces options. Vision long-terme §5.3 (bannière, musique, déco) renforce le ressenti progressivement post-V0.7. |

### 10.2 Dépendances et contraintes

- Système Couronnes (V0.7.0 mig 021) **doit être stable en prod** avant de commencer le sous-spec Campement. Statut au 2026-05-01 : ✅ déployé.
- Système Veille (V0.7.0) déjà en prod — `users.veilledPlaces` exposé par `get_player_profile` (mig 032). Réutilisé tel quel par la modale Campement.
- Système Niveaux (V0.7.0) déjà en prod — affiché dans la modale Campement.
- `MapLibre GL JS` déjà en place sur `explore-web` — pas de migration tech.
- Marketing/communication : aucune. Cette V0.7+ est livrable en background, sans com particulière (cohérent avec [feedback_no_instagram_content](mémoire) — RdC en mode cruise).

---

## 11. Annexes

### 11.1 Maquettes produites pendant le brainstorm

Localisation : `.superpowers/brainstorm/<session>/content/` (gitignored — référence locale, conservées pour réimport visuel si besoin lors du sous-spec).

- `campement-carte-composition.html` — 3 niveaux d'affichage du Campement sur la carte (minimal, identifié, riche)
- `campement-lod-3-paliers.html` — simulation visuelle du LOD 3 paliers
- `campement-stories-bandeau.html` — version "stories Instagram" (rejetée, trop redondant)
- `campement-bandeau-presence-simple.html` — version épurée bandeau présence
- `campement-bandeau-mobile-options.html` — 3 options mobile (permanent, AvatarGroup, latéral) — A retenu
- `campement-modale-architecture.html` — première version de la modale (1 colonne mobile, 2 colonnes desktop)
- `campement-modale-postits.html` — mur en carrousel de post-its
- `campement-modale-aventurier.html` — refonte avec esthétique "notes d'aventurier" (rejetée pour cause de bannière)
- `campement-modale-drawer.html` — version finale validée : drawer Mur repliable

### 11.2 Maquette de référence Uriel

`Prototype Campement.png` (Desktop d'Uriel) — esthétique cible du médaillon parchemin sur la carte. Référence visuelle pour le sous-spec Campement.

### 11.3 Sources mémoire pertinentes

- `project_v07_phase5_influence_distance.md` — cadrage Phase 5 (mémoire)
- `project_v07_territory_panel_todo.md` — TODO TerritoryPanel à virer
- `project_v07_niveaux_status.md` — état complet du V0.7.0 livré
- `feedback_simplify_not_complexify.md` — règle de simplicité avant complexité
- `feedback_pareto_durabilite.md` — Pareto durable
