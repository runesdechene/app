# Le pouls dans Claude Code — mod « pouls » (design)

> **Retiré le 18/10/2026.** Le mod a été mis en service puis écarté le soir même : il marchait,
> mais un chiffre ambiant n'apportait rien. Mod, place de marché et fonction edge supprimés du
> dépôt ; seule la migration 528 reste (`hub_ouverture` dépend de ses deux fonctions). Document
> gardé comme archive — **ne pas le rejouer**, la décision est dans le vault, « Écarté ».

> Statut : **conception validée avec Uriel le 18/10/2026**, relue par un constructeur avant remise.
> Rien n'est construit. Le mod est un plugin Claude Code (hooks + panneau) ; il vit dans ce dépôt
> et s'installe sur les deux machines. Sa source de chiffres est une Edge Function dédiée, pas le
> Hub.

## 1. Intention

**Pourquoi.** Uriel ouvre Claude Code pour travailler, pas pour consulter le Hub. Les chiffres de
l'entreprise — combien de nouveaux comptes, combien d'actifs, combien d'énigmes percées — ne sont
visibles qu'en allant ouvrir `hub.runesdechene.com` et en choisissant une période. Résultat : il
code sans savoir où en est la maison, et le coup d'œil du matin n'a jamais lieu.

**Ce qu'on fait.** Le pouls du Hub s'affiche dans Claude Code, de lui-même, dès qu'une session
s'ouvre sur ce dépôt. Les mêmes six chiffres, le même sélecteur de période, la même lecture — sans
quitter l'outil de travail.

## 2. Buts

- Les **six tuiles du pouls**, dans l'ordre du Hub : Nouveaux comptes, Comptes réactivés, Actifs,
  Lieux ajoutés, Visites sur place, Énigmes percées.
- **Leur écart** par rapport à la période d'avant, **exactement comme le Hub le fait** : pas
  d'écart sur « Actifs » (`last_login_at` ne garde que la dernière connexion), et pas d'écart du
  tout en « Depuis toujours », faute de période d'avant. Le panneau miroite
  `apps/hub-v2/src/features/accueil/components/Pouls.tsx` ; là où ce fichier et ce document
  divergent, c'est le fichier qui fait foi.
- Le **sélecteur de période** du Hub, cliquable : Aujourd'hui · Cette semaine · Ce mois-ci ·
  Depuis toujours.
- **Ouvert tout seul** dans les sessions de ce dépôt, **repliable au clic** en une seule ligne.
- **Les mêmes chiffres et la même interface** sur le PC fixe et sur le portable.
- **Frais** : le panneau se rafraîchit sans qu'on le lui demande.

## 3. Non-buts

- **Aucune écriture.** Le mod lit, point.
- **Pas l'attente ni la santé boutique.** `hub_ouverture` les renvoie aussi (photos à modérer,
  dernière commande…) ; le panneau n'affiche que le pouls. Elles restent le travail du Hub.
- **Pas d'historique, pas de courbe.** Six nombres et leur écart, comme à l'écran du Hub.
- **Pas de miroir entre les deux machines.** Chacune lit la même base et affiche la même chose ;
  rien ne voyage de l'une à l'autre.

## 4. Anti-buts — ce qui ferait de ce chantier un échec même s'il marche

- **Une clé puissante posée sur les machines.** Ni `service_role`, ni une session admin permanente.
  Ce qui descend sur le poste ne doit donner accès qu'à six nombres. C'est aussi pourquoi le mod
  **n'ouvre pas le `.env` du dépôt**, qui contient `SUPABASE_SERVICE_ROLE_KEY` et les identifiants
  Shopify.
- **Un panneau qui gêne.** S'il encombre une session où Uriel débogue une migration à 23h, il a
  raté sa cible — d'où le repli au clic.
- **Un chiffre périmé présenté comme frais.** En cas d'échec de lecture, le panneau le dit et date
  ce qu'il montre. Il ne ment jamais par omission.
- **De la dette en prod pour un confort personnel.** L'Edge Function et le SQL ajoutés doivent être
  aussi simples et lisibles que le reste, ou ne pas exister.

## 5. Contraintes

- **`hub_ouverture(p_periode)` est fermée.** `REVOKE … FROM PUBLIC, anon`, `GRANT … TO
  authenticated`, et son corps commence par `IF NOT _is_admin() THEN PERFORM _refus(…)`.
  `_is_admin()` cherche `auth.uid()` dans `public.users` avec `role = 'admin'` : **la clé
  `service_role` est refusée elle aussi**, faute d'identité. Le mod ne peut donc pas appeler cette
  RPC, quelle que soit la clé du `.env`.
- **Le helper de comptage existe déjà** : `public._hub_pouls(timestamptz, timestamptz)` (mig 506),
  `REVOKE ALL … FROM PUBLIC, anon, authenticated`, appelé deux fois par `hub_ouverture`. **La
  définition live de `hub_ouverture` à recopier entière est celle de la mig
  `521_hub_boutique.sql`**, pas 510.
- **Le mod tourne sans Node et sans DOM.** Il ne dispose que de l'interface `$` de l'hôte :
  `$.http.fetch` pour le réseau, `$.clock` pour le temps, `$.store` pour la mémoire, `$.ui` pour le
  dessin, `$.session.repo()` pour savoir où il est.
- **`$.store` est local à la machine** (un fichier JSON dans la configuration Claude Code). Tout
  réglage qui doit suivre d'une machine à l'autre vit dans le dépôt, pas dans `$.store`.
- **Les deux machines tournent l'appli bureau** (décidé le 18/10). C'est une surface qui dock le
  panneau sur le côté et qui rapporte les clics : le sélecteur et le repli sont cliquables.
- Les règles du dépôt s'appliquent telles quelles : TS strict, pnpm, Conventional Commits, canal
  unique pour les migrations, et le code est un chef-d'œuvre de simplicité.

## 6. Le comment — ce qui est décidé

### 6.1 La porte d'entrée : une Edge Function dédiée

Une fonction `pouls`, à côté de `send-email` et `send-push`, dans `supabase/functions/pouls/`.

- Elle **vérifie un secret d'en-tête** et refuse tout le reste.
- Elle **ne renvoie que le pouls** : les six compteurs de la période et ceux de la période d'avant.
- **Le secret vit dans `public.app_settings`**, comme ceux de `send-email` et `send-push`. Ces deux
  fonctions l'y gardent **exprès** — l'API MCP n'expose pas les secrets Supabase, et
  `.claude/rules/deploiement.md` enregistre la règle. Un troisième motif dans le même dossier
  serait de la complication gratuite. Le révoquer, c'est changer la ligne en base et l'option du
  mod sur les deux machines.

**Le SQL.** Ce qui manque à l'extérieur de `hub_ouverture`, ce n'est pas le comptage — `_hub_pouls`
le fait déjà — mais le **calcul des bornes de période** (`date_trunc` à l'heure de Paris, période
d'avant) et le compteur **`actifs`**, tous deux écrits en ligne dans `hub_ouverture`. On extrait ces
deux-là dans un helper interne, et la nouvelle lecture réservée à `service_role` s'en sert comme
`hub_ouverture`. `hub_ouverture` garde son contrôle `_is_admin()` et son comportement à
l'identique ; son `CREATE OR REPLACE` part de la **définition live copiée entière** (règle du
dépôt), pas d'un fichier de migration. La migration porte un `-- WHY:` en tête et passe par
`npx supabase db push --linked`, **appliquée par Uriel**.

**Le déploiement de la fonction** suit `.claude/rules/deploiement.md`, qui garde la trace d'un
incident payé en prod le 15/06/2026 : un bloc `[functions.pouls] verify_jwt = false` dans
`supabase/config.toml`, et `npx supabase functions deploy pouls --use-api --no-verify-jwt`. Sans
`--no-verify-jwt`, la vérification JWT plateforme se réactive et la fonction casse.

### 6.2 Le mod

Un plugin à hooks dans ce dépôt, déclaré comme **place de marché dossier** : le dépôt est déjà
cloné sur les deux machines, donc `git pull` met le mod à jour et il se recharge. (La route GitHub
a été écartée : un plugin installé depuis un dépôt distant tourne sur une copie figée à
l'installation et ne bouge qu'avec `claude plugin update`, ce qui trahit la promesse « un pull
suffit », et demanderait des identifiants sur chaque machine si le dépôt est privé.)

Comportement décidé :

- **Il se reconnaît au dépôt, pas au chemin.** `$.session.repo()` donne la racine du dépôt
  principal et son dépôt distant, y compris depuis un worktree. C'est la bonne clé : le chemin
  absolu diffère entre le fixe et le portable, et **les sessions en worktree comptent** — une
  bonne part du travail s'y fait.
- **Le secret est une option du plugin**, saisie une fois à l'installation sur chaque machine et
  rangée dans les réglages Claude Code. Le mod ne lit jamais le `.env`. **Sans secret, le panneau
  s'affiche et dit pourquoi il est vide** — il n'est jamais silencieux sur une machine fraîchement
  installée.
- **Ouvert au lancement, replié au clic.** Replié, il ne laisse qu'une ligne. Le choix est mémorisé
  dans `$.store`, donc par machine — c'est voulu : le fixe et le portable ne travaillent pas pareil.
- **Si la surface ne place pas le panneau**, le mod se rabat sur une ligne de barre d'état plutôt
  que de s'imposer au-dessus de la zone de saisie (mon appel). Le cas ne devrait pas se présenter
  sur l'appli bureau, mais il coûte peu et protège l'anti-but « un panneau qui gêne ».
- **Période par défaut : Cette semaine**, puis le dernier choix mémorisé (mon appel). Changer de
  période relit aussitôt.
- **Rafraîchissement** : à l'ouverture de la session, puis toutes les dix minutes, plus au
  changement de période et à la demande (mon appel).
- **En cas d'échec** : le panneau garde les derniers chiffres lus, les date (« il y a 12 min ») et
  affiche l'échec. Jamais un vieux chiffre présenté comme frais.

### 6.3 Où s'arrête le chantier

Le constructeur livre le code prêt et testé. **Uriel applique la migration et déploie la
fonction** — c'est la règle du dépôt, et personne d'autre n'a les accès. La dernière étape est une
vérification de bout en bout en prod, faite par Uriel et rapportée : un appel sans secret doit être
refusé, un appel avec secret doit renvoyer les six nombres, et ces nombres doivent être **les mêmes
que ceux affichés au même moment dans le Hub**.

## 7. Laissé au constructeur

- Le dessin exact du panneau : largeurs, abréviations des libellés, rendu de l'écart, rendu replié.
- La forme du JSON de l'Edge Function et le nom exact de l'en-tête du secret.
- Le nom et l'emplacement précis du dossier du mod dans le dépôt, et la forme du manifeste.
- Le découpage du helper SQL (bornes de période + `actifs`) et son nom.
- Les tests : au moins le refus sans secret côté fonction, et le comportement du panneau en échec
  de lecture côté mod.

## 8. Points ouverts

- Rien. Les six questions de la relecture du 18/10 sont tranchées : surface (appli bureau des deux
  côtés), secret côté mod (option saisie à l'installation), secret côté base (`app_settings`),
  mise à jour (place de marché dossier), worktrees (inclus), fin du chantier (Uriel déploie et
  vérifie).
