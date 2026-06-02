# Refonte des fiches de lieu — « Le carnet de route collaboratif »

> Spec design · 2026-06-02 · app `explore-web`
> Statut : validé en brainstorming, à transformer en plan d'implémentation.

## 1. Intention

Les **Récits** (carnets individuels, 1 par user et par lieu) ne prennent pas : les
utilisateurs n'en postent presque pas, et beaucoup de fiches restent vides
(« Soyez le premier à écrire ! »). De plus, **on ne peut pas ajouter une photo sans
rédiger un récit** — gros frein.

On bascule le centre de gravité de la fiche : d'un mur de récits individuels vers un
**carnet de route co-écrit**. La fiche d'un lieu devient l'œuvre commune d'une société
d'explorateurs érudits :

- un **corps de texte commun** (description collaborative, wiki ouvert) ;
- une **discussion** sous la description (commentaires likables, avec réponses) ;
- des **photos libres**, ajoutables en un geste, sans obligation d'écrire.

## 2. Anatomie de la fiche (haut → bas)

1. **Hero** plein cadre. Source = **galerie du lieu** (découplée des récits — voir §6).
2. **Slideshow photos** : bandeau horizontal scrollable juste sous le hero, + bouton **＋**
   pour ajouter une photo *sans texte*.
3. Identité : titre · ★ note · tags · adresse · infos rapides (accessibilité / saison /
   époque / alerte). — inchangé.
4. **« Ils ont foulé ces terres »** (rangée explorateurs). — inchangé.
5. **La Cour / Conquête** (influence par Couronnes) — **repliée par défaut** : réduite à un
   bandeau d'une ligne (« 👑 Conquête — veillé par {nom} · ⌄ déplier ») qu'on **déplie au tap**
   pour révéler `PlaceCourtView` (barre de tension + prétendants + mécènes). Garde la fiche
   centrée sur le carnet ; la conquête reste accessible sans écraser.
6. **📖 Le lieu** — *description collaborative*. Bloc principal de la fiche.
   - Barre : **❤️ J'aime** · **✏️ Contribuer** · mention « enrichi par N aventuriers · voir l'historique ».
7. **Onglets : Discussion · Galerie · Infos** (« Admin » conservé). **Discussion = premier onglet et
   sélectionné par défaut** à l'ouverture (remplace le défaut actuel `'carnets'`). L'onglet
   « Carnets » disparaît.

## 3. La description collaborative (wiki ouvert)

- **Texte unique partagé** par lieu, pas de version « par user ».
- **Droit d'édition : avoir découvert le lieu** (réutilise `discoveredIds` / `playerStore`).
  On ne décrit que les lieux qu'on connaît → limite le vandalisme drive-by et renforce
  le sens « explorateur ».
- **Aucune récompense** : ni Gloire, ni influence de faction. Geste gratuit. (La Cour
  garde l'influence comme système séparé.)
- **Mémoire d'édition / historique** *(filet de sécurité du wiki)* :
  - chaque édition **empile une nouvelle révision** (qui · contenu · quand), n'écrase pas ;
  - la version courante pointe sur la dernière révision ;
  - on peut **consulter l'historique** et **restaurer** une version antérieure (anti-vandalisme,
    anti-erreur).

## 4. La discussion (modèle unifié)

- **Composer unique** : « Ajoute une photo, un conseil, une anecdote… ».
- Un **commentaire = texte et/ou photos**. Ouvert à **tout utilisateur connecté**.
- **❤️ J'aime** sur les commentaires (réutilise le système de votes existant).
- **Réponses à 1 seul niveau** (`parent_id` unique) — lisible sur mobile, style Instagram.
- **Règle photo / commentaire** :
  - **Photo seule** (sans message) → va en **Galerie + slideshow** uniquement, n'apparaît pas dans le fil.
  - **Photo + message** (ou message seul) → **commentaire** dans la discussion ; les photos du
    commentaire **apparaissent aussi en Galerie**.

## 5. Réactions ❤️

- Un simple **« J'aime »** (pas de set d'emojis multiples), sur **la description ET les commentaires**.
- Réutilise l'existant : `contribution_votes` + `vote_contribution` / `unlike_contribution`.

## 6. Photos & Galerie (découplées des récits)

- La **Galerie** (onglet) affiche la **grille complète** de toutes les photos du lieu.
- Le **slideshow** sous le hero et le **hero** lui-même tirent de cette galerie (plus du top-3 carnets).
- Sources de photos agrégées dans la galerie :
  - **photos seules** (upload direct sans texte) ;
  - **photos jointes aux commentaires** ;
  - photos de lieu héritées (`places.images`, mig 005).

## 7. Migration des carnets existants

`place_contributions` de `type = 'carnet'` (texte + titre + photos + note + ❤️ + auteur + date) :

- **Photos** → versées dans la Galerie du lieu.
- **Texte + titre** → convertis en **commentaires** du nouveau fil, en **préservant l'auteur,
  les ❤️ (votes) et la date** d'origine.
- **Description v1** = le carnet du **découvreur** (auteur du lieu) s'il existe, **sinon le carnet
  le plus aimé**. Ce carnet-là devient la première révision de la description (attribuée à son
  auteur dans l'historique) ; ses photos vont en Galerie ; il **n'est pas dupliqué en commentaire**.
  Si aucun carnet : description **vide** avec invite « Sois le premier à décrire ce lieu ».
- **Notes ★** → système de notation du lieu **inchangé** (prompt après visite GPS, `rate_place`).

## 7bis. Direction visuelle (validée en maquette)

Esprit **« carnet de route d'explorateur érudit »** — fidèle à la ligne éditoriale
(chevalier errant / sublime). Maquettes validées : `.superpowers/brainstorm/.../design-v3.html`.

- **Fond de modal = vraie texture parchemin** (`src/assets/parchemin.png`, celle de la landing),
  avec un léger voile clair (`rgba(247,237,225,.18→.42)`) pour la lisibilité du texte par-dessus.
- **Typographie** (tokens existants `index.css`) : titres en **Bebas Neue** (`--font-title`),
  labels/UI en **Cabin Condensed** (`--font-accent`), corps en **Cabin** (`--font-body`),
  et **la description collaborative en Alegreya** (`--font-signature`) — la « voix littéraire » du lieu.
- **Description = encart de manuscrit** posé sur le parchemin : panneau crème translucide
  (`rgba(255,251,244,.82)`), **filet orné** en tête (`— LE LIEU —`), **lettrine** Bebas sur la
  première lettre, texte justifié.
- **❤️ = sceau** (pastille arrondie), passe en teinte cire/rouge quand liké. **Contribuer** = pilule encre pleine.
- **Commentaires = entrées de journal** : avatar rond (initiale + badge rôle ⭐/🛡️), nom en Cabin
  Condensed, filets sépia fins en séparateur, photos en vignettes arrondies bord clair, réponse indentée.
- **Slideshow** sous le hero : vignettes 74×56 arrondies + tuile **＋ Photo** pointillée.
- **Onglets** : libellés Bebas soulignés sépia (onglet actif = filet `--color-sepia-dark`).
- Palette : strictement les tokens `@theme` d'`index.css` (parchemin / encre / sépia / sauge / eau).

## 8. Modèle de données proposé

> Approche recommandée : **maximiser la réutilisation de `place_contributions`** plutôt que
> multiplier les tables. À affiner/valider contre le schéma réel pendant la phase de plan.

- **Description courante** : une ligne `place_contributions` `type = 'description'`, **unique par lieu**
  (`user_id` = dernier éditeur, `content` = texte courant). Permet de réutiliser `contribution_votes`
  pour le ❤️ de la description.
- **Historique** : nouvelle table `place_description_revisions` (`id`, `place_id`, `content`,
  `edited_by`, `created_at`). La restauration = empile une révision identique à une ancienne.
- **Commentaires** : lignes `place_contributions` `type = 'comment'`, avec une **nouvelle colonne
  `parent_id`** (FK auto-référente, contrainte 1 niveau : le parent doit avoir `parent_id` nul).
  Likes via `contribution_votes`. `images` réutilisé pour les photos jointes.
- **Photos seules** : lignes `place_contributions` `type = 'photo'` (`images` rempli, `content` nul).
- **Contrainte d'unicité** : remplacer l'actuelle `UNIQUE(place_id, user_id, type)` par des index
  partiels — single-instance pour `accessibility`/`season`/`warning` (par user) et `description`
  (par lieu) ; **aucune** contrainte pour `comment` / `photo` (multiples autorisés).
- **Type `carnet`** : retiré après migration.

Côté RPC (`SECURITY DEFINER`, logique serveur) :
- `edit_place_description(place_id, content)` — vérifie « a découvert le lieu », empile une révision,
  met à jour la ligne courante.
- `restore_place_description_revision(place_id, revision_id)` — même garde, empile la version restaurée.
- `add_place_comment(place_id, content, images[], parent_id?)` — garde 1 niveau.
- `add_place_photos(place_id, images[])` — photo(s) sans texte.
- `get_place_detail_v05` étendu pour renvoyer : description courante + compteur révisions + ❤️,
  commentaires (arbre 1 niveau) + ❤️, galerie agrégée.

## 9. Impact front (composants)

- `PlacePanel.tsx` : réorganiser l'anatomie ; slideshow sous le hero ; remplacer l'onglet
  « Carnets » par « Discussion » (premier + défaut `useState('discussion')`) ; **replier
  `PlaceCourtView` derrière un bandeau dépliable** (nouveau wrapper `CourtFold`, fermé par défaut) ;
  hero/slideshow alimentés par la galerie ; appliquer le fond parchemin sur `.place-panel`.
- **Nouveaux** : `PlaceDescription` (bloc + édition + historique), `PlaceDescriptionHistoryModal`,
  `DiscussionThread` + `CommentCard` (texte/photos/❤️/réponse), `CommentComposer`,
  `PhotoSlideshow` (bandeau hero), `AddPhotoModal` (upload sans texte).
- **Modifiés** : `PlaceGallery` (grille complète depuis galerie agrégée), `AddCarnetModal`
  → repensé en `CommentComposer` (texte facultatif si photos ; sinon photo seule).
- **Retirés** : `CarnetCard` + logique « 1 carnet par user » + CTA « Ajouter mon propre récit ».
- Types : `types/placeDetail.ts` (`V05Detail`, `V05Contribution`, `PlacePanelActiveTab` → onglets).

## 10. Hors-scope (YAGNI)

- Pas de réactions multi-emojis (un simple ❤️).
- Pas de fil de réponses multi-niveaux.
- Pas de synthèse IA en continu de la description (édition 100% humaine ; pas même d'amorçage IA).
- Pas de modération automatique : l'historique + le revert suffisent au lancement.
- Support **vidéo** non inclus.

## 11. À mettre à jour ailleurs (mémoire / Citadelle)

- **Contradiction à corriger** : la Bible Game Design affirme « Gloire = Exploration + Érudition »
  et « Érudition se gagne en contribuant des récits ». Décision Uriel (2026-06-02) :
  *la Gloire n'est pas de l'érudition*, et contribuer à un lieu est un **geste gratuit**.
  → Mettre à jour `🎮 Bible Game Design.md` et `Décisions Game Design 2026.md`
  (sections Récits / fiches de lieu / Gloire).
- Décisions Game Design : acter la refonte (fin des carnets individuels, wiki + discussion).
