# Le scan d'un Fragment — conception

> 09/10/2026 · V2 (`apps/web-v2`), Hub (`apps/hub`), Supabase · maquettes Figma « Scan — 0 à 5 » (fichier App v2,
> page 1, x ≈ 55 400 ; premier nœud 530:796) · décisions dans le `_État.md` d'Explore (Tranché, 09/10) · essai
> jetable du 09/10 (page `essai-scan--runesdechene.netlify.app`, hors dépôt)

## Pourquoi

« Chaque Fragment peut être scanné pour être lu ou écouté » (ADN de la marque). Aujourd'hui le Récit d'un
Fragment n'est joignable que par son adresse. On veut que n'importe qui passe son téléphone devant un t-shirt
Runes de Chêne et tombe sur son histoire, **comme avec un QR code, mais sans QR code** : rien n'est imprimé sur
le vêtement, et aucun QR propre à un Fragment n'existe (Uriel, 09/10). Un seul QR, le même pour tous (stand,
flyer), peut au mieux ouvrir le scanner.

Les « scans » sont l'un des quatre chiffres que la marque mesure (`_État.md` de la marque) : on les compte.

Ce que ce chantier ne fait pas : la réalité augmentée (voulue un jour, pas maintenant), le Campement (il se
branchera sur le Récit quand il existera), les motifs vendus sans Fragment dans la base (Huginn, Renard, Cerf,
Ours, Valsgärd, Vegvisir, Svarrun, Gjallarhorn : il faut d'abord les créer comme Fragments), l'impression du QR
du stand.

## Ce que l'essai a montré (09/10)

Un modèle de vision léger tourne sur le téléphone (MediaPipe Image Embedder, MobileNet V3 small, ≈ 4 Mo). Il
résume une image en une **empreinte** (un vecteur) ; deux images se comparent par la ressemblance de leurs
empreintes (cosinus, 0 à 1).

- Banc sur les ~240 photos de la boutique qui montrent nos 12 motifs, et ~90 montrant d'autres motifs :
  - illustrations seules comme références : le bon motif premier 139 fois sur 239 ; au réglage
    0,45 / 0,05, 34 bips, **tous justes, aucun sur un motif hors catalogue** ;
  - le modèle large (≈ 11 Mo) fait moins bien (87 / 239) ;
  - les **mockups de la boutique comme références font pire** (60 / 239, des dizaines de faux bips) : le modèle
    reconnaît la coupe et le décor des photos, pas le motif. Recadrés sur le motif : 86 / 239, toujours faux.
- Sur le téléphone d'Uriel : une **vue du vrai t-shirt apprise comme référence fait passer la ressemblance
  au-delà de 0,9**.

D'où le principe : les références sont les illustrations de la boutique (un socle qui ne bipe pas à tort) **plus
des vues du vrai t-shirt ajoutées à la main par les admins**, depuis le scanner.

## Le parcours (maquettes 530:796 et suivantes)

0. **L'entrée** : l'icône du scanner (celle déjà dessinée en haut du Récit) se pose devant la cloche, dans
   l'en-tête de la coquille — le même pour tous les onglets, donc visible partout (la maquette la montre sur
   l'Accueil ; il n'y a pas de « + » dans cet en-tête, le seul est sur la carte). Depuis un QR du stand ou du flyer, on arrive directement sur `/scan`, appli installée ou non.
1. **On vise** : « Vise le motif, de près. Ça bipe tout seul. » La caméra s'ouvre tout de suite ; le modèle se
   charge pendant qu'on vise. Rien à toucher.
2. **Bip** : reconnu → un bip, une petite vibration (Android), les coins du viseur passent à la cire, une carte
   « Fragment reconnu · <nom> » avec la vignette ; une demi-seconde plus tard, le Récit s'ouvre.
3. **Pas encore reconnu** : après 8 s sans bip, « Pas encore reconnu. Rapproche-toi, sans reflet. » et le lien
   « Voir tous les Fragments », sans couper la caméra.
4. **Apprendre cette vue** (admins seulement) : une feuille en bas du même scanner — le Fragment (par défaut
   celui que le modèle croit voir), « Ajouter cette vue », le nombre de vues de ce Fragment, « Retirer la
   dernière ».
5. **Le Récit** : l'écran existant (Figma 99:145), sans compte. Un membre l'ouvre dans l'appli, avec ses
   onglets (`/accueil/fragment/:id`) ; un visiteur sur `/scan/fragment/:id`, le Récit seul sur le fond du
   scanner (la page publique `/bienvenue/carte/fragment/:id` s'ouvre sur la carte des visiteurs, qui n'a plus
   de Fragments).

**« Voir tous les Fragments »** (`/scan/fragments`) : une liste simple (illustration et nom de chaque Fragment visible) qui mène à
son Récit. Elle sert aussi quand la caméra est refusée.

## Les empreintes (Supabase)

Une table `scan_empreintes`, une ligne par référence :

| colonne | sens |
|---|---|
| `id` | |
| `fragment_id` | → `title_fragments.id`, effacée avec lui |
| `source` | `illustration` (calculée par le Hub) ou `vue` (apprise depuis le scanner) |
| `vecteur` | l'empreinte, `real[]` normalisée (1 024 nombres pour MobileNet V3 small) |
| `modele` | le modèle qui l'a calculée (`mobilenet_v3_small`) ; changer de modèle invalide les anciennes |
| `ajoutee_par`, `ajoutee_le` | |

- **Lecture pour tous**, sans compte, par une RPC `empreintes_du_scan(p_modele)` qui rend, pour ce modèle, les
  Fragments visibles qui ont des empreintes : id, nom, illustration, et leurs empreintes (id, source,
  vecteur) — un seul appel à l'ouverture du scanner. Les vecteurs sont arrondis à 4 décimales avant
  d'être enregistrés (le poids de l'appel).
- **Écriture réservée aux admins** (`role = 'admin'`), par RPC : `ajouter_vue(fragment, vecteur, modele)`,
  `retirer_empreinte(id)` (« Retirer la dernière » retire la vue la plus récente du Fragment), `remplacer_empreintes_illustration(fragment, vecteurs[])` (le Hub remplace d'un coup
  celles d'un Fragment).
- **Les scans** : une table `scans` (Fragment, quand, l'Explorateur s'il est connecté), remplie par une RPC
  `noter_scan(fragment)` ouverte à tous ; un bip = une ligne. Les admins en lisent les comptes.

Numéros de migration : à partir de 470.

## Le scanner (Explore)

- **Une adresse, `/scan`**, servie par Explore. La redirection réservée dans `apps/web-v2/netlify.toml`
  (« Préfixe réservé — à venir », vers un autre site) est retirée : le scan est **dans** Explore (Uriel, 08/10),
  ce qui remplace sur ce point la spec de bascule (« Explore n'utilise jamais `/scan` pour ses écrans »). La
  route est publique (posée avant la garde d'accès, comme `/bienvenue`) : ni compte ni onboarding. Le service
  worker ajoute `scan` à sa liste blanche d'écrans (`src/sw/ecrans.ts`).
- **Une zone `features/scan`** : l'appel aux empreintes, le chargeur du modèle, la boucle d'analyse, la règle du
  bip, l'écran, la feuille des admins, la liste des Fragments.
- **La reconnaissance** : plusieurs fois par seconde, le carré du viseur passe au modèle ; on garde, par
  Fragment, la meilleure ressemblance parmi ses empreintes. **Bip** quand le premier :
  1. dépasse le **seuil** ;
  2. devance le deuxième d'au moins l'**avance** ;
  3. tient sur **N images d'affilée**.
  Puis 2,5 s de silence. Trois constantes, départ **0,45 / 0,05 / 3** (l'essai), fixées après le test de
  l'atelier. La règle est une fonction pure, testée seule.
- **Le modèle** (`@mediapipe/tasks-vision`) se charge **à part** (import dynamique) : le reste de l'appli ne
  grossit pas. Le modèle et ses fichiers wasm sont **servis par notre domaine, sous `/modeles/`** (pas de
  dépendance au CDN de Google ; ouverts au Hub par CORS) et gardés en cache par le service worker
  (`CacheFirst`) : le deuxième scan démarre sans attendre, même hors réseau. Essayer le GPU, retomber sur le
  CPU.
- **Le son sur iPhone** : Safari ne joue un son qu'après un toucher, et ne vibre pas.
  - depuis l'icône de l'en-tête, ce toucher débloque le son ;
  - arrivé par un QR sans avoir rien touché, l'écran montre d'abord un grand bouton **« Scanner »** (il débloque
    le son et, sur iPhone, déclenche la demande de caméra) ;
  - sans vibration, le signal visuel (coins à la cire, nom) suffit.
- **Caméra refusée** : un message qui dit comment la réautoriser, et « Voir tous les Fragments ».
- **Les admins** : la feuille « Apprendre cette vue » n'existe que pour `role = 'admin'`. L'empreinte d'une vue
  est celle du carré du viseur au moment du toucher ; elle part en base et sert au scan suivant de tout le monde.

## Le Hub (page « Fragments (Shopify) », `components/fragments/FragmentsShopify.tsx`)

- Le Hub charge le même modèle depuis `app.runesdechene.com/modeles/`. Après la synchro Shopify, les empreintes des **illustrations** se calculent dans le navigateur (même modèle,
  chaque illustration posée sur fond blanc et sur fond noir, entière et recadrée au centre — comme l'essai) et
  remplacent les anciennes ; un bouton « Recalculer » pour un Fragment.
- Par Fragment : le nombre de **vues apprises**, chacune retirable ; un Fragment visible **sans aucune vue** est
  signalé « à filmer ».
- Les **scans** par Fragment, sur 7 et 30 jours.

## Valider

- **Tests automatiques** : la règle du bip (seuil, avance, images d'affilée, silence) ; la lecture des
  empreintes ; les RPC (un non-admin ne peut ni ajouter ni retirer ; `empreintes_du_scan` ne rend que les
  Fragments visibles et le modèle courant).
- **Le test de l'atelier (Uriel)**, avant la mise en ligne : chaque Fragment dans chaque coloris, à plat et
  porté ; puis le contrôle — un t-shirt uni, un imprimé qui n'est pas un Fragment, un tatouage, une affiche. Les
  trois réglages se fixent sur ce qu'il observe.
- **Sur un iPhone et un Android** : l'arrivée par un QR (le bouton « Scanner »), le son, le refus de la caméra,
  le deuxième scan hors réseau.

## Points ouverts

- Les réglages définitifs du bip (après l'atelier).
- Un bouton « Scanner » ailleurs que sur l'Accueil (carte, onglets) si l'usage le demande.
- **Plus tard, scanner autre chose qu'un motif** (Uriel, 09/10) : une création d'un événement qui débloque
  quelque chose, ou un lieu ancien — de préférence le lieu lui-même (une pierre sculptée, une inscription
  existante), jamais une marque laissée sur un monument. Le principe ne change pas : une empreinte apprise par
  les admins. Il faudra alors que `scan_empreintes` puisse désigner autre chose qu'un Fragment ; rien n'est
  construit pour ça maintenant.
