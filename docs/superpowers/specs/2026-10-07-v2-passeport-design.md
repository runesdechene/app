# Le passeport — remplace « Visités » sur le profil (V2)

> Validé avec Uriel le 07/10/2026. Maquettes Figma `MKqyVhDPreg06PMEAaDxde` (« Runes de Chêne — App v2 ») :
> `432:272` Passeport — 1. le profil · `429:519` Passeport — 2. ouvert · `442:272` Passeport — 3. une région en détail.

## Pourquoi

Certains Explorateurs ont plus de 200 lieux visités : une rangée de cartes « Visités » ne dit plus
rien. Le passeport montre la même chose à trois niveaux de zoom — par nature, par territoire, par
mois — et reste lisible à 5 comme à 300 lieux.

## Vocabulaire

- **Tampon** : un lieu visité. Revisiter un lieu ne fait pas un second tampon. Sa date est celle de
  la **première** visite.
- **Territoire** : le département du lieu (`places.departement`), sinon son pays (`places.pays`),
  sinon « Ailleurs ».
- **Nature** : la nature principale du lieu (`place_tags.is_primary`), avec son icône et sa couleur.

## Hors périmètre

- « À tamponner dans … » (le lieu le plus proche d'une nature manquante) : second temps.
- Toute autre section du profil (Lieux ajoutés, Envie d'y aller) : inchangée.

## Données — une migration

### `get_passeport(p_user_id text) RETURNS json`

`SECURITY DEFINER`, `STABLE`. Un objet : toutes les natures (pour les pointillés), puis une entrée
par lieu visité, la plus récente première :

```json
{ "natures": [{ "id": "…", "nom": "…", "icone": "…", "couleur": "#…" }],
  "tampons": [{ "id": "…", "nom": "…", "imageUrl": "…|null",
                "nature": "<id de nature>" | null,
                "territoire": "Alpes-Maritimes" | "Italie" | null,
                "quand": "2026-10-06" }] }
```

- **Visibilité** : les mêmes règles que la liste `visites` de `get_profil_explorateur` (migration
  426, repartir de la définition **live**) — lieux masqués et privés exclus, sauf sur son propre profil.
- **Vie privée** : `quand` est le jour de la première visite si `p_user_id` est l'utilisateur
  connecté (`auth.uid()`), sinon **le 1er du mois** (`date_trunc('month', …)`). La coupe se fait en
  SQL : le jour exact ne sort jamais de la base pour quelqu'un d'autre.
- `territoire` : `coalesce(departement, pays)` ; `null` → « Ailleurs » côté client.
- `GRANT EXECUTE` à `anon` et `authenticated`, comme `get_profil_explorateur`.

### `get_profil_explorateur` : `visites` remplacée par un nombre

Recréée depuis sa définition live : la liste `visites` disparaît (le passeport la porte), remplacée
par `nb_visites integer` (lieux distincts visités, mêmes règles de visibilité) — `ProfilChiffres`
affiche ce nombre. Avant de retirer la clé : vérifier qu'aucun autre consommateur ne la lit (V1
`apps/explore-web`, Hub, thème Shopify `../shopify (Runes de Chêne)/sections/`). Si un consommateur
existe, garder `visites` et ajouter seulement `nb_visites`.

## Écrans — dans la zone `compte` (`apps/web-v2/src/features/compte/`)

Le passeport fait partie du profil : il vit dans la zone `compte`, ce qui évite tout import entre
zones. Les routes des pages 2 et 3 se câblent dans `app/routes/`.

| Fichier | Rôle |
| --- | --- |
| `api/passeport.ts` + `api/lirePasseport.ts` | appel `get_passeport`, lecture typée du JSON |
| `hooks/usePasseport.ts` | TanStack Query, clé `['passeport', id]` |
| `lib/passeport.ts` | calcul pur : par nature, par territoire, par mois, comptes |
| `components/passeport/TamponNature.tsx` | tampon rond, icône, `×N`, encre selon le compte |
| `components/passeport/TamponPhoto.tsx` | photo encrée bichrome + pastille de date |
| `components/passeport/PasseportProfil.tsx` | page 1, dans `ProfilDecouvertes` à la place de « Visités » |
| `components/passeport/PasseportOuvert.tsx` | page 2 |
| `components/passeport/PasseportTerritoire.tsx` | page 3 |

### Page 1 — sur le profil (remplace la section « Visités »)

- Titre « Passeport · N tampons ».
- Un **tampon par nature** visitée, avec `×N`. L'encre fonce avec le compte (3 paliers : 1, 2–9,
  10+). Les natures jamais visitées en pointillés, sans compteur (liste `natures` du même appel).
- « N départements · N pays » : départements distincts ; pays distincts **France comprise** dès
  qu'il y a un département. Un compte nul n'est pas affiché.
- « Ouvrir le passeport › » → page 2.
- Zéro tampon : la section n'existe pas (comme aujourd'hui).

### Page 2 — `…/explorateur/:id/passeport`

- Une page par territoire, la plus récemment tamponnée en premier : nom du territoire, nombre de
  tampons, « +N › » si plus de 4.
- Les 4 plus récents en **photo encrée** qui se chevauchent, avec leur date seule (jour pour soi,
  mois pour les autres), sans nom de lieu.
- Taper une page → page 3.

### Page 3 — `…/explorateur/:id/passeport/:territoire`

- En-tête : nom du territoire, « N tampons · N natures sur 22 · depuis le … ».
- « Ses natures » : les tampons de nature de ce territoire avec `×N`.
- Une section par mois, la plus récente en premier : « OCTOBRE 2026 · 6 TAMPONS ». Les **deux
  mois les plus récents** sont ouverts ; les autres sont repliés et s'ouvrent au toucher.
- Un mois ouvert = un **défilement horizontal** de `LieuCarte` (le style « Lieux ajoutés ») avec le
  **tampon de la nature** posé sur le coin haut-droit et, sur son propre profil seulement, la
  pastille du jour (« 6 oct. ») à la place de la distance. Une carte ouvre la fiche du lieu.
- Territoire inconnu dans l'URL : « Ce territoire n'est pas dans le passeport » + retour.

### Photo encrée (CSS)

Photo en niveaux de gris (`filter: grayscale(1) contrast(1.3) brightness(1.1)`) dans un disque,
recouverte de la couleur de la nature en `mix-blend-mode: lighten` puis du papier en `darken`,
cerclée en pointillés. Pas de photo → le disque de la nature avec son icône.

## États

- Chargement : squelette de la section / de la page.
- Erreur : « Le passeport n'a pas pu s'ouvrir » + « Réessayer ».
- Hors ligne : ce que TanStack Query a déjà en cache, sinon l'erreur.

## Tests

- `lib/passeport.ts` : regroupements par nature (paliers d'encre), par territoire (4 + « +N »,
  `null` → Ailleurs, ordre), par mois (ordre, 2 ouverts), comptes départements / pays.
- `lirePasseport` : JSON invalide ou partiel.
- Composants : page 1 (natures manquantes en pointillés, compte nul masqué), page 3 (pastille du
  jour seulement pour soi, territoire inconnu).
- SQL, en prod dans une transaction annulée : en tant qu'Uriel → jours ; en tant qu'un autre
  utilisateur sur le profil d'Uriel → 1er du mois ; lieu privé d'Uriel invisible pour l'autre ;
  `nb_visites` = nombre de lieux distincts.
- Parcours dans le navigateur (son profil et un autre), puis sur téléphone.
