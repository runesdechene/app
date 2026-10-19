# « J'y suis allé » — déclarer une visite passée, à distance

> 19/10/2026 · V2 (`apps/web-v2`) et Supabase · validé avec Uriel le 19/10. Maquettes Figma
> `MKqyVhDPreg06PMEAaDxde`, section « J'y suis allé — visite passée (19/10) » (`649:1612`) :
> 1. la fiche, trop loin · 2. la feuille · 3. le bouton de visite (états) · 4. le passeport, le
> détail · 5. Sur les chemins. Décisions : `_État.md` d'Explore, rubrique Profil.

## Pourquoi

Des joueurs tiennent Explore comme un carnet de voyage. Ils veulent y mettre les lieux visités
avant l'appli, sans casser la rareté de ce qui se gagne sur place. La règle d'Uriel : **ce qui
compte, c'est qu'un souvenir ne soit jamais revendiqué**. Le passeport, « c'est de la gloriole ».

## Les règles

| | Un souvenir (« J'y suis allé ») | Une visite GPS |
|---|---|---|
| Compté dans « Lieux visités », le passeport, ses tampons et ses natures | oui | oui |
| « Noble Explorateur de… » (département le plus visité) | oui | oui |
| Parmi les Explorateurs du lieu, pastille « visité » sur la carte | oui | oui |
| Sort de « À explorer près de toi » et de « Envie d'y aller » | oui | oui |
| Revendiquer | **jamais** | oui, sur place |
| XP, titres « en visitant N lieux sur place » | **non** | oui |
| Sur les chemins | une ligne regroupée par personne et par jour : « Marie ajoute N souvenirs » (même pour un seul), avec les vignettes | « Marie a visité … » |
| L'auteur du lieu | prévenu dans la cloche (« a ajouté … à ses souvenirs »), **jamais par push** | cloche et push |

- **La date** : un mois et une année (« août 2019 »), jamais dans le futur, pas avant 1900.
- **Facultatifs** : un mot au Carnet de passage du lieu, et une photo qui l'accompagne (le carnet
  exige un mot : une photo seule ne part pas).
- **On ne déclare qu'un lieu jamais visité.** Un lieu déjà visité en GPS n'offre pas le geste.
- **De retour sur place**, le bouton redevient « Marquer ma visite (GPS) » : la visite remplace le
  souvenir (XP, ligne « a visité », revendication possible) et **garde la date d'origine** au
  passeport.
- **Le genre** : « J'y suis allé » ou « J'y suis allée » selon les Préférences (`title_gender`).

## Données — migration 531

`place_explorers` reste la seule table des visites ; un souvenir y est une ligne marquée :

- `a_distance boolean NOT NULL DEFAULT false` — vrai tant que la ligne n'est qu'un souvenir ;
- `souvenir_le date` — le 1er du mois déclaré ; reste après la visite GPS (la date d'origine) ;
- `declare_le timestamptz` — quand le souvenir a été déclaré (le fil).

Pour un souvenir, `visited_at` vaut le mois déclaré (midi, heure de Paris) : tout ce qui trie ou
affiche par date range le souvenir à sa place. La visite GPS remet `visited_at` à maintenant (la
revendication exige une visite de moins de 30 minutes) et `a_distance` à faux.

**Nouvelle fonction** `declarer_souvenir(p_id text, p_annee int, p_mois int) RETURNS json`
(`{ souvenirLe }`) : connecté, lieu visible et découvert (ajouté, visité ou découvert), jamais
visité ; date valide ; écrit la ligne et prévient l'auteur (`souvenir`).

**Fonctions reprises de leur définition live** :

| Fonction | Changement |
|---|---|
| `visiter_lieu`, `visiter_depuis_pin` | un souvenir devient une visite (`a_distance = false`) ; « première visite » = première visite GPS |
| `_trg_xp_explorer_insert` / `_delete` | rien pour un souvenir ; un nouveau déclencheur donne l'XP quand le souvenir devient une visite |
| `revendiquer_lieu`, `compagnons_possibles` | exigent une visite GPS (`NOT a_distance`) |
| `get_user_titles` | `places_visited` ne compte que les visites GPS (« sur place ») |
| `sur_les_chemins` | « visite » sans les souvenirs ; une branche `souvenir` (id `souvenir:<qui>:<jour>`, `nombre`, `photos` : jusqu'à 4) |
| `_auteur_du_chemin` | sait saluer une ligne `souvenir` |
| `activite_publique` (vitrine) | sans les souvenirs |
| `_notification_v2` | accepte `souvenir` (absent de `send-push` : jamais de push) |
| `fiche_lieu` | `moi.aDistance`, `moi.souvenirLe`, `moi.genre` |
| `get_passeport` | date d'un tampon = `souvenir_le` s'il existe ; `aDistance` par tampon |
| `explorateurs_du_lieu` | `aDistance`, et la date d'origine |

Hors périmètre, laissé tel quel et noté : les compteurs du Hub (`hub_lieux`, `hub_comptes`)
comptent les souvenirs comme des visites ; les fonctions de la V1 qui lisent `place_explorers`
(Coupe, gloire, défis) ne sont plus appelées. Retirer un souvenir : plus tard, si on le demande.

## Écrans

1. **Le bouton de visite** (`etatVisite`) — nouvel état `souvenir` : loin, « ✓ J'y suis allé en
   août 2019 · 274 km » (style « visité ») ; à portée, « Marquer ma visite (GPS) ». Le lien
   discret « J'y suis allé » s'affiche sous le bouton quand le lieu n'est pas visité et qu'on est
   trop loin ou sans position.
2. **La feuille « J'y suis allé »** — consigne, mois et année, photo, mot au carnet, « Ajouter à
   mon passeport ». Après l'envoi : la fiche, la carte, le profil et le passeport se relisent.
3. **Le passeport, le détail** — une carte souvenir garde sa photo en couleur ; son tampon passe
   au gris, barré d'un bandeau « À DISTANCE » ; la date dit « Souvenir · août 2019 ».
4. **Sur les chemins** — « Marie ajoute 12 souvenirs », le compte, puis jusqu'à 4 vignettes et
   « +8 ».
5. **La cloche** — « Marie a ajouté Château de Ranrouët à ses souvenirs ».
