# Revendiquer par GPS — conception

> 21/10/2026 · V2 (`apps/web-v2`) et Supabase · maquettes Figma validées par Uriel le 21/10 (fichier
> App v2) : 1 carte `679:1732` · 2 visite `682:1720` · 3 plante ton étendard `679:1676` ·
> 4 conquis ! `678:1676` (animée, timeline 2,4 s, annotation `678:1775`) · 5 retour carte `679:1810`.

## Pourquoi

Revendiquer un lieu sur place se fait aujourd'hui en deux clics sans relief (« Visiter », puis une
feuille). Uriel veut du panache : sentir qu'on vient de **conquérir** un lieu — un geste, un son, un
mot, son nom sur la carte. Et la carte doit pousser à le faire quand on est sur place.

**Réussi si** : sur le terrain, la carte propose d'elle-même de marquer la visite ; la visite est
une fête ; la revendication est une cérémonie distincte, avec un « wow » à l'impact ; on ne se
demande jamais si l'on a visité ou revendiqué.

## Le parcours

1. **Carte** — à moins de 200 m (`PORTEE_M`) d'un lieu que je ne tiens pas, un bouton flottant
   « Marquer ma visite » (nom du lieu · distance) monte au-dessus de la barre du bas ; un anneau
   pulse autour du lieu. Plusieurs lieux à portée : le plus proche. Il disparaît quand on s'éloigne,
   et n'existe pas sans position (on ne demande jamais la position pour lui : seulement si elle est
   déjà autorisée).
2. **La visite** — le toucher marque la visite, puis la brique `Recompense` (celle de Découvrir et
   d'Ajouter, « la même fête ») : photo du lieu, 🎉 qui éclate, confettis, « CHÂTEAU DE COARAZE »,
   « Ton 18ᵉ lieu visité ! », « +N d'expérience », la jauge. Bouton crème « Revendiquer ce lieu » ;
   « Revenir à la carte » = visite seule.
3. **Plante ton étendard** — plein écran sur le parchemin de l'appli : le nom du lieu, l'étendard,
   « PLANTE TON ÉTENDARD », une phrase, le champ « Nom de ta revendication » (pré-rempli avec mon
   nom), des pastilles qui défilent de côté (mon nom, puis chacune de mes Compagnies : en toucher une
   remplit le champ), une ligne « Avec toi » seulement si d'autres Explorateurs sont là. En bas,
   bloqués : « Planter mon étendard » et « Pas maintenant — revenir à la carte ». Le formulaire
   apparaît en cascade (maquette).
4. **Conquis !** — plein écran parchemin, l'animation de la maquette : l'étendard tombe, se fiche,
   l'écran tressaille, deux anneaux d'encre, l'étendard se balance ; « CONQUIS ! » frappé à
   l'impact ; puis le lieu, « PRIS À REMY » (s'il était tenu par un autre), « « La Garde du Comté »
   flotte sur ce lieu… », « Ton 4ᵉ lieu conquis », « On te préviendra si quelqu'un vient te le
   reprendre. », « VOIR LE LIEU → ». Bruitage `public/res/etendard-plante.mp3` (coup sourd puis
   applaudissements) lancé au toucher de « Planter mon étendard », vibration à l'impact.
5. **Retour** — la carte ; le nom choisi en pilule sous le lieu (le style des pilules existant).

Depuis la **fiche** d'un lieu, le bouton de visite mène au même parcours (2 → 3 → 4).

## Tranché (Uriel, 21/10)

- La pilule de la carte montre **le nom choisi**, Compagnie comprise. Remplace « revendiquer pour sa
  Compagnie, sans rien sur la carte » (05/10).
- **Champ libre**, même seul : 40 caractères, comme les noms d'expédition. Vide → mon nom.
- **L'expédition reste**, dans l'écran 3, seulement si d'autres sont présents. Leurs avatars
  s'affichent décochés : on coche ceux qui sont avec soi (personne n'est embarqué d'office).
- **En groupe, le nom est obligatoire, ou celui d'une Compagnie** : dès qu'un compagnon est coché,
  le champ perd mon nom, ma pastille disparaît, le bouton reste gris tant que le champ est vide. Le
  serveur garde son refus « Nom d'expédition manquant ».
- **Pastille de Compagnie** : la toucher remplit le champ et revendique « pour » elle ; retoucher le
  nom à la main fait tomber le « pour ».
- **Un seul parcours** : `FenetreRevendication` disparaît (code mort supprimé dans le même lot).
- Visite et revendication sont deux écrans ; l'XP va à la visite, la revendication n'en donne pas.
- Hors de ce chantier : la valeur de l'XP d'une visite (réglable depuis le Hub, chantier à part —
  `_État.md`).

## Serveur — une migration

Partir des définitions **live** copiées entières (`-- WHY:` en tête).

- **`visiter_lieu`** rend, en plus de `visiteLe`, la récompense comme `percer_enigme` :
  `rang` (mes visites GPS, souvenirs exclus), `gain` (la valeur appliquée par le déclencheur,
  `glory.visit_gps`), `niveau`, `avant`, `apres` (jauge 0–1, via `_level_from_xp`). Une revisite
  d'un lieu déjà visité ne redonne pas d'XP : `gain` = 0, la phrase le dit (« Te revoilà ! » —
  au constructeur de proposer la tournure, dans la ligne de `phraseRang`).
- **`revendiquer_lieu`** garde le nom quand on est seul (aujourd'hui il le jette). Seul et vide →
  nom public. En groupe, inchangé : un nom est exigé.
- **`_revendiquer`** rend en plus `prisA` (nom public de l'ancien tenant, `null` si personne ou
  moi) et `rang` (nombre de lieux distincts que j'ai revendiqués, table `revendications`).
- Vérifier que la carte lit bien le titre de l'expédition pour la pilule d'un tenant seul.

## Front — ce qui existe et ce qui naît

- **Réutilisé** : `Recompense` (shared/ui), `usePosition` (à remonter dans `shared/hooks`, la carte
  en a besoin), `PORTEE_M` et `distanceM`, `useRevendication` (compagnons, Compagnies),
  `PastilleChoix`, `Champ`, `Button`, le parchemin de `packages/da`, `revendiquerLieu` / `visiterLieu`.
- **Naît** : le bouton flottant de la carte (+ une fonction pure « le lieu à portée », testée) ;
  l'écran « Plante ton étendard » ; l'écran « Conquis ! » (animation en CSS, `prefers-reduced-motion`
  → tout est à sa place sans bouger, comme `SceauQuiSeRetourne`) ; l'étendard en SVG
  (NAS `VISUELS/LA CARTE/etendard.svg`, à l'encre, dans `src/assets/ui/`).
- **Meurt** : `FenetreRevendication` (+ son test et son CSS), l'état `revendiquer` de `BoutonVisite`
  si le parcours le rend inutile.

## Cas limites

- Position perdue entre l'écran 2 et 3 : le serveur refuse (« Pas sur place ») ; message existant de
  `useRevendication`, on reste sur l'écran 3.
- Visite de plus de 30 minutes avant de planter : refus « Visite trop ancienne », même message.
- Un lieu que je tiens déjà : pas de bouton flottant.
- Lieu « inconnu » (pas encore découvert) à portée : à vérifier par le constructeur — `visiter_lieu`
  l'accepte-t-il ? S'il le refuse, le bouton ne le propose pas.
- Son : un téléphone en silencieux le coupe ; rien d'autre à faire.

## Choix de XO après relecture (à vérifier en relisant)

- **Seuls les lieux (`nature = 'lieu'`) ont le bouton flottant** : une curiosité se visite mais ne
  se revendique pas (`revendiquer_lieu` l'exige). Depuis la fiche d'une curiosité, `Recompense`
  n'offre que « Revenir ».
- **Un lieu que je tiens déjà** : la fête de la visite n'offre pas « Revendiquer ce lieu ». Le
  renommage d'un lieu tenu n'est pas dans ce chantier (la branche « déjà tenant » de `_revendiquer`
  ne bouge pas).
- **Photo et nature pour `Recompense`, depuis la carte** : on charge la fiche du lieu au toucher
  (cache existant de `useFiche`), pas de nouveau champ dans `visiter_lieu`.
- **Les anciens noms d'expédition ne sont plus proposés** : pastilles = mon nom puis mes
  Compagnies. La requête `noms` de `useRevendication` et `fetchNomsExpedition` disparaissent.
- **Sortie de « Conquis ! »** : « VOIR LE LIEU → » ouvre la fiche ; une croix (comme celle de
  `Recompense`) ramène là d'où l'on venait — sur la carte, c'est l'écran 5. Les écrans 2 à 4 sont
  un calque posé sur l'écran de départ, pas une route.
- **L'étendard** : `etendard.svg` est récupéré du NAS, il entre dans `src/assets/ui/`.
- **Lieu inconnu à portée** : `visiter_lieu` l'accepte (il le découvre au passage) ; le bouton le
  propose.

## Laissé au constructeur

Le découpage des composants, les noms de fichiers, la tournure exacte d'une revisite, le réglage à
l'oreille du départ du son par rapport à l'impact, la façon de faire suivre la position sur la carte
sans la redemander.
