# Édition des lieux et carnets

> Date : 2026-04-09
> Statut : Draft

## Contexte

Les joueurs peuvent créer des carnets (récits) sur les lieux et noter les lieux avec des étoiles. Actuellement, il n'y a aucun moyen de modifier ou supprimer un carnet, ni de renommer un lieu. Les joueurs doivent pouvoir corriger leurs écrits et améliorer les noms de lieux.

## Design

### 1. Éditer son carnet (récit)

Un bouton "Modifier" (icône crayon) apparaît sur le `CarnetCard` du joueur connecté uniquement.

- Ouvre le `AddCarnetModal` existant, **pré-rempli** avec les données actuelles (titre, texte, photos)
- Le modal passe en mode édition : header "Modifier ma page" au lieu de "Ma page de carnet", bouton "Enregistrer" au lieu de "Publier ma page"
- Photos existantes affichées comme previews, supprimables individuellement, ajout possible (max 5 total)
- Même logique d'enregistrement : upsert `place_contributions` avec `onConflict: 'place_id,user_id,type'`
- Les photos déjà uploadées (URLs) sont conservées telles quelles. Seules les nouvelles `File` sont uploadées vers Storage. Les photos retirées du tableau ne sont pas supprimées du Storage (nettoyage futur possible).

**Props ajoutées à `AddCarnetModal` :**
```ts
interface AddCarnetModalProps {
  placeId: string
  canRate: boolean
  onClose: () => void
  onSaved: () => void
  // Mode édition :
  existingCarnet?: {
    title: string | null
    content: string
    images: string[]  // URLs existantes
  }
}
```

### 2. Supprimer son carnet

Un bouton "Supprimer" (icône poubelle) sur le `CarnetCard` du joueur connecté, à côté du bouton modifier.

- Dialog de confirmation : "Supprimer votre page de carnet ?"
- Appel RPC `delete_carnet(p_user_id TEXT, p_place_id TEXT)` :
  - `DELETE FROM place_contributions WHERE user_id = p_user_id AND place_id = p_place_id AND type = 'carnet'`
  - Vérifie que `p_user_id` correspond à `auth.uid()`
  - Retourne `{ success: true }`
- Après suppression, `onSaved()` / `refreshV05()` recharge les données
- L'onglet Carnets affiche déjà "Aucun carnet pour l'instant" quand la liste est vide — pas de changement nécessaire

### 3. Éditer le nom du lieu

Un bouton crayon à côté du titre `<h2>` dans le PlacePanel. **Visible uniquement si le joueur a un carnet sur ce lieu** (= contributeur de contenu, `userHasCarnet === true`).

- Au clic : le `<h2>` se transforme en `<input>` inline, avec le titre actuel comme valeur
- Validation par Enter ou bouton check, annulation par Escape ou bouton X
- Appel RPC `rename_place(p_user_id TEXT, p_place_id TEXT, p_title TEXT)` :
  - Vérifie que le joueur a au moins une contribution carnet sur ce lieu
  - `UPDATE places SET title = p_title, updated_at = NOW() WHERE id = p_place_id`
  - Retourne `{ success: true, title: p_title }`
- Le titre est trimé, max 255 caractères, non vide
- Après renommage, le titre affiché se met à jour localement (pas de refresh complet)

## Ce que c'est PAS

- Pas de système de propositions/votes pour le nom
- Pas d'historique des modifications du nom ou du carnet
- Pas d'édition des infos du lieu (adresse, type, coordonnées) — juste le nom
- Pas de modération sur le renommage (edit direct)
- Pas de suppression des fichiers Storage lors de la suppression de photos d'un carnet
- Pas de notification quand un lieu est renommé

## Composants impactés

| Fichier | Modification |
|---------|-------------|
| `AddCarnetModal.tsx` | Prop `existingCarnet`, pré-remplissage, mode édition |
| `CarnetCard.tsx` | Boutons modifier/supprimer sur la carte du joueur connecté |
| `PlacePanel.tsx` | Bouton crayon inline sur le titre + état édition + passer `existingCarnet` au modal |
| `PlacePanel.css` | Styles pour le titre éditable et les boutons carnet |
| `CarnetCard.css` | Styles pour les boutons modifier/supprimer |
| Migration SQL | RPCs `delete_carnet` et `rename_place` |
