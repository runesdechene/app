# Enrichir un lieu — conception

> 05/10/2026 · V2 (`apps/web-v2`) · maquettes Figma « Enrichir — 1 à 4b » (fichier App v2, nœud 379:237 et voisins)

## Pourquoi

La « Chapelle de la Madeleine » affiche « En cours d'écriture » en V2, alors que son autrice est revenue
écrire 390 signes : la V1 écrit le récit dans `place_contributions` (`edit_place_description`), la V2 le
lit dans `places.text`. 238 lieux sont dans ce cas. Uriel : « Créons un vrai système d'enrichissement, afin
que dans l'historique on puisse vraiment voir les ajouts de chacun ! »

## Ce qu'on construit

1. **Un récit partagé** et **trois rubriques pratiques** — **Accès**, **Quand y aller**, **Bon à
   savoir** — qui s'enrichissent de la même façon. Une rubrique vide ne s'affiche pas.
2. **Chaque enregistrement est une version**, avec son auteur, sa date et un mot facultatif.
3. **L'histoire de la fiche** liste les versions ; toucher une version montre ce qu'elle a ajouté
   (souligné vert) et retiré (barré).
4. **Le crédit à égalité** : « Récit de Luna » (un seul auteur), sinon « Récit partagé de Luna, Mathéo et
   Aelis », par ordre d'arrivée — « parfois l'auteur de base met 3 lignes, et les suivants font tout le
   boulot ».
5. **La V1 passe en lecture seule** pour le récit et les rubriques.

Hors champ : l'époque (déjà un champ du lieu), les commentaires V1 (déjà au Carnet de passage, mig 389),
les photos.

## L'interface (maquettes validées le 05/10)

- **Fiche** (`FicheLieu`) : « Le récit », puis la ligne de crédit (portraits + noms) et « L'histoire de la
  fiche › » ; puis un filet et les rubriques remplies, **plus discrètes que le récit** (titre 13 px semi-gras,
  texte 14 px `--color-texte-doux`), chacune précédée de son icône au trait (Lucide `route`,
  `calendar-days`, `lightbulb` → `assets/ui/acces.svg`, `quand.svg`, `bon-a-savoir.svg`) ; puis
  « Enrichir la fiche ». La ligne de faits sous le titre ne garde que l'époque et le siècle.
- **Modifier** : l'étape du récit devient deux onglets `Segments` (la brique existante) : « Le récit » (un
  grand champ) et « Infos en plus » (les trois rubriques, mêmes icônes, un exemple en italique quand le champ
  est vide). Un seul « Enregistrer les changements » pour les deux onglets → une seule version. Au pied :
  « Un mot sur ta modification (facultatif) », un champ avec un exemple, et « Il s'affiche dans l'histoire
  de la fiche, à côté de ton nom. »
- **L'histoire de la fiche** (`FeuilleHistoire`) : « Aelis a enrichi l'accès », « Tristan a ajouté « Bon à
  savoir » »… ; la plus récente est « Actuelle », les autres « Voir › ».
- **Une version** (nouvelle feuille, adresse propre) : qui, quand, le mot ; pour chaque champ changé, son
  texte avec l'ajouté souligné vert et le retiré barré ; « Revenir à cette version » (crée une nouvelle
  version, comme aujourd'hui).

## Les données

### `versions_lieu` : trois colonnes de plus

Une version reste une **photo complète** de la fiche (le modèle de la mig 387) :

```sql
ALTER TABLE versions_lieu ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text;
ALTER TABLE places ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text;
```

`places` porte l'état actuel (lu par la fiche et la carte) ; `versions_lieu` porte l'histoire. Une
rubrique vide est `NULL`. Longueur : 1 000 signes au plus par rubrique.

### Une seule fonction écrit : `modifier_lieu`

Copiée de sa définition live (mig 387), elle reçoit `p_acces`, `p_quand`, `p_bon_a_savoir` :

- « Rien n'a changé » compare aussi les rubriques ;
- met à jour `places` ;
- **tient la V1 et les pages SEO à jour** : comme elle le fait déjà pour le récit (`place_contributions`
  type `description`), elle écrit les rubriques dans `place_contributions` types `accessibility`, `season`,
  `warning` (une ligne par lieu et par type : vérifié le 05/10) ;
- notifications inchangées (`description_edited` si seul le récit change, sinon `lieu_modifie`).

La signature change : l'ancienne est supprimée dans la même migration (DROP vérifié à la main),
`revenir_a_version` repasse les rubriques.

### Lire

- `fiche_lieu` (live : mig 395) renvoie `acces`, `quand`, `bon_a_savoir` et `recit_par` : la liste
  `{id, nom, avatar}` des auteurs des versions où le récit a changé (l'origine comprise), dans l'ordre de leur
  première version.
- `histoire_du_lieu` (live : mig 387) : `champs` gagne `acces`, `quand`, `bon_a_savoir`.
- **Nouvelle** `version_du_lieu(p_version bigint)` → `{qui, quand, note, champs: [{champ, avant, apres}]}`
  pour les seuls champs textuels changés (récit et rubriques ; nom, nature et époque restent en mots).
- La comparaison mot à mot se fait dans l'appli avec la bibliothèque `diff` (`diffWords`), pas en SQL et pas
  à la main.

### « Sur les chemins »

Uriel, 05/10 : enrichir ou modifier un lieu doit apparaître dans « Sur les chemins ». La ligne « enrichi »
existe (mig 406) mais ne lit que `place_description_revisions` : seul le récit y passe. `sur_les_chemins`
(live : mig 413) la lit désormais dans `versions_lieu` (toutes les versions sauf l'origine) : récit,
rubriques, nom, nature, époque. Le verbe suit ce qui a changé : « a enrichi [lieu] » si le récit ou une
rubrique a changé, « a modifié [lieu] » sinon (nom, nature, époque seuls). La règle « une ligne par
personne, par type et par jour » reste. Après la reprise de l'histoire V1, rien ne se perd : les anciennes
révisions sont devenues des versions.

## Reprendre l'histoire de la V1 (une migration, une fois)

`versions_lieu` ne compte que 4 versions (1 lieu). L'histoire est en V1 :
`place_description_revisions` (3 675 révisions, 3 436 lieux, toutes avec auteur) et les rubriques
`place_contributions` (73 accès, 63 saisons, 27 « attention »).

Pour chaque lieu sans version V2 : on range par date les révisions de récit et les rubriques, et chaque
événement devient une version qui reprend l'état précédent et change un seul champ. Le nom, les natures et
l'époque de ces versions sont ceux d'aujourd'hui (la V1 ne les a pas historisés). Le lieu qui a déjà des
versions V2 est traité à la main.

### Les 238 lieux divergents

Pour chacun, **le texte le plus récent gagne** (`place_contributions.updated_at` contre la dernière
écriture de `places.text`) ; l'autre reste dans l'histoire. **Avant d'appliquer**, une requête produit la
liste (lieu, texte gardé, texte écarté, dates) : Uriel la relit.

## La V1 en lecture seule

Dans `apps/explore-web` : `DescriptionEditModal.tsx` et les boutons « contribuer » de `PlaceInfos.tsx`
(accès, saison, attention) sont remplacés par un lien « Enrichir dans la nouvelle appli » vers
`/v2/lieu/<id>`. En base, `edit_place_description` et `contribute_to_place` refusent les types
`description`, `accessibility`, `season`, `warning` (message clair) ; les photos continuent. Ligne au
registre de purge (`docs/v2/purge-back.md`) : les deux RPC et `place_description_revisions`, à supprimer
quand la V1 s'arrête.

## Erreurs

- Rubrique > 1 000 signes : refus `22023`, message affiché sous le champ.
- Récit vide : refus actuel (1 à 5 000 signes).
- Version introuvable ou lieu masqué : la feuille « Une version » dit « Cette version n'existe plus. »

## Tests

- SQL (`BEGIN … RAISE EXCEPTION 'BILAN' … ROLLBACK`) : enregistrer une rubrique crée une version et met à jour
  `places` et `place_contributions` ; « Rien n'a changé » ; `recit_par` (1 auteur / 3 auteurs, une rubrique
  seule ne crédite pas) ; `version_du_lieu` ne renvoie que les champs changés ; la reprise V1 recrée la
  Chapelle avec l'autrice dans l'histoire et son texte comme récit actuel.
- Vitest : la phrase de crédit (1, 2, 3 auteurs) ; `ceQuiAChange` pour chaque rubrique ; le découpage
  ajouté/retiré ; les onglets gardent la saisie en passant de l'un à l'autre ; une rubrique vide ne s'affiche
  pas.
- SQL : une rubrique seule enrichie fait une ligne « enrichi » dans `sur_les_chemins` ; un nom seul, une
  ligne « modifié » ; l'origine, aucune.
- Navigateur : la Chapelle de la Madeleine montre le bon texte et son autrice ; enrichir l'accès d'un lieu
  puis le voir souligné dans l'histoire ; la V1 n'offre plus que le lien.
