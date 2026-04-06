# 📐 SPEC V0.5 — De la Conquête à l'Influence

> Rédigée le 6 avril 2026 — Uriel + XO
> Ce document est la **spécification de la V0.5** de l'application Runes de Chêne.
> Il complète la Bible Game Design et sert de référence pour l'implémentation.
>
> **Plan d'implémentation :** `docs/superpowers/plans/2026-04-06-v05-influence-system.md`

---

## Résumé

**On arrête la guerre, on lance la culture.**

Le système de revendication et de fortification disparaît. À la place, chaque lieu accumule de l'influence de tous les Héritages en parallèle. Un lieu peut avoir 80 points byzantins et 50 points celtes — le dominant donne sa couleur, mais personne ne perd ce qu'il a investi. C'est moins frustrant et ça encourage le va-et-vient plutôt que le verrouillage.

Le terrain domine. À distance, un joueur peut poser max 5 points d'influence par jour. Sur place en GPS, aucune limite. On pousse les gens dehors.

L'influence se gagne de deux façons. La première : contribuer. Ajouter un lieu, une photo, une page de carnet, visiter en GPS — tout ça donne de l'influence permanente qui ne décroît jamais. La seconde : placer son stock accumulé, qui lui décroît lentement si le lieu n'est pas entretenu. Les empires vides disparaissent.

Les fiches de lieu deviennent collaboratives. Un lieu s'appartient à lui-même. Le découvreur est honoré, mais chaque joueur peut ajouter sa page de carnet, ses photos, des infos pratiques. La communauté vote — les meilleures contributions remontent. Le top contributeur devient Gardien du lieu.

L'énigme quotidienne crée l'habitude. Chaque jour, un coffre apparaît dans l'app avec une question historique. Bonne réponse = Influence + Érudition. Mauvaise réponse = on apprend quand même.

Trois ressources, zéro confusion. L'Énergie pour agir, l'Influence pour peser sur les lieux, et la Gloire comme score de prestige — composée de deux sous-scores : Exploration (le terrain) et Érudition (le savoir).

---

## 1. Système de Ressources

### Vue d'ensemble

| Ressource | Rôle | Se dépense ? | Visible |
|-----------|------|-------------|---------|
| ⚡ **Énergie** | Agir (découvrir, révéler) | Oui, se régénère | Barre en jeu |
| 🏰 **Influence** | Peser sur les lieux | Oui, on la pose | Stock dans le profil |
| 🧭 **Exploration** | Rang terrain (permanent) | Jamais | Sous-score profil |
| 📖 **Érudition** | Rang savoir (permanent) | Jamais | Sous-score profil |
| 🎖️ **Gloire** | = Exploration + Érudition | Jamais | **Le gros chiffre** du profil |

- Les **Couronnes de Chêne** (monnaie de marque) sont gardées pour un cycle futur, pas dans la V0.5.
- L'**Énergie** ne change pas par rapport à la V0.4.

### Comment gagner des ressources

| Action | Influence | Exploration | Érudition |
|--------|-----------|-------------|-----------|
| Énigme quotidienne — facile (bonne réponse) | +3 | — | +1 |
| Énigme quotidienne — moyenne (bonne réponse) | +4 | — | +2 |
| Énigme quotidienne — difficile (bonne réponse) | +5 | — | +3 |
| Énigme quotidienne — mauvaise réponse | +0 | — | +1 |
| Visiter un lieu (GPS) | +10 | +2 | — |
| Ajouter un lieu | +25 | +5 | — |
| Ajouter une photo sur un lieu | +5 | +1 | — |
| Ajouter une page de carnet (description) | +10 | +1 | +1 |
| Énigme de lieu (sur place, bonne réponse) | +2 base, +1/difficulté | — | +2 base, +1/difficulté |
| Recevoir un vote sur son contenu | +1 influence permanente sur le lieu | — | — |

---

## 2. Système d'Influence (remplace Claim/Fortify)

### Ce qui disparaît
- Le bouton "Veiller sur ce lieu" (claim)
- Le système de fortification (niveaux 0-4, construction_types)
- Le coût de fortification dans la formule de prix
- L'impact des likes, fortifications et explorations sur le rayon Voronoi

### Ce qui le remplace

**Chaque lieu accumule de l'influence de tous les Héritages en parallèle.**

Affichage sur la fiche : drapeaux en ligne avec scores.
```
🟢 142  🔵 89  🟣 203 ⭐  🔴 45
```
L'Héritage dominant (étoile) donne sa couleur au lieu sur la carte et dans les territoires Voronoi.

### Deux types d'influence

| Type | Source | Decay |
|------|--------|-------|
| **Influence placée** | Le joueur dépense son stock d'influence sur un lieu | -1/semaine |
| **Influence de contenu** | Photos, descriptions, votes reçus, visite GPS | Permanente, ne décroît jamais |

### Placement d'influence

- **À distance** : maximum 5 points d'influence par jour par joueur sur un lieu
- **Sur place (GPS)** : aucune limite, le joueur peut vider tout son stock

### Territoires Voronoi

Le calcul reste identique (Voronoi → rayon → clipping → union par Héritage), mais le rayon est désormais basé sur **l'influence totale du lieu** (tous Héritages confondus), et non plus sur les likes, fortifications et explorations.

---

## 3. Fiche de Lieu Collaborative

### Philosophie
Un lieu s'appartient à lui-même. C'est un carnet d'aventure collectif, une table ronde d'archivistes-explorateurs.

### En-tête de la fiche
- **Nom du lieu** + tags (château, mégalithe, forêt...)
- **Drapeaux d'influence** par Héritage (barres en ligne avec scores, étoile sur le dominant)
- **Note moyenne** en étoiles (réservée aux Explorateurs du lieu)
- **Bouton "Je veux y aller"** (wishlist perso pour road trips)

### Rôles

| Rôle | Qui | Permanent ? |
|------|-----|-------------|
| 🧭 **Découvreur** | Le premier joueur (créateur du lieu) | Oui, honorifique |
| 👑 **Gardien** | Le top contributeur actuel (plus d'influence de contenu) | Non, peut changer |

### Hall of Fame
- Avatars des joueurs listés comme **Explorateurs** du lieu (GPS vérifié)
- Le créateur du lieu y est automatiquement (GPS requis pour créer)
- Le bouton "J'y suis allé" n'apparaît que si le GPS confirme la présence

### Note en étoiles
- Accessible à tout joueur listé dans les Explorateurs (a été sur place un jour)
- Le créateur du lieu peut noter aussi (il y était pour créer)
- Affichée en en-tête de la fiche

### Contenus collaboratifs

**Pages de carnet** (1 par compte, triées par votes) :
- Texte libre — retour terrain, ressenti, récit d'aventure
- La plus votée en haut de la fiche
- Les autres en dessous, consultables
- Un vote par joueur par page
- Donne de l'influence permanente à l'auteur sur le lieu (+1 par vote reçu)

**Photos** (galerie, triées par votes) :
- La plus votée = photo principale de la fiche
- Un vote par joueur par photo
- Donne de l'influence permanente à l'auteur sur le lieu (+1 par vote reçu)

**Champs info** (votables, un seul actif par type) :
- ♿ **Accessibilité** (facile / modéré / difficile + commentaire)
- 🌿 **Saison idéale**
- ⚠️ **Information importante** (danger, propriété privée, horaires...)

### Bouton "Je veux y aller"
- Ajoute le lieu à une liste personnelle (wishlist)
- Consultable depuis le profil du joueur
- Utile pour planifier des road trips d'exploration

---

## 4. Énigme Quotidienne

### Principe
Chaque jour, un coffre/parchemin apparaît dans l'app. Le joueur clique, découvre un texte historique court (2 lignes de lore), puis répond à une question.

### Format
- **1 énigme par jour**, difficulté variable (facile / moyenne / difficile)
- Format : **QCM (4 choix) ou champ libre**, selon la question
- Texte de lore avant la question (2 lignes max, contexte historique)
- Bonne réponse → explication courte + récompenses complètes
- Mauvaise réponse → la bonne réponse affichée avec l'explication + Érudition (+1)

### Récompenses

| Difficulté | Influence (bonne) | Érudition (bonne) | Érudition (mauvaise) |
|------------|-------------------|-------------------|---------------------|
| Facile | +3 | +1 | +1 |
| Moyenne | +4 | +2 | +1 |
| Difficile | +5 | +3 | +1 |

### Énigme de lieu (bonus sur place)
- Quand un joueur visite un lieu en GPS, une énigme liée au lieu peut apparaître
- Récompense : +2 Influence base (+1/difficulté), +2 Érudition base (+1/difficulté)
- Les énigmes de lieu sont liées aux tags et à l'histoire du lieu

### Gestion (Hub)
- Générées par batch avec Claude, validées par Lya via le Hub
- Catégorisées par Héritage, par thème, par difficulté
- ~365 questions/an nécessaires pour le quotidien
- À terme : les joueurs pourront proposer des énigmes (modération Hub)

---

## 5. Ce qui ne change PAS en V0.5

- Le système d'**Énergie** (régénération, Fragments, bonus Héritage)
- Les **Fragments** et leurs compétences actives
- Le **Fog of War**
- Le **Chat** (Général, Dortoirs, Bugs)
- Le **Loading Screen**
- La **Charte de l'Explorateur Érudit**
- Les **Titres** composables
- Le **Baroud d'Honneur** (bonus pour l'Héritage le plus faible)

---

## 6. Notes pour plus tard (hors V0.5)

- **Couronnes de Chêne** : monnaie de marque, cycle futur
- **Balise GPS hors-réseau** : sync de présence quand la connexion revient
- **Énigmes proposées par les joueurs** : modération via Hub
- **Récits sur la carte** : module séparé, pas sur les fiches de lieu
- **Événements stand** : marqueurs temporaires sur la carte (source Fellowship)
- **Classement mensuel** : catégories de victoire par Héritage

---

## Historique

| Date | Changement |
|------|-----------|
| 6 avril 2026 | Création du document — Uriel + XO |
