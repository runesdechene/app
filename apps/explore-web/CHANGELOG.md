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

### Sous le capot
- Nouvelle branche `home-mobile-hub`, ressuscitation chirurgicale des composants du pivot du matin (StatsBar, DailyEnigmaCard, EnigmaFragmentsList, PlacesSection, ActivityFeed)
- 2 composants partagés : `MobileTopBar` (logo + boutique + cloche + profil) et `MobileStatsBar` (niveau + énergie + couronnes), montés sur `/accueil` ET `/carte` mobile pour cohérence
- 3 nouvelles pages : `HomePage`, `ChatPage`, `ActivityPage` (lazy-loaded — pas de surcoût desktop)
- `ActivityFeed` paramétré avec `limit` et `onSeeMore` (3 lignes en teaser, 30 en page complète)
- `BottomTabbar` 5 cellules avec FAB central et badges non-lus
- Routing platform-aware : `RootRedirect` envoie sur `/accueil` (mobile) ou `/carte` (desktop), `MobileOnly` wrapper redirige les routes mobile vers `/carte` sur desktop
- `MapPage` mobile : header partagé en haut, BottomTabbar en bas, suppression du `ChatPanel` flottant et de l'ancien `MobileHeader` (doublons éliminés)
- HUD mobile recalibré pour laisser place au bandeau supérieur (~120px) et à la navbar (~64px)

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

### Sous le capot
- Mig 141 : table `push_subscriptions` (1 row par appareil) + RLS strict + 2 colonnes `users.push_*_enabled`
- Mig 142 : trigger `AFTER INSERT ON notifications` → `pg_net.http_post` vers Edge Function (fail-open : l'INSERT ne casse pas si la config manque)
- Mig 143 : seed `app_config` (URL Edge Function + service key, à remplir post-deploy)
- Mig 144 : cron énigme — fenêtre cron 4× UTC + filtre `Europe/Paris` 12h30 ± 5min (DST-safe été/hiver)
- Mig 145 : cron level-up imminent — quotidien 17h UTC, 1×/7j/user, basé sur `xp_total` + `_xp_for_level`
- Mig 146 : cron récap hebdo — lundi 8h UTC, seuil min 3 nouveaux lieux
- Edge Function Deno `send-push` : npm:web-push, VAPID auth, parallel send, cleanup automatique des subs 410/404
- Bascule `vite-plugin-pwa` mode `injectManifest` → SW custom (`src/sw.ts`) avec push handler + notificationclick (focus tab existante ou ouvre)
- Hook `useEnsurePushPermission` réutilisable + `PushPromptHost` mounté une fois dans MapPage
- Détection iOS Safari non-standalone → `IOSInstallGuideModal` (4 étapes visuelles)
- Tout type non listé reste **silent** (in-app uniquement) — élargissement type par type plus tard

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

### Sous le capot
- Mig 121 : externalisation des paramètres éco Couronnes vers `app_settings` (ajustables à chaud, sans nouvelle migration)
- Mig 122 : refonte `get_my_crowns_state` + `harvest_crown` — tirage indépendant par lieu (formule p(N) = K/√N), drip intra-journée déterministe via hash `(user, lieu, date)`
- Mig 123 + 124 : `discover_place` étendue — gain Couronne sur découverte (remote ET GPS), bonus mini-quête sur 3 découvertes remote du jour (énergie dépensée), déduplicaté via `activity_log`
- Mig 125 : RPC `get_today_quests_state` — array de quêtes du jour avec `progress`, `target`, `reward`, `completedAt`. Architecture ouverte multi-quêtes
- Frontend : `DailyQuestsList` + `DailyQuestCard` + `DailyQuestModal` montés en tête de `QuestsBoardPanel`, refetch déclenché depuis `discoverPlace` après chaque action remote
- Modale quête réutilise `InfoModal` (portal vers `document.body`, style canonique des badges Gloire/Couronnes/Coupe) — slot `extraContent` ajouté au composant pour la barre de progression
- Toasts énigme harmonisés (`hooks/usePlayer.ts` + `lib/loadRecentActivityToasts.ts`) : icônes 🎖️/🏆/🪙 inline, fini les 🦉/📖 résiduels, gain Couronne lu depuis `data.crownsGain` (présent dans `activity_log` depuis mig 080)
- Renaming UX : panneau « Événements » → **« Quêtes en cours »** (aligné sur le contenu hybride)
- Plafond stock inchangé (500), gain par récolte inchangé (+1 solo / +2 si lieu partagé à 2+)
- Signatures RPC inchangées : compatible avec les anciens clients en cache

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

### Sous le capot
- Modale plein écran via `100dvh` + safe-area iOS (notch + home indicator)
- Footer modale, chat input et footer création ancrés au viewport (position fixed) : plus rien ne se cache derrière la barre du navigateur
- Titre / appel / lieu descendent dans la zone scrollable plutôt qu'en sticky — tout l'écran sert à lire
- Mode édition : header allégé (« Modifier l'événement » + ← Retour), tabs masquées
- FAB debug Voronoï ramené au niveau de l'interface carte — ne masque plus les notifications
- Mig 118 : `get_player_profile` retourne désormais `tagIcon` (emoji du tag primary)

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

### Sous le capot
- Panneau « Expéditions » dans le HUD gauche, sous les toasts d'activité (mobile : page entière)
- Chat Realtime, notifications pour acceptation, refus, modifs, annulation, rappel J-1
- Bucket public dédié pour les images de couverture
- Comptes rendus + galerie commune posés en backend, ouverts dès qu'une expédition est passée

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

### Sous le capot
- Faveur 50 réservée aux veilleurs IRL : un veilleur "par influence" n'a pas de bonus diplomatique, juste ses Couronnes.
- Réaffirmation IRL : le bouton "Planter mon étendard" sur ton propre lieu efface les challengers en cours (mais garde ta défense).
- Replant interdit en pure perte : le bouton ne s'affiche que quand il a un sens.
- Refonte UX en parchemin / encres bordeaux et violet pour aligner avec l'esprit Rune de Chêne.
- **Voronoï pondéré activé en prod** (1.6 km de base, +0.9 km par décade de Couronnes investies, plafond 10 km) : les lieux avec beaucoup de Couronnes irradient plus loin sur la carte. Le panel admin de calibration reste accessible.

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

### Sous le capot
- Faveur 50 implicite, jamais stockée — calculée à la volée pour réduire la dette d'état.
- Bascule atomique en transaction, journal append-only pour la chronique et le leaderboard mécènes.
- Anciens scores d'influence V0.5 droppés. Tout le monde repart à zéro sur la nouvelle Cour.
- Notifications temps réel : tu sauras qui s'intéresse à tes lieux, et quand tu deviens Mécène Principal d'un endroit.

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

### Sous le capot
- Le brouillage GPS est calculé une seule fois par session pour rester crédible (pas de "fantôme qui clignote").
- Les actions des quêtes sont trackées par triggers SQL : aucun risque d'oublier de comptabiliser une découverte ou une moisson.
- Réseau temps réel : channel emoji-throws broadcast pur (zéro DB), notes en presence + DB pour la persistence inter-sessions, quêtes en postgres_changes pour les toasts de complétion.

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
