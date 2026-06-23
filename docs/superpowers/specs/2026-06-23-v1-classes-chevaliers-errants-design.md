# SPEC 1 — Les Classes (refonte identité V1.0)

> Brainstorm Uriel + XO, 23 juin 2026. Branche `v1-refonte-identite`.
> Première des 4 specs de la campagne identité : **Classes → Compagnies → Territoire/scoring → Saison/récompenses**.
> Socle : `🌳 SPEC — Le Mouvement, les Compagnies & les Classes` (vault) — réaffirme : ennemi = l'Oubli, compétition au niveau Compagnie, classe **neutre au score**.
> Règle chantier : **migrations additives uniquement** (cf. `docs/db/cleanup-v1-identity.md`).

## À retenir (30 sec)

- **4 classes**, chacune un **type de joueur réel** + un **Chevalier Errant** (ombrelle de marque) héritier d'une **figure historique** (dans le lore, jamais dans l'étiquette).
- **Choix direct à l'onboarding** — pas de Quizz du Choixpeau (décidé 19 juin).
- **Mapping 1:1 avec les 4 factions existantes** → migration = simple renommage (additif, pas de collapse 4→3).
- L'identité ci-dessous est **verrouillée** (23 juin). La **mécanique** (bonus, onboarding détaillé, migration technique) reste à spécifier plus bas.

---

## 1. Identité — VERROUILLÉE (23 juin 2026)

Les quatre sont **tous des Chevaliers Errants** de la Confrérie de la Rune de Chêne (ombrelle = esthétique de marque). Ce qui les distingue : **leur façon de combattre l'Oubli** — et, dans le lore, la **figure historique** dont chacun est l'héritier.

> *« La Confrérie de la Rune de Chêne rassemble tous ceux qui, à travers l'Histoire, ont combattu l'Oubli. »* — cadre lore qui absorbe le syncrétisme (païen + chrétien + antique).

| Couleur (migration) | Classe | Type de joueur | Arme contre l'Oubli | Héritier (lore) |
|---|---|---|---|---|
| 🟣 Violet (ex-Chevauchée du Crépuscule) | **L'Archiviste** | la mémoire des hommes (histoire, ruines, monuments) | il **retient** | les moines-copistes |
| 🟢 Vert (ex-Pèlerins des Brumes) | **Le Pèlerin** | l'âme de la nature (sacré, vivant, païen) | il **vénère** | les druides |
| 🔵 Bleu (ex-Garde Boréale) | **Le Rôdeur** | l'appel de l'inconnu (découverte) | il **rouvre** | les grands navigateurs |
| 🔴 Rouge (ex-Bâtisseurs d'Airain) | **Le Protecteur** | ce qui doit durer (garde, défense, soin) | il **garde** | les Hospitaliers |

### Descriptions — écran de choix

> Format : phrase d'accueil + ligne de valeurs en gras, ancrée sur l'Oubli. Voix parchemin/aventure (pas de witchy, pas de corporate).

**🟣 L'Archiviste** · *héritier des moines-copistes*
> L'Archiviste accueille ceux qui refusent que les choses disparaissent. Quand un lieu s'efface, c'est lui qui le retient ; quand une histoire s'éteint, c'est lui qui la rallume.
> **Son combat n'est pas contre les hommes, mais contre l'Oubli lui-même.**

**🟢 Le Pèlerin** · *héritier des druides*
> Le Pèlerin accueille les âmes contemplatives, ceux qui entendent une présence dans une source, un vieux chêne, une pierre levée — et qui s'inclinent là où d'autres ne voient qu'un décor.
> **Il refuse que le monde oublie qu'il est encore vivant et sacré.**

**🔵 Le Rôdeur** · *héritier des grands navigateurs*
> Le Rôdeur accueille les cœurs sans repos, ceux que l'horizon appelle et qui s'enfoncent là où les chemins s'effacent, pour débusquer les lieux que le monde a cessé de fouler.
> **Quand une route s'oublie, c'est lui qui la rouvre.**

**🔴 Le Protecteur** · *héritier des Hospitaliers*
> Le Protecteur accueille les âmes loyales et constantes, ceux qui ne se contentent pas de trouver un lieu mais veillent sur lui, le défendent et le soignent pour qu'il ne retombe pas dans la nuit.
> **Ce qu'il a juré de garder, l'Oubli ne le reprendra pas.**

### Décisions de naming (rationale)

- **Pas de Quizz du Choixpeau** : choix direct (décidé 19 juin). Les classes ne s'affrontent plus → l'équilibrage que le quiz visait n'a plus lieu d'être.
- **« Archiviste » gardé** malgré sa sobriété : c'est le **cadre Chevalier Errant** qui l'anoblit (vs « Érudit », écarté). Crainte d'Uriel = un nom de métier peu choisi ; réponse = le cadre + la description *ennemi juré de l'Oubli*.
- **« Druide » → lore, jamais label** : trop fort, trop celte, aimant à défaut. Le label sobre **« Le Pèlerin »** (continuité avec la faction verte) évite la sur-sélection et l'enfermement celtique ; druide = ancêtre dans le lore.
- **Pas de classe « Conquérant »/« Champion »** : l'ennemi est l'Oubli, pas l'autre joueur. La compétition pure vit au niveau **Compagnie**. Les 4 classes restent nobles, non-agressives, neutres.
- **4 plutôt que 3** : mapping 1:1 avec les factions existantes (migration triviale, additive), et le joueur « nature/sacré » est distinct du joueur « histoire/mémoire ».

---

## 2. Mécanique — À SPÉCIFIER (brainstorm en cours)

> Sections ouvertes au 23 juin. Aucune décision gravée ici n'est définitive tant que non validée.

### 2.1 Bonus de classe — VERROUILLÉ : identité pure (23 juin)
- **Décision** : au lancement, la classe = **identité pure** (blason + description + héritage). **Aucun bonus mécanique.** « On improvisera » les bonus plus tard (Uriel, 23 juin).
- Les synergies/bonus arriveront comme **synergies de Compagnie** (spec 2) ou plus tard, au feeling.
- Contrainte data (socle) conservée : chaque joueur **porte sa classe** en base → les synergies de groupe resteront calculables le moment venu.
- Conséquence : zéro surface d'équilibrage au lancement (cohérent fenêtre festival + principe anti-complexité).

### 2.2 Onboarding & changement de classe — VERROUILLÉ (23 juin)
- **Registre user-facing** : on parle de **« type d'explorateur / d'aventurier »**, PAS de « Ordre » ni « Chevalier Errant » (trop fort en UI). L'épique (Chevalier Errant, Ordres, héritiers historiques) reste dans le **lore et les descriptions**, jamais en label d'interface.
- **Changement de classe** : **libre, sans coût**, mais via un **message de confirmation qui pèse** (*« Es-tu sûr ? Tu quittes une voie qui te ressemble… »*). Rien à exploiter (identité pure) → pas besoin de verrou ; le message préserve le poids de l'identité.
- **Le QCM (ex-Choixpeau) revient — dans la 1.0.** Rejeté le 19 juin *en tant qu'équilibreur* (plus nécessaire) ; réintroduit *en tant qu'expérience d'accueil*. **Règle d'or : il SUGGÈRE, il ne verrouille jamais** — les 4 types restent cliquables, le joueur tranche.
- 3-4 questions, chaque réponse penche vers un type, tally → type suggéré. Nom (léger) à figer : *Quel explorateur es-tu ?* / *Trouve ta voie*. **Draft des questions : voir §3.**

### 2.3 Migration 4 factions → 4 classes — VERROUILLÉ (23 juin)
- Mapping **1:1 couleur→classe** (cf. §1) : simple renommage des libellés (UI + descriptions), `faction_id` **conservé**. Migration additive, pas de collapse.
- **Le grand changement = un événement de re-engagement de TOUTE la base** (idée Uriel 23 juin). À la première ouverture post-MAJ, écran « révélation » :
  - *« Les Maisons deviennent des types d'explorateurs. »* → *« Tu es Le Rôdeur. »*
  - Deux portes : **[ Garder ]** (défaut = sa classe mappée, il ne perd rien) · **[ Trouver mon type ]** (le QCM, opt-in).
  - **Garde-fou : on ne dé-classe jamais personne contre son gré.** L'épreuve est un cadeau opt-in, pas un reset.
- Le QCM sert donc **deux fois** (accueil des nouveaux + grand réveil de la base) — un seul build.
- À traiter (cleanup / spec 2) : Dortoirs (→ chat de Compagnie), table de noms de territoires par couleur, **Baroud d'Honneur** (équilibreur inter-faction devenu sans objet — classes neutres). Tout retrait → `docs/db/cleanup-v1-identity.md`.

---

## 3. Draft QCM — « Quel explorateur es-tu ? » (à valider)

> Voix accessible (pas « Ordre »). Chaque réponse penche vers un type. On compte, on **suggère**, le joueur reste libre.

**Q1 — Un lieu t'attire. Lequel ?**
- 📜 Une ruine pleine d'histoires oubliées *(Archiviste)*
- 🟢 Une forêt, une source — un endroit qui semble sacré *(Pèlerin)*
- 🔵 Un endroit lointain où tu n'es jamais allé *(Rôdeur)*
- 🔴 Un lieu menacé, que plus personne ne protège *(Protecteur)*

**Q2 — Tu arrives. Ton premier geste ?**
- 📜 Comprendre son passé, qui est passé là *(Archiviste)*
- 🟢 T'asseoir, écouter, ressentir le lieu *(Pèlerin)*
- 🔵 Voir ce qu'il y a plus loin, derrière *(Rôdeur)*
- 🔴 Veiller à ce qu'il reste, le garder *(Protecteur)*

**Q3 — Ce qui te rendrait le plus fier ?**
- 📜 Sauver une histoire que tout le monde allait oublier *(Archiviste)*
- 🟢 Faire respecter un lieu qu'on prenait pour un décor *(Pèlerin)*
- 🔵 Être le premier à révéler un endroit *(Rôdeur)*
- 🔴 Défendre un lieu que d'autres laissaient tomber *(Protecteur)*

**Q4 — Un dimanche libre, tu… *(optionnelle, la plus générique)***
- 📜 plonges dans de vieux livres, des archives *(Archiviste)*
- 🟢 marches en pleine nature *(Pèlerin)*
- 🔵 prends une route que tu n'as jamais prise *(Rôdeur)*
- 🔴 prends soin de ce qui compte pour toi *(Protecteur)*

**Résultat** : type le plus coché → *« Tu es un Rôdeur. »* + les 4 restent cliquables (suggère, ne verrouille pas). Égalité → départage sur Q1 (le penchant de lieu).

---

## Liens

- Socle : `🌳 SPEC — Le Mouvement, les Compagnies & les Classes` (vault)
- Supplante l'identité de : `🏛️ SPEC - Les 4 Maisons (Factions) V1` (vault)
- Dette de nettoyage : `docs/db/cleanup-v1-identity.md`
