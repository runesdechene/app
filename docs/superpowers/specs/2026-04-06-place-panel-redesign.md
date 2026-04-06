# Spec — Refonte Fiche de Lieu (PlacePanel)

> Rédigée le 6 avril 2026 — Uriel + XO
> Style : Guide d'aventurier médiéval — structure claire, thème parchemin immersif, mobile-first

---

## Résumé

La fiche de lieu devient un **journal de bord collaboratif**. Chaque joueur peut poster sa page de carnet (texte + photos + note en étoiles), et chaque contribution renforce l'influence de sa faction sur le lieu. La fiche est structurée en 3 zones : hero photo, identité du lieu, contenu communautaire par onglets.

---

## 1. Structure générale (du haut vers le bas)

### Zone 1 — Hero Photo
- **Photo plein cadre** sans overlay texte, hauteur ~320px mobile
- Photo choisie **aléatoirement parmi les photos des carnets les mieux votés** à chaque chargement
- Si aucune photo de carnet : photo originale du lieu (celle de la découverte)
- **Gallery dots** si plusieurs photos existent (swipe pour parcourir)
- **Boutons flottants** en haut à droite : note moyenne (★ 4.2) + wishlist (🔖), pilules semi-transparentes avec backdrop-blur
- **Bouton fermer** (✕) en haut à gauche

### Zone 2 — Identité du lieu
- **Titre** du lieu (h2, font-title)
- **Tags** en ligne (badges colorés : 🗿 Mégalithe, 🌿 Site naturel...)
- **Adresse** (📍 Carnac, Morbihan)
- **Rôles** séparés par un trait fin en bas :
  - 🧭 Découvreur : avatar + nom (cliquable → profil)
  - 👑 Gardien : avatar + nom (top contributeur actuel, cliquable → profil)

### Zone 3A — Cadre Influence (parchemin encadré)
- **Cadre distinctif** : fond parchemin clair, double bordure dorée (#c9a96e), léger inner-border
- Titre centré : "⚔️ Influence des Héritages"
- **Drapeaux d'influence** : badges colorés par faction, centrés, étoile (⭐) sur le dominant
- **Bouton CTA** : "🏰 Placer de l'influence" — fond sombre, pleine largeur
- **Stock du joueur** affiché sous le bouton : "Ton stock : X points disponibles"
- Ce cadre n'est PAS dans un onglet — il est toujours visible

### Zone 3B — Explorateurs
- **Section label** : "🧭 Explorateurs (N)"
- Row d'avatars empilés (overlap -6px) + compteur "+N"
- **Bouton "📍 J'y suis allé"** si le joueur est sur place (GPS) et pas encore dans la liste
- Toujours visible, au-dessus des onglets

### Zone 4 — Onglets contenu
Trois onglets : **📖 Carnets (N)** | **📷 Galerie (N)** | **ℹ️ Infos (N)**

---

## 2. Onglet Carnets

### Page de carnet = texte + photos + note
Chaque joueur peut poster **une page de carnet par lieu** contenant :
- **Texte libre** : récit terrain, ressenti, conseils (obligatoire)
- **Photos** : 0 à N photos liées au carnet (optionnel)
- **Note en étoiles** : 1-5 étoiles (optionnel, réservé aux Explorateurs GPS et au découvreur)

### Affichage d'un carnet
- **Header** : avatar + nom + point faction + étoiles (à droite)
- **Texte** en italique, style citation
- **Photos** : row de thumbnails (max-height 80px, border-radius, flex), cliquables en plein écran
- **Footer** : boutons vote (👍 N, 👎 N) + date relative
- **Ligne d'influence** (séparée par un trait dashed) : badge coloré faction avec total (🏰 +35) + décomposition (📖 texte +10 · 📷 photos +15 · 👍 votes +10)

### Tri
Les carnets sont triés par **votes_up DESC**. Le carnet le mieux voté a un filet doré à gauche (border-left: 3px solid #c9a96e).

### Bouton d'ajout
En bas de la liste : bouton dashed "✏️ Ajouter ma page de carnet" — ouvre un formulaire (texte + upload photos + note si éligible).

### Calcul de l'influence d'un carnet
L'influence apportée par un carnet à la faction de son auteur sur ce lieu :
- +10 influence (contenu) pour le texte (configurable via `influence_add_carnet`)
- +5 influence (contenu) par photo (configurable via `influence_add_photo`)
- +1 influence (contenu) par vote positif reçu (configurable via `influence_per_vote`)
- Total affiché = somme des trois

---

## 3. Onglet Galerie

- **Grille** de toutes les photos de tous les carnets du lieu
- Pas de système de vote individuel par photo — les photos héritent de la popularité de leur carnet
- Clic sur une photo → ouvre le carnet associé (scroll to)
- Tri : photos des carnets les mieux votés en premier

---

## 4. Onglet Infos

Champs structurés éditables par n'importe quel joueur. Pas de vote, pas d'influence. Wiki léger.

| Champ | Format |
|-------|--------|
| ♿ Accessibilité | Facile / Modéré / Difficile + commentaire libre |
| 🌿 Saison idéale | Texte libre court |
| ⚠️ Information importante | Texte libre (danger, propriété privée, horaires...) |

- Chaque champ affiche la dernière valeur enregistrée + "Modifié par [nom] il y a X"
- N'importe quel joueur peut éditer → la valeur est remplacée (pas d'historique visible, mais log en BDD)

---

## 5. Photo hero — sélection

La photo affichée en haut de la fiche est choisie à chaque chargement :
1. Prendre les photos des **3 carnets les mieux votés**
2. Parmi ces photos, en choisir une **aléatoirement**
3. **Fallback** : si aucun carnet n'a de photo, utiliser la photo originale du lieu (`places.images`)

---

## 6. Note moyenne

- La note moyenne affichée dans le hero (★ 4.2) est la **moyenne des notes données dans les carnets**
- Seuls les carnets avec une note sont comptés
- La note dans un carnet est optionnelle, et réservée aux **Explorateurs GPS** (présents dans `place_explorers`) et au **découvreur** du lieu

---

## 7. Ce qui disparaît de l'ancienne fiche

- Compteur de vues (plus affiché)
- Bouton like individuel (remplacé par le vote sur les carnets)
- Section likers (remplacée par les Explorateurs)
- Bouton "J'ai exploré ce lieu" basique (remplacé par le système GPS des Explorateurs V0.5)
- Ancien système explore/explored count
- ClaimButton et FortifyButton (déjà prévu en Phase 6 V0.5)
- Description unique du lieu (remplacée par les pages de carnet collaboratives)

---

## 8. Ce qui reste inchangé

- Bouton fermer (✕)
- Navigation vers la carte (fly to)
- Tags du lieu
- Adresse du lieu
- Menu admin (rouage, suppression)
- ScoreSlider admin

---

## 9. Style

- **Mobile-first** : panneau latéral desktop (500px), bottom-sheet fullscreen mobile
- **Thème parchemin** : `--color-parchment`, `--color-ink`, `--font-title` (Georgia/serif), `--font-body`
- **Cadre influence** : double bordure dorée, fond parchemin plus clair, style "encadré de parchemin"
- **Carnets** : fond légèrement plus chaud (#faf6ec), bordure fine, style fiche de carnet
- **Pas d'emoji décoratif en excès** — les icônes de section sont fonctionnels
- **Fin, épuré, immersif** — pas de surcharge visuelle, laisser respirer les espaces
