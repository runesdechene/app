# ALPHA V0.8.15
## Chat des expéditions live + bouton "Mettre à jour" qui fonctionne enfin

Trois corrections critiques en marge du switch de domaine `carte → app` :

### 💬 Le chat des expéditions reçoit enfin les messages en live
Le hook chat ouvrait une souscription Realtime, mais si elle mourait en silence (passage en arrière-plan, hibernation du PC, réseau qui clignote), tu ne recevais plus rien jusqu'à fermer/rouvrir la modale. Désormais : on souscrit AVANT de charger l'historique (plus aucun message perdu pendant le chargement), un filet relance la souscription si elle tombe, et chaque retour de focus de l'onglet rapatrie automatiquement les nouveaux messages. Le push notif et le chat sont enfin synchrones, sur PC comme sur mobile.

### 🔁 Le bouton "Mettre à jour" met vraiment à jour
Sur certaines installations PWA, le bouton désinscrivait bien le Service Worker mais celui-ci restait actif jusqu'à la fermeture complète des onglets — le rechargement repassait par le SW poisoné et l'app restait sur l'ancienne version. Désormais le SW se désinscrit depuis l'intérieur sur demande, l'app attend qu'il lâche le contrôle, et le rechargement final embarque un cache-buster pour balayer les caches HTTP résiduels.

### ☠️ Kill-switch pour les anciennes installations
Quelques joueurs avaient installé la PWA depuis l'ancien domaine `carte.runesdechene.com` avant le switch et restaient prisonniers d'un SW qui ne pouvait plus s'updater (cross-origin bloqué pour les SW). Une exception côté Netlify sert maintenant à cet ancien domaine un SW spécial qui se suicide proprement et migre la PWA vers `app.runesdechene.com` au prochain lancement. Plus besoin de désinstaller/réinstaller à la main.

---

# ALPHA V0.8.14
## L'app ne plante plus au lancement quand le réseau tousse

Depuis le changement de domaine `carte → app`, plusieurs joueurs voyaient l'app refuser de se lancer (écran blanc, erreur "Load failed") quand leur 4G/Wi-Fi clignotait au démarrage. Le Service Worker cherchait son cache au mauvais nom interne — du coup chaque ouverture dépendait d'un fetch réseau parfait. Corrigé : le cache local est désormais bien retrouvé, et un dernier filet de sécurité empêche tout crash silencieux même offline. iOS et Android.

---

# ALPHA V0.8.13
## Safe-area iPhone restaurée sur les lieux dans le brouillard

Les boutons **Partager** et **Fermer** en haut de la fenêtre d'un lieu encore dans le brouillard passaient sous la status bar iPhone (heure, signal, batterie). Ils respectent à nouveau l'encoche et restent accessibles.

---

# ALPHA V0.8.12
## Vigilance sur tes lieux + symétrie totale Gloire/Coupe

### 🛡️ Bouton "Réaffirmer mon étendard"
Quand tu es **déjà veilleur GPS** d'un lieu, le bouton change de label : **"Réaffirmer mon étendard"** (ton sépia). C'est une action **purement défensive** — elle efface les couronnes des mécènes adverses qui cherchent à te piquer le lieu, mais ne génère **aucun gain** (Gloire, Coupe, Cour). Sinon on pourrait farmer en spam de clic.

### 🏆 Modale Victoire / Vigilance
Chaque plant d'étendard ouvre maintenant une **modale plein écran** avec ton placetitre, ta couleur de Maison, et le détail des gains :
- *"Tu as planté ton étendard et pris ce lieu — +7 🎖️ Gloire · +7 🏆 Coupe des Héritages · +50 ⚔️ score Cour"*
- *"Tu as réduit à néant l'investissement des autres mécènes ! 💪 (3 menaces effacées)"* sur réaffirmation

Plus de clic mort sans feedback. Tu sais exactement ce que ton geste rapporte.

### ⚖️ Suppression d'un lieu : symétrie parfaite
**Bug grave corrigé** : supprimer un lieu retirait jusqu'à 2× plus de Gloire et Coupe que ce que la création avait apporté (triggers SQL avec valeurs hardcodées d'un ancien barème). Désormais, ce que tu gagnes en créant un lieu = exactement ce que tu perds en le supprimant. Tout lit le barème dynamique du Hub : si on ajuste les valeurs, la rétrocession suit automatiquement.

Cleanup des données passées : les rares plants en doublon intra-24h (test/spam) ont été nettoyés, retournant à un état propre.

---

# ALPHA V0.8.11
## Le Classement enfin par-dessus tout

Le **Classement** (Gloire / Lieux revendiqués / Lieux ajoutés) passait sous la barre du bas et le haut de l'interface, peu importe d'où tu l'ouvrais. Désormais il s'affiche en plein écran par-dessus tout — sur desktop comme sur mobile, sur la home comme sur la carte. Plus de modale coincée derrière la navigation.

---

# ALPHA V0.8.9
## Énergie : le HUD aussi affiche la vraie valeur

Suite du fix de V0.8.8. On avait corrigé la fenêtre Découvrir un lieu, mais l'indicateur d'énergie sur la carte (et la barre de stats sur la home) continuait d'afficher la valeur "fluide" — d'où l'incohérence si tu venais de dépenser 1.5 sur un lieu : la stat affichait 8.8 alors que ta vraie énergie était 8.5.

Désormais tout l'app affiche la même chose : ta vraie énergie utilisable. L'indicateur reste informatif via le **+X/h** à côté qui te rappelle le rythme de regen. Plus de divergence entre le HUD et l'action.

---

# ALPHA V0.8.8
## Énergie : fini le bug du bouton mort à 1.9

Le bug d'énergie qu'on traîne depuis des mois. Tu avais *"1.9 énergie"*, le lieu coûtait 1.5, et le bouton ne réagissait pas — il fallait remonter à 2 pour pouvoir découvrir.

La cause : l'affichage de l'énergie comptait une *fraction de regen en cours* (purement cosmétique, pour donner l'effet d'une jauge qui monte). Mais cette fraction n'existait pas côté serveur — qui ne voyait que ton *vraie* énergie utilisable. Tu cliquais sur un bouton qui semblait actif, le serveur refusait silencieusement, et rien ne se passait.

Désormais sur la fenêtre **Découvrir un lieu** :
- L'énergie affichée est celle que tu peux **vraiment dépenser** (pas l'illusion de regen). Si la DB dit 1.5, tu vois 1.5. Pas plus, pas moins.
- Un petit timer **+1 dans 3m 12s** te dit quand tu auras le prochain point.
- Et au cas où une désync se glisserait encore, un toast d'erreur t'explique pourquoi si le serveur refuse — plus de clic mort sans feedback.

L'indicateur d'énergie en HUD de la carte garde son animation fluide (c'est joli, et ça reste un indicateur de progression — pas une interface d'action).

---

# ALPHA V0.8.7
## Polish mobile : Maison, événements, ajout de lieu

Une passe de fixes ciblée sur l'expérience iPhone.

### 🛡️ La fenêtre d'une Maison
Sur mobile, l'image de la Maison ne s'affichait plus en entier (rognée), et un grand vide apparaissait sous le classement. C'est réparé : un seul scroll naturel qui descend image → bonus → membres, plein écran qui respecte l'iPhone (encoche en haut, home indicator en bas).

### 💬 Notifications d'événement qui amènent où il faut
Cliquer sur *« X t'a écrit dans Y »* ouvre maintenant directement le **chat** de l'événement. Les autres notifs d'événement (validation, modification, demande à rejoindre) ouvrent l'onglet **Infos**. Et quand tu bascules de l'onglet Événement vers Chat, le défilement se met automatiquement sur le dernier message — fini de scroller à la main.

### 📍 Ajouter un lieu sur mobile
Trois corrections :
- Le bouton **Placer ici** (au moment du choix de l'emplacement) et le bouton **Créer le lieu** (au moment du formulaire) étaient masqués par les barres natives — ils sont désormais toujours visibles.
- L'**époque** n'est plus obligatoire. Si tu ne sais pas, *Indéfinie* est sélectionnée par défaut, et un explorateur érudit pourra compléter plus tard depuis la fiche.
- L'aperçu des récompenses suit désormais le **vrai barème** (qui peut évoluer), avec une lecture claire : `Lieu ajouté · +X 🎖️ Gloire · +Y 🏆 Coupe des Héritages`. Plus de "+15 exploration" hérité d'avant.

---

# ALPHA V0.8.6
## Notifications personnelles : fini les notifs de toi-même

Tes notifications personnelles ne te disent plus *"tu as pris ce lieu"* ou *"tu as réaffirmé ton drapeau"* — tu viens de le faire, tu sais. Elles se concentrent sur ce qui se passe pendant que tu n'es pas là : un autre joueur prend ton lieu, un like sur ton récit, une demande à rejoindre ton expédition.

Exception : *"Premier Mécène"*. Quand tu deviens le mécène principal d'un lieu, on continue de te le dire — tu peux ne pas avoir vu que ta dernière mise faisait basculer le score.

---

# ALPHA V0.8.5
## Plus de fausse pastille rouge sur Activité

La pastille rouge sur l'onglet **Activité** ne te compte plus tes propres actions. Tu plantes un drapeau, tu écris un récit, tu résous une énigme — pas de notification pour toi-même. Tu vois toujours tes actions dans le fil, mais sans le badge qui te disait "regarde, t'as 1 truc à voir".

---

# ALPHA V0.8.4
## La fenêtre des Titres respire mieux

Sur mobile, la fenêtre **Choisissez vos titres** prend désormais tout l'écran et respecte l'encoche iPhone (en haut comme en bas). Les descriptions des titres ne dépassent plus du bord — elles passent sous le nom du titre quand l'espace manque. Les barres de progression ("0 / 1000 Couronnes investies", "0 / 3 mécénats principaux"…) ont aussi gagné des libellés propres au lieu des noms techniques.

---

# ALPHA V0.8.3
## L'app devient plus humaine

Une grosse mise à jour qui touche à tout : le tutoriel, les notifications, l'arrivée dans l'app, les actions sur la carte. Le fil rouge — qu'on sente plus la communauté, et moins l'algorithme.

### 🎓 Un tuto qu'on a envie de lire
Refonte complète. Plein écran sur mobile, on swipe entre les pages avec le doigt, le contenu glisse au lieu de claquer. Et si tu l'as cliqué trop vite la première fois ou que tu veux le rejouer pour quelqu'un, il y a un bouton **🎓 Rejouer le tutoriel** dans ton menu profil. Disponible à tout moment.

### 👤 Des têtes partout, plus d'icônes génériques
Quand quelqu'un aime ton récit, prend un de tes lieux par mécénat, t'envoie un message d'expédition, ou lève le brouillard sur un lieu que tu connais — tu vois désormais **sa tête** au lieu d'un cœur ou d'une couronne. Dans les notifications, dans le feed Activités, dans les toasts en bas de la carte. La communauté prend un visage.

Les events systémiques (jalons, niveau, énigme du jour, récap hebdo) gardent leur icône — on a fait du tri pour que ça reste lisible.

### 🎬 La pub d'accueil bien placée
Elle s'ouvre maintenant dès l'ouverture de l'app, peu importe que tu atterrisses sur l'accueil, la carte, le chat ou l'activité. Une fois par session, et plus jamais par-dessus le tutoriel à la première visite. Croix de fermeture en haut à droite — ou clic sur le bouton du bas si elle te propose une découverte intéressante.

### 📜 Le logo qui parle
Tape sur le logo **Runes de Chêne** en haut de l'écran : ça ouvre cette page de nouveautés. Le numéro de version vit en mini, en haut à droite du logo. Plus besoin de chercher pour voir ce qui change.

### 📊 La jauge de découvertes prend la lumière
À l'emplacement où vivait le numéro de version (en bas à gauche de la carte) : la barre **X/Y lieux découverts**. L'info qui mérite la visibilité — qui te rappelle où tu en es de ton exploration.

### 🪙 L'écran s'allège
Plus de toast *"Vous avez récolté X Couronne sur Y"* à chaque coffre cliqué. L'animation du coffre qui pop + le compteur Couronnes en haut à droite suffisent largement.

### ⌨️ Le clavier Chat reste ouvert (iOS)
Petit fix qui change tout : tu envoies un message sur ton iPhone, le clavier reste là, tu enchaînes. Plus de re-tap forcé après chaque envoi.

### 🔄 Bandeau "Mise à jour disponible"
Quand une nouvelle version est en ligne, un petit bandeau te le signale en haut de la home — pour ne plus jamais rester bloqué sur un vieux bundle. Un clic, et tu es à jour.

---

Bonne route, voyageur. La carte t'attend. ⚜

---

# ALPHA V0.7.13
## Logo cliquable, jauge de découvertes mise en avant

### 📜 Le logo ouvre maintenant le changelog
Tape sur le logo "Runes de Chêne" en haut de l'écran : ça ouvre la note de version. Plus besoin de chercher le petit badge en bas — un geste naturel pour voir ce qui change.

### 🪪 Le numéro de version migre sur le logo
Mini badge en haut à droite du logo, discret. À sa place en bas à gauche : la jauge de progression "X/Y lieux découverts" — l'info utile qui mérite la visibilité.

### 📊 Jauge de découvertes plus lisible
Repositionnée à la place de l'ancien numéro de version, en bas à gauche de la carte. Couleur plus douce, format compact mais lisible.

---

# ALPHA V0.7.12
## La pub d'accueil refondue + des têtes partout

### 🎬 La pub d'accueil s'ouvre à l'ouverture de l'app, peu importe la page
Avant, la pub interstitielle n'apparaissait que quand tu arrivais sur la carte. Maintenant elle s'ouvre **dès l'ouverture de l'app**, peu importe que tu atterrisses sur l'accueil, la carte, le chat ou l'activité. Une seule fois par session — relance ou F5 pour la revoir.

### ✕ Croix de fermeture en haut, plus de "Entrer sur la carte"
Le bouton du haut a été remplacé par une simple croix discrète. Plus universel maintenant que la pub peut s'afficher avant n'importe quelle page.

### 🎨 Fond opaque immédiat pendant le chargement
Avant, on voyait brièvement la page derrière avant que la pub apparaisse. Maintenant un fond crème opaque cache tout dès le mount, puis la pub fait son fade-in propre.

### 👤 Têtes des joueurs dans les notifs, le feed et les toasts
Quand quelqu'un fait une action perso (like, mécène, carnet, attaque, message d'expé, levée de brouillard…), tu vois maintenant **sa tête** au lieu d'une icône générique. Pareil dans le feed Activités sur la home et dans les toasts en bas de la carte. Les events systémiques (jalons, niveau, énigme du jour, récap hebdo) gardent leur icône — parcimonie.

### 🪙 Plus de toast quand on récolte une Couronne
L'animation du coffre + le compteur Couronnes en haut à droite suffisent comme feedback. Le toast "Vous avez récolté X Couronne" n'apparaît plus, ça désencombre la map.

---

# ALPHA V0.7.11
## Le clavier reste ouvert dans le Chat

### ⌨️ Tu peux enchaîner les messages sans re-tap
Sur mobile, après avoir envoyé un message, le clavier se fermait et tu devais re-cliquer sur le champ pour continuer à écrire. Bug corrigé : le focus reste sur l'input, le clavier reste ouvert, tu peux enchaîner direct.

---

# ALPHA V0.7.10
## Tutoriel refondu — plein écran, swipe et "rejouer"

### 📚 Le tutoriel passe en plein écran sur mobile
Fini la petite carte qui flottait au milieu et qui passait sous la barre du téléphone ou sous la navbar. Le tutoriel occupe désormais tout l'écran, contenu centré, bouton "Suivant" toujours visible en bas.

### 👆 Tu peux maintenant swiper entre les pages
Glisse le doigt à gauche pour passer à la page suivante, à droite pour revenir en arrière. Le bouton "Suivant" reste là si tu préfères taper.

### ✨ Animation de glissement
Quand tu changes de page, le contenu glisse au lieu de claquer. Petit détail, gros effet sur le ressenti.

### 🎓 "Rejouer le tutoriel" dans le menu profil
Nouvelle option dans le menu profil (clic sur ton avatar) : **🎓 Rejouer le tutoriel**. Pour les nouveaux qui ont cliqué trop vite, ou pour réviser les bases.

### 🐛 Plus de pub par-dessus le tuto à la première visite
Bug agaçant fixé : au tout premier lancement, la pub d'accueil ne s'affiche plus par-dessus le tutoriel et l'écran "Créez votre Aventurier". Elle attend que tu aies fini d'arriver.

---

# ALPHA V0.7.9
## La Coupe des Héritages s'affiche sur la home

### 🏆 Une nouvelle section sur l'accueil
Au-dessus de l'activité, tu vois maintenant le podium de la saison en cours : les quatre Maisons côte à côte, hauteur des marches proportionnelle à leur score, couronne 👑 sur celle qui mène la course. Ton emblème est cerclé d'or pour que tu retrouves ta Maison d'un coup d'œil. Le 1er à droite, la silhouette monte vers lui — la course se lit en un instant.

Touche une marche pour voir le classement de cette Maison, ou le titre de la section pour le tableau complet.

### ⚜ Pas encore de Maison ? Choisis par cœur
Si tu n'as pas encore prêté allégeance, la section te présente les quatre héritages avec leur emblème et leur nom — **sans révéler le classement**. Tu choisis par cœur, pas par calcul.

### 📱 iOS — la page d'une Maison ne passe plus sous l'heure
Quand tu cliques sur une Maison depuis la carte ou la home, son titre ne se cache plus derrière la barre de l'iPhone. Marge de sécurité corrigée pour respecter le notch.

### 🪶 Polissages de la home
Bordures retirées entre les sections pour un rendu plus respirant. La stats bar (Niveau / Coupe / Couronnes / Énergie) et la top bar (logo, boutique, notifs, avatar) sont alignées sur le même padding que le reste de la page. Tout coule mieux à l'œil.

---

# ALPHA V0.7.8
## Une vraie page d'accueil sur mobile

### 🏠 Mobile — l'app a maintenant un hub
Sur mobile, l'app ne s'ouvre plus directement sur la carte. Tu arrives sur **/accueil** : tes énigmes du jour en haut, tes événements et expéditions ensuite, tes lieux récents, et la vie de la communauté en bas. Trois raisons de revenir, en un seul écran.

### 💬 Le Chat a sa propre page plein écran
Avant : un panel flottant en coin de carte. Maintenant : un onglet **Chat** dédié dans la navbar du bas. Trois canaux comme avant (général, faction, bugs) plus l'accès aux conversations d'expéditions. Plus de doublon avec la carte.

### 🔔 L'Activité a sa propre page aussi
Tout ce qui bouge sur la carte — qui devient mécène, qui lève le brouillard, qui rejoint la confrérie — accessible en un tap. Sur la home un teaser des 3 dernières lignes ; pour tout voir, tu cliques.

### 🗺️ Une navbar pour s'y retrouver
**Accueil · Chat · ➕ · Activité · Carte** — les 5 endroits où tu vas, toujours à portée de pouce. Le bouton + central ouvre le menu de création (expédition, lieu, etc.) comme avant.

### 🖥️ Sur PC, rien ne change
Tu arrives toujours directement sur la carte. La home et les pages plein écran sont uniquement mobile — sur grand écran la carte reste le centre de gravité.

---

# ALPHA V0.7.7
## Notifications push — les raisons de revenir

### 🔔 L'app peut maintenant te prévenir
À midi pile, ton énigme du jour t'attend. Un compagnon écrit dans ton expédition. Quelqu'un conteste un lieu que tu surveilles. Avant, il fallait ouvrir l'app pour le savoir. Maintenant, on peut te ping — tu décides quand revenir.

### 🌿 Six moments retenus en V1
- **Ton énigme du jour est prête** (12h30 pile, heure de Paris)
- **Message dans ton expédition** (un compagnon t'écrit)
- **Lieu contesté ou repris** (carte qui bouge sur ton territoire)
- **Tu approches d'un palier de niveau** (rappel doux quand tu es à 5 XP du suivant)
- **Récap hebdo des nouveaux lieux** (lundi matin, si la carte s'est étoffée)

Tout le reste reste **dans l'app** uniquement (cloche notifs comme avant). On n'inonde pas.

### 🛡️ On te demande au bon moment, pas à l'arrivée
Pas de prompt pénible au premier launch. La permission est demandée au moment où elle a du sens — quand tu termines ton énigme, quand tu crées une expédition. Tu peux refuser, on n'insiste pas.

### 📱 iPhone : ajouter à l'écran d'accueil
iOS exige que l'app soit **ajoutée à l'écran d'accueil** pour recevoir des notifications. Si tu ouvres RdC dans Safari sans l'avoir ajoutée, on te montre comment faire (4 étapes). Ensuite tout marche normalement.

### ⚙️ Tu pilotes
Dans ton menu profil → **Notifications** : un toggle maître + deux catégories (Importantes / Récap). Tu peux couper les rappels doux et garder les vrais signaux. Ou désactiver tout.

---

# ALPHA V0.7.6
## Couronnes — l'économie qui respecte tous les voyageurs

### 🌅 Les coffres apparaissent au fil de la journée
Plus de cap silencieux à 15 coffres par jour. Maintenant chaque lieu veillé tente sa chance indépendamment, et les coffres apparaissent **progressivement entre 6h et 20h** — un petit matin tranquille, plus dense en fin d'après-midi. Tu n'as plus besoin de spammer la carte au lever du soleil pour ne rien rater.

### 🗺️ Découvrir un lieu rapporte une Couronne
Que tu **découvres un nouveau lieu à distance** (en dépensant ton énergie) ou que tu **poses ta marque sur place** en passant à proximité, tu gagnes désormais **+1 Couronne**. Toute première rencontre avec un lieu compte.

### Pour les voyageurs sans lieu veillé
Avant, sans un seul plantage, tu ne touchais aucune Couronne en dehors des énigmes. Maintenant, **explorer = gagner**. La porte d'entrée est ouverte à tout le monde, qu'on soit bâtisseur ou nouveau venu.

### 🎯 Quêtes en cours — les missions du jour s'invitent dans le HUD
Le panneau gauche s'étoffe : ta liste d'événements gagne un voisin du dessus, **les quêtes en cours**. La première quête du jour est en place — **Découvre 3 lieux à distance** (récompense +1 🪙) — avec une pilule « Du jour » pour la distinguer des événements.

Tu vois ton avancement (`1/3`, `2/3`, `✓`) sans rien ouvrir. Click sur la card → modale détaillée plein écran avec barre de progression, récompense, et heure de complétion une fois accomplie. Architecture pensée pour accueillir d'autres quêtes plus tard (énigme du jour, lieu à visiter…).

### 🎖️ Toasts énigme : la Couronne enfin créditée à l'écran
Quand tu résolvais une énigme, le toast disait `+3 Gloire / +1 Coupe` — la Couronne (gagnée pourtant depuis la V0.7 phase 5) était oubliée à l'affichage. Désormais : `🎖️ +3 / 🏆 +1 / 🪙 +1`, icônes inline, format cohérent avec la modale de résultat.

---

# ALPHA V0.7.5
## Affinage des Événements — plein écran mobile, navigation fluide

### 🎟️ « Expédition » devient « Événement »
Un événement, c'est un rendez-vous géolocalisé organisé par un voyageur — marche, festival, vernissage, fête de village. Le mot juste pour accueillir toutes les formes de rassemblement.

### 📱 Mobile : ergonomie revue
La modale d'événement passe en **plein écran** avec deux onglets — **Événement** et **Chat** — chacun sur la pleine page. La création d'un événement aussi : plein écran, par-dessus tout. Plus rien qui dépasse, tout est scrollable.

### 👤 Tous les noms sont cliquables
Dans une modale d'événement — chef, compagnons, demandeurs, auteurs de comptes rendus, et même les voyageurs dans le chat — chaque avatar et chaque nom ouvre maintenant son profil.

### 🕐 Dates contextuelles
Sur la card à gauche, on lit *« Dans 28 jours »* plutôt qu'une date abstraite. Plus parlant. Et dans le chat, chaque message porte son heure (« Hier 14:32 », « Aujourd'hui », etc.).

### 📍 Avatar du chef en fallback
Si tu n'as pas mis de photo à ton événement, c'est l'avatar du chef qui s'affiche dans le cadre — avec le drapeau rouge en signature.

### 🗺️ Profil joueur : carrousels affinés
Les 3 carrousels (cartographié / planté / visité) affichent désormais l'**icône du type de lieu** avant chaque nom. Sur PC, des flèches gauche/droite pour naviguer ; la scrollbar moche a disparu. Sur mobile, swipe naturel.

---

# ALPHA V0.7.4
## Les Expéditions — la carte devient un point de rendez-vous

### 🚩 Convoque tes compagnons
Crée une expédition depuis le bouton **+** de la carte : un nom, une date (ou *« à définir avec les compagnons »*), un point planté à la souris. Les autres voyageurs voient ta bannière et peuvent demander à te rejoindre — tu valides chaque demande, ou tu laisses l'inscription libre.

### 📍 Ta signature sur la carte
Choisis une image pour ton expédition, sinon ton avatar parle. Médaillon rond avec un drapeau rouge en signature. Plus la date approche, plus elle pulse — *Aujourd'hui*, elle s'illumine.

### 💬 Préparation à l'écart
Une fois validés, les compagnons accèdent à un **chat privé** pour s'organiser. Toujours sous les yeux à droite de la modale.

### ✨ L'appel
Sous le titre de l'expédition, une phrase qui dit pourquoi vous y allez. **Tous les compagnons peuvent la modifier** — l'appel s'écrit à plusieurs.

---

# ALPHA V0.7.3
## Affinage de La Cour — la marche garde toujours le dessus

### 🪙 Tap pour investir, plus de modale
Sur la fiche d'un lieu, **soutenir le veilleur** ou **influencer** se fait au tap direct : un clic = 1 Couronne dépensée, score qui monte en direct, son discret, animation de pièce qui s'envole. Tu peux marteler aussi vite que ta jauge le permet.

### 🏴 Lieux sans veilleur : 1 Couronne suffit pour t'établir
Les lieux que personne n'a foulés (Mongolie, ruines isolées) sont désormais accessibles à distance. Une seule Couronne pour y poser ta marque ; ensuite c'est la course au plus offrant. **Mais souvenez-vous** : la première personne qui se déplace IRL devient plein-veilleur avec un acquis de **+50** que personne ne peut effacer à distance.

### 🛡️ Réaffirmation IRL
Si quelqu'un investit contre ton lieu, tu peux **revenir physiquement** dessus : un nouveau plantage efface toutes les menaces en cours. La marche prime toujours sur l'or.

### 👑 Avatar du veilleur cliquable
Sur chaque fiche, l'avatar et le nom du veilleur ouvrent maintenant son profil. Idem pour les mécènes du Trône — ils ont leur icône de faction à côté de leur nom.

### 🔔 Notifications personnelles
Quand quelqu'un attaque un de tes lieux, perd ou prend un lieu auprès de toi, tu reçois maintenant une **notification persistante dans la cloche** — même si tu n'étais pas en ligne au moment de l'event. Plus rien ne se perd.

---

# ALPHA V0.7.2
## La Cour s'ouvre — l'or peut soutenir la marche

### 👑 Investis tes Couronnes pour soutenir un lieu, ou en briguer un
Sur la fiche de chaque lieu veillé, **La Cour** t'attend. Tu peux désormais investir tes Couronnes de Chêne pour :
- **Soutenir le veilleur en place** — renforcer sa faveur diplomatique
- **Mécèner un lieu** sans en être l'expédition — devenir Mécène Principal et porter ton nom au Trône
- **Défier l'expédition veilleuse** depuis la distance, et faire basculer le lieu à toi

Le veilleur démarre toujours avec une **faveur de 50** acquise au plantage. Pour le contester, il faut dépasser ce score (plus ce qu'il aura ajouté en défense). Et toujours, **la marche prime sur l'or** : un veilleur qui revient en personne efface tous les efforts adverses et reprend gratuitement son lieu.

### 📖 Les énigmes te rapportent désormais des Couronnes
Chaque énigme correctement résolue (du jour, d'un lieu ou d'un fragment) crédite ton trésor :
**+1, +1, +2 ou +3 Couronnes** selon la difficulté. Un mécène sans bagages peut ainsi se constituer une bourse au fil des jours.

### 🏛️ Le Trône des Mécènes
Sur chaque lieu, les 5 plus généreux mécènes sont nommés à vie. Le premier d'entre eux porte le titre **Mécène Principal de [Lieu]**. Quatre nouveaux titres généraux récompensent ton engagement : **Bourse Légère** (50 Couronnes), **Coffre d'Or** (200), **Trésorier** (1000), **Premier Mécène** (#1 sur 3 lieux ou plus).

---

# ALPHA V0.7.1
## La carte vit, la route s'éveille

### 🔒 Brouille tes pistes
Une option dans le menu profil te permet désormais de **brouiller ta position** auprès des autres voyageurs : ton avatar leur apparaît dans un rayon de **50 km** autour de toi, jamais à ta vraie position. Activé par défaut, parce que la confidentialité, ça doit être le réflexe. Toi, tu vois toujours ta vraie position GPS — le brouillage n'est que pour les autres.

### 📜 Le mot du moment
Sur ton profil, **laisse un mot** (200 caractères max) que tous les voyageurs voient sous ton avatar pendant **24 heures**. Un café au pied du chêne, un appel à se croiser, une trouvaille d'aujourd'hui. Les autres peuvent **réagir avec un emoji** — les compteurs s'empilent sous ta note. Au bout de 24h, tout disparaît, place blanche, repose ce que tu veux.

### 👋 Lance un emoji
Tape sur l'avatar d'un voyageur et **lance-lui un emoji** : il vole en arc à travers la carte, visible de tous ceux qui ont les deux silhouettes à l'écran. Pas de stockage, pas de notif — juste un signe instantané, façon Zenly. La banque emoji est curée pour Runes de Chêne (33 symboles : salutations, nature, marche, patrimoine, convivial, esprit, hommage). Le surclick est libre, pour les rafales. Si quelqu'un t'envoie trop d'emojis, **mute soft** depuis son profil — silencieux, sans humiliation.

### 🎯 Les Quêtes du jour
Un nouvel onglet **📜 Quêtes** dans la barre de navigation : 4 quêtes journalières fixes qui se valident automatiquement quand tu joues normalement.
- **🪙 Récolte la moisson d'au moins 2 lieux** — +3 XP
- **🌫️ Lève le brouillard sur 2 lieux** — +5 XP
- **🗝️ Tente l'énigme du jour** — +5 XP
- **👋 Lance un emoji ou réagis à une note** — +3 XP

**+16 XP par jour** si tu fais tout. Reset à minuit dans ta timezone. Pas de bouton "récolter", pas de friction — un toast 🎯 t'avertit dès qu'une quête se complète.

---

# ALPHA V0.7.0
## Niveaux, Vétérans, et un nouveau lexique

### Le système d'expérience prend forme
Tous les Veilleurs reprennent avec leurs accomplissements depuis le **1er mars**. Ceux qui étaient là avant gardent à vie le badge **Vétéran de la Première Époque**, gravé sur leur profil, et reçoivent un bonus réduit sur les lieux ajoutés avant cette date. À partir d'aujourd'hui, chaque pas compte vers votre prochain palier.

### Trois actions, trois mots
Le vocabulaire de l'app se précise. Trois gestes désormais clairement distincts :
- **🔍 Découvrir** : un lieu sort du brouillard quand vous dépensez vos points d'énergie pour le découvrir.
- **🥾 Fouler** : vous y posez le pied physiquement, GPS en main.
- **📜 Cartographier** : vous inscrivez un nouveau lieu dans la carte commune.

Plus de confusion entre "découvrir à distance" et "y aller pour de vrai". Chaque action a son verbe, son toast, son poids.

### Niveaux et titres refondus
**33 titres généraux** sur 7 axes — Niveau, Découvertes, Marche, Érudition, Bannière, Cartographie, Carnets. Tous **acquis à vie** : plus aucun titre "perdu" en se faisant doubler. Vos paliers, vous les gardez.

Quelques jalons à viser :
- **Niveau 3** : vous débloquez la cartographie (l'ajout de lieux).
- **Niveau 25** : vous portez le titre de Héros local.
- **Niveau 35** : Héros régional.
- **Niveau 50** : Légende. Le sommet est mythique — atteignable, mais peu y arriveront.

### Gloire vivante, niveau acquis
La **Gloire** que vous récoltez à chaque action est désormais l'expérience qui vous fait monter de niveau. Sur votre profil, une barre indique votre progression vers le palier suivant. Le niveau, lui, ne redescend jamais une fois acquis (sauf si un de vos contenus est supprimé — symétrie naturelle).

### Boost vétéran
Si vous aviez déjà cartographié des lieux avant le 1er mars, un **bonus rétroactif** vient s'ajouter à votre niveau de départ. Pas autant qu'un effort GPS récent, mais assez pour reconnaître votre apport au patrimoine commun.

# ALPHA V0.6.2
## Le fil d'actualité fait peau neuve

### Toasts épurés, lisibles, à jour
Les notifications qui défilent sur la carte parlent désormais le langage du nouveau jeu. Les anciennes mentions d'érudition, d'influence, de fortification — vestiges du système gelé — disparaissent. Vous voyez désormais en temps réel :
- **🚩 Étendard planté** : *"X a planté son étendard sur Y"*. Quand c'est vous : *"+5 Gloire +5 Coupe"* en clair.
- **📖 Énigme résolue** : *"X a résolu une énigme"*. Pour vous : *"+1 à +3 Gloire +1 à +3 Coupe +1 énigme validée"* selon la difficulté.
- **🧭 Lieu découvert** : *"X a découvert Y"*. Pour vous : *"+1 Gloire +1 Coupe"*.
- **🪙 Couronne récoltée** : *"Vous avez récolté X Couronne(s) sur Y"* — visible uniquement pour vous, votre moisson n'est pas un événement public.
- **🏛️ Lieu ajouté** : *"X a ajouté Y"*. Pour vous : *"+7 Gloire +7 Coupe"*.
- **📜 Récit / photo** : *"X a ajouté un récit sur Y"*. Pour vous : *"+3 Gloire +3 Coupe"* (ou *"+1 +1"* pour une photo).
- **🔄 Retour sur un lieu** : *"X est de retour sur Y"* — sobre, sans gain affiché (la marche première a déjà été récompensée).
- **❤️ Like, 👤 nouveau joueur** : inchangés.

Plus de **claim**, de **fortify**, de **place_influence** dans le fil. Si vous y veniez chercher un repère du nombre de points dépensés sur un lieu, c'est désormais la **Coupe des Héritages** qui raconte cette histoire — saisonnière, claire, comparable.

# ALPHA V0.6.1
## Récompenses lisibles — chaque action montre son gain réel

### Énigmes — la difficulté paye enfin
Les énigmes valident désormais une **récompense pondérée** selon leur difficulté : +1 pour les facile et très facile, +2 pour les moyennes, +3 pour les difficiles. Sur la Gloire **et** sur la Coupe. Quand vous résolvez une énigme dure, vous gagnez trois fois plus qu'une facile — votre effort cesse d'être invisible. *Le compteur d'énigmes validées sur votre profil reste, lui, à une par énigme : il raconte le volume, pas l'effort.*

### Récompenses — fini l'érudition et l'influence fantômes
Partout où l'application annonçait des gains — visite d'un lieu, ajout d'un récit, énigme résolue, lieu ajouté — elle parlait encore en *points d'érudition* et *points d'exploration*, hérités de l'ancien système. Désormais chaque récompense affiche **+X Gloire** et **+X Coupe** très exactement, en cohérence avec les compteurs visibles dans la barre du haut et sur le profil.

### Visite GPS d'un lieu nouveau
Quand vous validez une visite GPS sur un lieu où vous n'étiez encore jamais venu : **+1 Gloire, +1 Coupe**. Quand vous y revenez, plus de gain — la marche première compte, les retours sont des retrouvailles.

### Carnet écrit, lieu ajouté
Un récit écrit pour la première fois sur un lieu : **+3 Gloire, +3 Coupe**. Un lieu ajouté à la carte : **+7 Gloire, +7 Coupe** (et la visite GPS implicite vient s'y ajouter, et le carnet si vous l'écrivez dans la foulée). Le geste complet du créateur sur place reste la plus grande mise commune que vous puissiez faire pour votre Héritage.

# ALPHA V0.6.0
## Le grand basculement — Veille, Couronnes, Coupe des Héritages

### Plantez votre étendard sur les lieux que vous foulez
Sur chaque lieu où vous vous tenez physiquement, un nouveau geste : **planter votre étendard**. Vous devenez le **veilleur** de ce lieu — votre nom s'inscrit dessus pour tous, en signature manuscrite sur la carte. Pour le supplanter, un autre veilleur devra fouler le même sol. Un seul lieu, un seul veilleur (ou une expédition de plusieurs, si vous avez planté ensemble). Le veilleur n'est plus une faction abstraite : c'est une personne, vous.

### Couronnes de Chêne — la moisson quotidienne des veilleurs
Tant que vous veillez un lieu, il vous récompense. Toutes les vingt-quatre heures, un **coffre** apparaît sur votre lieu veillé — cliquez, une **Couronne** s'élève, votre stock grossit. Une Couronne pour le veilleur solitaire, deux pour ceux qui ont planté en expédition. Stock plafonné à cinq cents — au-delà, on vous demandera bientôt de les dépenser.

### La Coupe des Héritages — saison ouverte
Les Héritages s'affrontent désormais dans une **compétition saine et saisonnière**. Chaque action personnelle — visite GPS, énigme résolue, photo, carnet, plantage, lieu ajouté — ajoute des points à votre score. Ces points cumulés par tous les membres d'un Héritage déterminent qui remportera la **Coupe**. À chaque saison, tout repart à zéro. La domination se gagne, elle ne se garde pas.

### Le titre de votre Héritage se mérite chaque saison
Désormais, le titre que vous portez au sein de votre Héritage — Basileus, Prélat, Citoyen, et leurs équivalents — n'est plus une distinction figée. Il est attribué à chaque instant en fonction de votre **rang dans la Coupe en cours**. Le plus actif de la saison porte le plus haut titre. La saison suivante, à chacun de prouver à nouveau son ardeur.

### La Gloire repensée — claire, juste, vivante
Vos points d'exploration et d'érudition disparaissent — ils étaient opaques. À leur place : **votre Gloire à vie**, calculée à partir de toutes vos actions de jeu. Chaque visite, chaque énigme résolue, chaque carnet, chaque plantage, chaque lieu ajouté pèse — et le détail s'affiche quand vous cliquez sur votre médaille. Vous voyez exactement d'où vient votre prestige.

### Influence — le système entre en sommeil
Le système d'influence — placer ses points sur les bannières d'un lieu — est mis en sommeil. Il ne servait plus la promesse du jeu : *celui qui foule la terre en est le veilleur*. Vos points placés ne disparaissent pas, ils attendent. Une refonte pour les **lieux lointains** que vous ne pourrez jamais atteindre physiquement (Mongolie, Pétra, montagnes du Caucase) viendra sous la forme d'un nouveau levier — investir vos Couronnes pour faire tomber un lieu inaccessible entre les mains de votre Héritage.

### Sur la carte
Le **scoreboard des Héritages** passe en jauges verticales schématiques, lecture immédiate des forces en présence. Les noms des veilleurs sur les lieux retrouvent une **typographie de signature**, plus calme, plus parchemin. Les modales (Coupe, classement, faction) se réorganisent autour des nouveaux compteurs.

### Sur le profil
Sous votre nom, **lieux explorés** et **énigmes résolues** au lieu des chiffres ambigus d'autrefois. Un nouvel onglet **Veillés** liste vos lieux veillés en temps réel (et remplace l'onglet Influencés, devenu sans usage). Les **Fragments possédés** se montrent plus sobrement, sans les billes d'affinité.

### Corrections
- Le compteur de photos ne sous-comptait plus que les contributions explicites — désormais il inclut les photos initiales d'un lieu créé.
- Plus jamais deux personnes ne se partagent un titre faction : un seul rang, un seul titre.
- Les visites GPS et les lieux explorés sont maintenant alignés sur la même source — fini le décalage de comptage.

# ALPHA V0.5.14
## Le profil s'épaissit

### Trois titres au lieu d'un
Sur votre profil **et sur la carte**, vous pouvez désormais afficher jusqu'à **trois titres** au lieu d'un seul. Empilez-les sous votre nom pour raconter qui vous êtes — votre rang dans l'Héritage, votre titre de bâtisseur, le titre lié à votre fragment.

### Lieux Influencés — la trace de votre attachement
L'onglet **Veillés** disparaît. À sa place : **Influencés**, qui rassemble les lieux où vous avez le plus dépensé d'influence, ordonnés par engagement. Une ligne par lieu, la photo à gauche, le total de points en chiffres clairs à droite, et la date du dernier geste. Vos sanctuaires, vos forteresses préférées, vos forêts d'élection se rangent désormais d'eux-mêmes.

### Visités — chaque lieu a son histoire
L'onglet **Visités** prend le même format. Pour chaque lieu : photo, nombre de fois où vous y êtes passé, date de la dernière exploration. Les pèlerinages se voient.

### Corrections
- Les pseudos Instagram avec un *underscore* ne s'écrivent plus en travers — l'autocorrect mobile ne déforme plus la saisie.

# ALPHA V0.5.13
## Le retour des sceaux

### Coupe des Héritages — la carte des stratèges
Quand vous activez le mode **Coupe des Héritages**, la carte vire au parchemin, les lieux passent à l'encre brune, et les **sceaux des Héritages** réapparaissent au centre de chaque territoire — un par faction dominante. Chaque lieu reçoit aussi une fine bordure aux couleurs de l'Héritage qui le contrôle : un coup d'œil suffit pour lire l'allégeance.

### Territoires — la sève monte plus vite
Le rayon d'influence d'un lieu grandit désormais beaucoup plus généreusement avec ses points. Quelques points d'influence suffisent à voir un territoire prendre forme, là où il fallait une longue patience auparavant. Les empires se bâtissent à la vitesse qu'ils méritent.

### Corrections
- L'icône Boutique disparaissait par intermittence selon les builds — cache PWA recalibré.

# ALPHA V0.5.12
## Le souffle de la Grèce

### 32 nouvelles énigmes — la Grèce antique
Hoplites en phalange, philosophes condamnés, oracles murmurés sous le Parnasse, tablettes de malédiction enterrées dans le plomb, cuirasses de lin et trières en bronze : trente-deux questions sur la Grèce antique entrent dans le cycle des énigmes journalières. Approche **historique et occulte**, peu mythologique — Sparte et Athènes, Marathon et Leuctres, Hécate et les Mystères d'Éleusis, Héraclite et Pline l'Ancien.

C'est la première fois que des énigmes ne sont rattachées à **aucune faction** — elles tombent pour tous les joueurs, peu importe l'héritage choisi.

*Si certains noms vous parlent particulièrement — l'Hoplite, Hécate — vous comprendrez pourquoi le 12 mai, à Écho & Merveilles.*

### Plus de répétitions sur les énigmes journalières
Si vous avez déjà répondu à une énigme dans le passé, vous ne la reverrez plus tant qu'il reste du contenu neuf à découvrir dans la difficulté correspondante. Quand vous aurez tout vu, le pool recyclera proprement. Les anciens beta-testeurs qui rebouclaient sur les mêmes questions vont enfin redécouvrir des énigmes oubliées.

### Énigmes existantes — fond et orthographe
Passe complète sur les énigmes du jeu : quelques erreurs factuelles corrigées, formulations ambiguës resserrées, et une vingtaine de fautes d'orthographe nettoyées.

# ALPHA V0.5.11
## Vos réponses comptent

### Énigmes — validation indulgente
Les énigmes à réponse libre acceptent désormais les variantes raisonnables :
- Accents oubliés (*pompei* pour *Pompéi*)
- Pluriels (*louves* pour *Louve*)
- Articles ajoutés ou retirés (*le Bosphore* pour *Bosphore*)
- Apostrophes, tirets, underscores
- Petites typos sur les mots longs (*hippocrte* pour *Hippocrate*)

Plus besoin d'écrire au caractère près. Si vous savez la réponse, l'app la reconnaît.

# ALPHA V0.5.10
## Corrections & Équilibrage

### Récompenses de visite GPS
- Le flow de récompenses (gains, notation, proposition de récit) s'affiche correctement après une exploration ou ré-exploration GPS
- Les gains d'influence et d'exploration sont mis à jour en temps réel dans l'interface après une revisit
- Équilibrage : première exploration GPS donne **+15 stock d'influence** et **+10 exploration** (au lieu de +20/+20)

### Notifications
- Les notifications se marquent comme lues de manière persistante (le badge rouge ne revient plus au rechargement)

# ALPHA V0.5.9
## Le Livre d'Or

### Le rating mène au carnet
Après avoir noté un lieu en étoiles, une invitation vous propose de laisser une page de carnet. Les étoiles que vous avez données s'affichent sur votre carte de récit — un contexte émotionnel pour ceux qui vous lisent.

### Éditez vos récits et renommez les lieux
Modifiez votre page de carnet à tout moment — texte, titre, photos. Supprimez-la si vous changez d'avis. Et si vous avez écrit un récit sur un lieu, vous pouvez aussi en changer le nom.

### Corrections
- Le panneau de notifications passe désormais au-dessus de tous les contrôles de la carte
- Le badge de notifications non-lues disparaît immédiatement à l'ouverture
- Le countdown du coffre d'énigmes est masqué sur mobile (visible dans la modal)
- La modal de carnet prend tout l'espace du panneau de lieu

# ALPHA V0.5.8
## Calendriers du monde ancien

### 6 référentiels calendaires
Choisissez comment le temps s'affiche dans votre application. En plus du Grégorien, de la Fondation de Rome (AUC) et de la Chute de Constantinople, trois nouveaux référentiels :
- **Calendrier impérial** — dates en mois républicains (Vendémiaire, Brumaire, Germinal...) avec le suffixe impérial
- **Calendrier de Coligny** — le calendrier luni-solaire gaulois reconstitué, avec les 12 mois celtiques (Samonios, Dumannios, Giamonios...) calculés sur de vraies lunaisons
- **Ère olympique** — comptez les années depuis les premiers Jeux de 776 av. J.-C.

### La date vit sur la carte
La date du jour dans votre référentiel choisi s'affiche en permanence sur la carte — sous l'avatar en desktop, sous la barre d'énergie sur mobile. Changez de calendrier dans le menu profil, l'affichage se met à jour instantanément.

# ALPHA V0.5.7

- Visiter un lieu GPS donne du **stock à placer** (plus d'influence permanente sur les visites)
- Re-visites avec rendements décroissants : 10, 5, 3, puis 2 minimum
- Notation par étoiles après chaque visite GPS
- Titre optionnel sur les pages de carnet
- Fix installation PWA sur Samsung Internet
- Énigmes de lieu masquées (en cours de développement)

# ALPHA V0.5.6
## Le Terrain Récompense

### 3 énigmes par jour
Chaque jour, trois défis vous attendent : **Facile**, **Intermédiaire** et **Avancé**. Résolvez-les pour gagner des points d'influence à placer sur les bannières. Plus de 300 questions sur les quatre Héritages — on apprend en jouant.

### Le terrain, c'est tout
Visiter un lieu en GPS donne de **l'influence permanente** — elle ne disparaît jamais. Créer un lieu sur place, c'est encore mieux. Les bannières cliquées à distance, elles, s'érodent avec le temps. **Le vrai pouvoir appartient à ceux qui marchent.**

### Votre carnet d'explorateur
Quand vous ajoutez un lieu, vous écrivez votre **première note d'explorateur** — titre, texte, photos — dans un cadre dédié. Chaque récit donne de l'influence permanente au lieu. Les récits les plus aimés rapportent encore plus.

### Notez les lieux que vous visitez
Après chaque visite GPS, donnez votre avis en **5 étoiles**. Rapide, simple, et la note moyenne apparaît en haut de chaque fiche.

### Fragments — portée d'influence
Vos Fragments augmentent votre **limite d'influence à distance** sur les lieux correspondants. Visible sur votre profil avec les icônes des types de lieu associés.

### Plus clair, plus propre
- Les récompenses s'affichent après chaque action (création, visite, énigme)
- Les notifications montrent qui fait quoi, en couleurs
- Le bouton "De retour" n'apparaît qu'après 24h
- Les anciens systèmes ont été retirés. Il ne reste que l'essentiel.

# ALPHA V0.5.5
## NOM DE CODE : PYTHEAS

*Quelque chose a changé dans le vent. La carte a écouté.*

Fidèle à sa réputation, Runes de Chêne s'oriente grâce à vous sur l'explorateur & l'érudition, transformant la conquête aggressive en un lieu d'aventure, d'influence, de stratégie et de découverte. Enigmes, Influences partagées, traitrises ou soutiens, jamais la Carte ne fut si proche de sa vision qui stimule l'âme, l'esprit et le corps.

### 3 énigmes par jour
Chaque jour, trois défis vous attendent : **Facile**, **Intermédiaire** et **Avancé**. Résolvez-les pour gagner des points d'influence à placer sur les bannières. Plus de 300 questions sur les quatre Héritages — on apprend en jouant.

### Le terrain, c'est tout
Visiter un lieu en GPS donne de **l'influence permanente** — elle ne disparaît jamais. Créer un lieu sur place, c'est encore mieux. Les bannières cliquées à distance, elles, s'érodent avec le temps. **Le vrai pouvoir appartient à ceux qui marchent.**

### Votre carnet d'explorateur
Quand vous ajoutez un lieu, vous écrivez votre **première note d'explorateur** — titre, texte, photos — dans un cadre dédié. Chaque récit donne de l'influence permanente au lieu. Les récits les plus aimés rapportent encore plus.

### Notez les lieux que vous visitez
Après chaque visite GPS, donnez votre avis en **5 étoiles**. Rapide, simple, et la note moyenne apparaît en haut de chaque fiche.

### Fragments — portée d'influence
Vos Fragments augmentent votre **limite d'influence à distance** sur les lieux correspondants. Visible sur votre profil avec les icônes des types de lieu associés.

### Plus clair, plus propre
- Les récompenses s'affichent après chaque action (création, visite, énigme)
- Les notifications montrent qui fait quoi, en couleurs
- Le bouton "De retour" n'apparaît qu'après 24h
- Les anciens systèmes ont été retirés. Il ne reste que l'essentiel.

# ALPHA V0.5.2
## Influence, Carnets et Equilibre

### Influence perenne par les likes
- Les points perennes sur un lieu dependent du **classement des carnets par likes** : 1er = 20pts, 2e = 10pts, 3e = 5pts, 4e+ = 2pts.
- Plus de "+X texte, +X photo" — c'est la communaute qui decide quel recit merite de l'influence.
- Badge "Recit le plus aime" sur le carnet en tete.
- Recalcul automatique apres chaque vote.

### Visite GPS
- Explorer un lieu sur place rapporte **20 pts d'exploration** (au lieu de 2).
- Plus de content_points perennes a la visite — reserves aux carnets/photos.

### Coffre a enigmes
- Le coffre affiche clairement son etat : gratuit (etoile), bonus (cout en energie), ou grise avec X/Y energie si insuffisant.

### Fiche de lieu
- Cliquer sur un indicateur (accessibilite, saison, info) scrolle automatiquement vers l'onglet Infos.
- Confirmation amicale avant de soutenir un Heritage rival ("Un agent double, c'est interessant").

### Profil joueur
- Gloire detaillee : "15 Gloire (10 exploration + 5 erudition)".
- Influence a placer + influence placee visibles.
- Badge d'influence dans la barre de ressources.

### Titres
- Les titres utilisent la nouvelle Gloire (exploration + erudition), plus l'ancienne notoriete.
- Gloire a 0 = aucun titre debloque.
- Les titres de faction sont classes par Gloire.

### Hub
- Nouveaux reglages : bonus GPS exploration, cooldown Heritage.

# ALPHA V0.5.1
## Gloire, Equilibre et Coupe des Heritages

### Coupe des Heritages
- Nouveau switch **Coupe des Heritages** : colorez les lieux selon l'Heritage dominant.
- Mode OFF : lieux en couleur normale, territoires visibles.
- Mode ON : les billes prennent la couleur de la faction qui influence le plus. Lieux neutres en gris.
- Le scoreboard faction ne compte que l'**influence active** (placement, pas contenu permanent).

### Gloire V0.5
- **Gloire = Exploration + Erudition.** Les classements et profils utilisent ce calcul.
- L'ancienne notoriete ne s'accumule plus.
- Exploration proportionnelle : vous gagnez autant de points que le cout en energie de la decouverte.
- Bonus GPS : +10 pts d'exploration quand vous etes sur place.
- Mauvaise reponse a une enigme = 0 erudition. Seules les bonnes reponses comptent.

### Heritage
- Changer d'Heritage ne coute plus de Gloire. Cooldown de **30 jours** a la place.
- Toutes les infos d'Heritage sont toujours visibles (plus de mode exploration qui masque).

### Hub
- Nouveaux reglages : bonus GPS exploration, cooldown Heritage.

# ALPHA V0.5.0
## L'Ère de l'Influence
Fini les conquêtes. Désormais, chaque lieu est un terrain d'influence où les Héritages s'affrontent.

### Nouveau système d'influence
- **Cliquez sur les bannières.** Un clic = un point d'influence pour l'Héritage de votre choix. Son, étoiles, satisfaction.
- **Soutenez qui vous voulez.** Alliances, trahisons, stratégie : à vous de jouer.
- **5 clics/jour par lieu à distance**, illimité sur place.
- **Coupe des Héritages.** Le classement reflète l'influence totale de chaque faction.

### Fiches de lieu repensées
- Modal centrée avec overlay et bannière de l'Héritage dominant.
- **Carnets collaboratifs** : écrivez, ajoutez des photos, likez ❤️ les récits.
- **Galerie photo** avec lightbox plein écran et navigation.
- Avatars des explorateurs avec badges ⭐ Découvreur et 🛡 Gardien.

### Énigmes bonus
- L'énigme du jour reste **gratuite**.
- Enchaînez les énigmes pour **5⚡** chacune.
- Coffre au trésor animé, héritage affiché sur chaque question.

### Exploration GPS
- Rendez-vous sur un lieu pour devenir **Explorateur** et gagner 50 points d'influence.
- Créer un lieu rapporte **80 points**.

# ALPHA V0.4.7
Fix des inscriptions et tchat

# ALPHA V0.4.6
Fix des inscriptions et tchat

# ALPHA V0.4.5
## Gloire dynamique & Compétences
- **La Gloire récompense le courage.** Plus une action coûte d'énergie, plus elle rapporte de Gloire. Prendre un lieu lointain et fortifié rapporte bien plus qu'un lieu facile.
- **Projection de Gloire.** Avant de veiller sur un lieu, vous voyez combien de Gloire vous allez gagner.
- **Profil simplifié.** "Protections menées" retiré (donnée peu fiable). Terminologie harmonisée : "Veillés" partout.

# ALPHA V0.4.4
## Calcul de coût unifié & Performance
- **Un seul calcul de coût.** Le serveur est maintenant l'unique source de vérité — le coût affiché correspond toujours exactement à ce qui est déduit.
- **Performance.** Les lieux dans les grands territoires s'ouvrent instantanément (suppression du calcul de blob O(n³)).
- **Énergie décimale.** L'indicateur affiche toujours la virgule (4.0/9.0 au lieu de 4/9).
- **RLS Tags.** Les admins peuvent créer/modifier/supprimer des tags depuis le Hub.
- **Récompenses par tag retirées** du Hub (jamais utilisées, anciennes jauges).

# ALPHA V0.4.3.1
## Fix des lieux qui chargeaient longtemps avant de s'ouvrir

# ALPHA V0.4.3
## Fix des énergies.


# ALPHA V0.4.2
## Renforcement de l'ajout de lieu
- La Charte des Explorateurs recentre le thème de l'application
- La description devient obligatoire
- Un embryon de modération est mis en place pour supprimer les lieux hors-sujets
- Les défenses lointaines des voisins sont baissées, pour égaliser le nouveau système d'énergie.


# ALPHA V0.4.1
## L'Érudition Conquérante — fix énergie lointaines
Fix d'affichage. La 0.4 reste la grosse nouveauté (lire en dessous si besoin)

# ALPHA V0.4.0
## L'Érudition Conquérante — Nouveau chapitre
L'application évolue ! On ne conquiert plus par la force, on veille sur le patrimoine avec sagesse.

### Ce qui change
- **Les Factions deviennent des Héritages.** Vous ne rejoignez plus une armée — vous vous placez sous un Héritage culturel qui vous ressemble. Les Compagnons de Lug, les Explorateurs de Midgard, les Légions de Rome, les Veilleurs du Bosphore.
- **On ne "conquiert" plus, on "veille".** Vos lieux sont désormais "veillés par" vous, pas "conquis". Votre avatar apparaît sur vos lieux protégés.
- **Une seule ressource : l'Énergie ⚡** Finis les 3 jauges compliquées. L'énergie sert à tout : découvrir, veiller, fortifier.
- **La distance compte.** Plus un lieu est loin de vous, plus il coûte d'énergie. Vous êtes le gardien naturel de votre région. Déplacez-vous pour payer moins !
- **La Notoriété devient la Gloire.** Chaque action vous rapporte de la Gloire. Découvrir un lieu, veiller, fortifier, tout compte.
- **Le chat Faction devient le Dortoir.** Un lieu de vie pour discuter avec les membres de votre Héritage.

### Pourquoi ces changements ?
On veut que Runes de Chêne soit un jeu de **découverte et de camaraderie**, pas de guerre. La compétition reste — les Héritages rivalisent pour la Gloire — mais dans un esprit de défi amical. Comme les Maisons de Poudlard, pas comme des armées.

Bonne exploration, et prenez soin du patrimoine ! 🏛️

# ALPHA V0.3.6
## Nettoyage & Améliorations
- Introduction d'un écran de chargement avec astuce & publicité interne
- Progression des titres : voyez votre avancement vers chaque titre (12/50 conquêtes, etc.)
- Profil : nouveaux compteurs "tenus" et "conquêtes menées" pour plus de clarté.
- Noms de territoire : les votes d'anciens joueurs d'une autre faction ne comptent plus.
- Les joueurs en ligne affichent correctement leur nom et faction sur la carte.
- Nombreuses corrections de bugs et optimisation du code.

# ALPHA V0.3.5
## Des titres & des Fragments !
- Les Fragments d'Histoire achetés sur la boutique (Stand ou en ligne) débloquent désormais des titres et des bonus.
- Système de titres v3 : sélectionnez jusqu'à 3 badges, le premier s'affiche sur la carte.
- Les Fragments offrent des avantages dans le jeu.
- Écran de chargement interstitiel avec images et astuces depuis le Hub.

# ALPHA V0.3.4
## Survivez & frimez !
- BAROUD D'HONNEUR : la Faction la plus faible se battra avec les dieux à ses côtés. Regen X2 pour eux.
- Affichage des titres sur la cartes. Activez les depuis votre profil.

# ALPHA V0.3.3
## Fortifiez, ça rend heureux ! 
- Les fortifications augmentent désormais la zone d'expansion du lieu. ⚒️
- Les noms de territoires (zone de + 3 lieux connectés) sont limités à 2 par joueurs, et peuvent être supprimées.
- Correctif : les Territoires n'ont plus "Nom incertain" lorsqu'un nom a été voté par les joueurs.
- Correctif : La prise d'un lieu est effectif en temps réel sur la carte et la zone d'influence recalculée
- Correctif : les profils affichent désormais tous les lieux, pas juste 50.

# ALPHA V0.3.2
## Avatars, performances carte, auto-claim
- Performances carte en mode conquête : plus de lag au scroll/zoom
- Nouveaux visuels : étendards faction, badges fortification bannière, noms de territoire en Bebas Neue avec fade au zoom
- Taux horaire (+X/h) affiché au-dessus des emblèmes de faction
- Correction avatars : tous les profils affichent maintenant leur photo (harmonisation avatar_url)
- Correction de bug des avatars.
- Noms des joueurs colorés par faction dans les notifications toast
- Auto-claim : un lieu créé est automatiquement revendiqué pour la faction du joueur (gratuit)

# ALPHA V0.3.1
## Nommage de zone démocratie + corrections de bug
- Tout une faction peut voter pour nommer un territoire de + de 3 lieux.
- Corrections de bug mineurs sur mobile.
- Correction de regen sur les ressources


# ALPHA V0.3.0
## La Conquête s'affirme
- Les territoires fusionnés se fortifient entre eux
- Les notifications sont plus claires
- La versin mobile fonctionne et peut être installée sur un téléphone en PWA dynamique
- Optimisation globale de la map

# ALPHA V0.2.0
## Les Explorateurs contribuent
- Ajout de lieux depuis la carte (titre, photo, tag)
- Compression automatique des images (WebP, thumbnails 400px)
- Profils joueurs optimisés (pagination, chargement rapide)
- Modification du nom d'explorateur depuis le profil
- Nombre de lieux affiché dynamiquement sur la page de connexion
- Migration de toutes les images vers Supabase Storage

# ALPHA V0.1.1
## La Carte prend forme
- Exploration des lieux avec confirmation terrain
- Système de factions et revendications territoriales
- Notifications toast persistantes (claims, découvertes, explorations)
- Fortifications et niveaux de défense
- Brouillard de guerre dynamique
- Profils joueurs et classements par faction
