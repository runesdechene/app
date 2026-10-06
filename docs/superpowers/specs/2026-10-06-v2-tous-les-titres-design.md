# Tous les titres

> Conception du 06/10/2026, validée par Uriel (« très bien pour une V1 », puis « je valide » pour
> les titres d'enrichissement). Maquettes Figma : « Tous les titres » (112:107, du 27/09),
> « Titres — 1. l'entrée », « 2. le panneau », « 3a/3b/3c » (feuilles au toucher).

## Pourquoi

Aucun endroit ne montre les titres qu'on peut gagner. Le seul indice est la feuille qu'ouvre un
titre porté sur un profil. La décision du 27/09 (vault, `_État.md`) le prévoyait : « une page
"Tous les titres" montre les titres obtenus et ceux à venir, avec leur progression ».

## Ce qu'on voit

- **L'entrée** : une **coupe** en pochoir, le même dessin que la cloche (silhouette d'encre, deux
  reflets crème). Sur PC, elle est au-dessus de la cloche dans la barre de gauche ; sur téléphone,
  à gauche de la cloche dans l'en-tête. Pas de pastille.
- **Le panneau « Tous les titres »** (un détail de la coquille, comme les notifications) :
  - le résumé : « 19 titres obtenus sur 33 » et « Touche un titre pour savoir comment il se gagne.
    Tu en portes trois sur ton profil. » ;
  - un bloc par **chemin vivant**, dans cet ordre : **Le chemin** (niveau), **Les visites** (lieux
    visités sur place), **Les lieux ajoutés**, **Les lieux enrichis**. En tête du bloc, le compteur
    (« niveau 12 », « 60 lieux visités »…). Puis les titres par seuil croissant :
    - obtenu : une gélule pleine, et le seuil en clair à côté (« 50 lieux visités sur place ») ;
    - **le prochain** (le premier pas encore obtenu) : une gélule en pointillés, avec une barre
      « 60 / 150 lieux visités sur place » ;
    - les suivants : une gélule en pointillés et le seuil seul ;
    - un titre **porté** sur son profil est cerclé de rouge, avec « · sur ton profil ».
  - **D'une autre époque** (bloc en pointillés) : seulement les titres **déjà obtenus** sur les
    chemins refermés, avec la phrase « Gagnés dans l'ancienne version du jeu (…). Ils restent à toi
    et se portent toujours. » Si aucun, le bloc ne s'affiche pas.
- **Pas de bloc « Offerts »** : il viendra avec les titres offerts (second temps, ci-dessous).

## Ce qu'on touche

Toucher un titre ouvre une petite feuille : la gélule en grand, puis selon le cas :

- **obtenu** : « Gagné en visitant 50 lieux sur place. » puis « Tu en as visité 60. Il est à toi
  pour toujours. » et, en petit, que les titres portés se choisissent dans « Modifier mon profil » ;
- **à gagner** : « Se gagne en visitant 150 lieux sur place. », la barre « 60 / 150 — encore 90 » ;
- **d'une autre époque** : « Gagné dans l'ancienne version du jeu, en plantant 30 bannières. »
  puis « Ce chemin s'est refermé avec la V2 : le titre reste à toi et se porte toujours. »

Pas de bouton « Porter ce titre » : le choix reste dans « Modifier mon profil » (Uriel, 06/10).

## Les chemins

| Chemin | Compteur (`condition.stat`) | Titres |
|---|---|---|
| Le chemin | `level` | Compagnon 5 · Veilleur 15 · Héros local 25 · Héros régional 35 · Héros 42 · Légende 50 |
| Les visites | `places_visited` | Pèlerin 10 · Cheminant 50 · Errant 150 · Marcheur des Mondes 500 |
| Les lieux ajoutés | `places_added` | Pionnier 1 · Cartographe Initié 5 · Cartographe 25 · Grand Chroniqueur 100 · Maître-Cartographe 500 |
| **Les lieux enrichis** (nouveau) | `places_enriched` | **Glaneur 1 · Copiste 10 · Enlumineur 50 · Gardien des Mémoires 200** |

Refermés (« D'une autre époque ») : `discoveries` (la découverte à distance est devenue gratuite),
`plantages` et `mecenat_*` (la Cour est purgée), `enigma_score` (énigmes en sommeil), `carnets`
(la V2 n'écrit plus de carnets). La liste des chemins vivants est écrite **à un seul endroit**, côté
base ; le front affiche ce qu'on lui donne.

### Le nouveau compteur : les lieux enrichis

`places_enriched` = le nombre de **lieux différents** où l'Explorateur est l'auteur d'au moins une
version (`versions_lieu.auteur`), **hors ses propres lieux** (`places.author_id`).

- Un lieu compte une fois, quel que soit le nombre de modifications : pas de titre pour dix
  corrections sur la même fiche.
- Ses propres lieux ne comptent pas : ils relèvent de « Les lieux ajoutés », et la version
  d'origine de chaque fiche est attribuée à son auteur.
- **Rétroactif** : la migration 416 a versé l'historique V1 (révisions de récit, rubriques) dans
  `versions_lieu`. Ceux qui enrichissaient en V1 sont crédités dès le premier jour.
- *Écarté : rebrancher les titres Carnets (Page, Conteur, Chroniqueur, Maître Conteur) sur ce
  compteur. Ce n'est pas le même, et quelqu'un perdrait un titre déjà gagné.*

## La base

Une migration (le prochain numéro libre au moment de l'écrire), en tête `-- WHY:` :

1. **`get_user_titles`** reçoit le compteur `places_enriched` : dans ses `stats` et dans le `CASE`
   qui décide qu'un titre est obtenu. `CREATE OR REPLACE` à partir de la définition **live**
   (`pg_get_functiondef`), copiée entière. C'est elle que lit `set_my_displayed_titles` : un titre
   d'enrichissement obtenu peut donc se porter sans autre changement.
2. **Les quatre titres** entrent dans `titles` (`type = 'general'`, `order` 90 à 93, une icône,
   une `description`), avec `{"stat":"places_enriched","min":N}`.
3. **`get_mes_titres()`** (nouvelle, `SECURITY DEFINER`, `auth.uid()`, lecture seule) : appelle
   `get_user_titles(moi)` et rend :

```json
{
  "obtenus": 19, "total": 33,
  "chemins": [
    { "stat": "places_visited", "compteur": 60,
      "titres": [ { "id": 25, "nom": "Pèlerin", "min": 10, "obtenu": true, "porte": false } ] }
  ],
  "autreEpoque": [ { "id": 41, "nom": "Banneret", "condition": { "stat": "plantages", "min": 30 }, "porte": false } ]
}
```

   `total` compte les titres des chemins vivants plus ceux d'une autre époque déjà obtenus (on ne
   promet pas ce qu'on ne peut plus gagner) ; `obtenus` compte tous les titres obtenus.
   `porte` vient de `users.displayed_title_ids_v3`.

**Vérifier en prod** : sur le compte d'Uriel, le nombre de titres obtenus de `get_mes_titres()` est
le nombre de `unlockedGeneralTitles` de `get_user_titles`.

## Le front

Un dossier `apps/web-v2/src/features/titres/` :

- `api/mesTitres.ts` : l'appel et la lecture (`shared/lib/lire`), comme `lireActifs`.
- `lib/chemins.ts` : le titre de chaque chemin (« Le chemin », « Les visites »…), l'unité de son
  compteur, le prochain titre d'un chemin. Sans état React.
- `components/PageTitres.tsx` : le panneau. `components/FeuilleTitre.tsx` : la feuille au toucher.
- La phrase d'un seuil reprend `phraseCondition` (`features/compte/lib/conditionTitre.ts`), à qui
  on ajoute `places_enriched` (« Débloqué en enrichissant N lieux »).
- `assets/ui/coupe.svg` : le pochoir de la maquette.
- La coquille (`Shell.tsx`) : le bouton coupe, visible sur PC et sur téléphone, ouvre `titres`
  comme la cloche ouvre `notifications`. La route `titres` entre dans `router.tsx` à côté de
  `notifications`, enveloppée dans un `DetailPane` (« Tous les titres »).

Une erreur de lecture : le message et « Réessayer » des autres panneaux.

## Tests

- `chemins` : le prochain titre (aucun, le premier, au milieu, tous obtenus), l'ordre des chemins.
- `PageTitres` : les gélules obtenues, le prochain avec sa barre, « sur ton profil », le bloc
  « D'une autre époque » absent quand il est vide.
- `FeuilleTitre` : les trois cas.
- `conditionTitre` : la phrase de `places_enriched`.
- Navigateur : la coupe ouvre le panneau, un titre ouvre sa feuille, sur PC et à 390 px.

## Plus tard

- **Les titres offerts** : une table (qui, quel titre, pourquoi, quand), « Offrir un titre » dans le
  Hub, le bloc « Offerts » du panneau, et les rendre portables.
- La date d'obtention d'un titre (aujourd'hui calculée à la volée, sans date).
