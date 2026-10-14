# Backlog technique — chantiers différés

> Infra, durcissement, observabilité, dette transverse. Ce qu'on a décidé de **ne pas** faire
> tout de suite, avec la raison — pour ne pas re-débattre à chaque fois qu'on y repense.
>
> Ce fichier ≠ `docs/db/tech-debt.md` (dette **DB/SQL** détaillée, format origine/coût/urgence).
>
> *Rapatrié du vault le 18/08/2026 (`L'app/📌 Backlog technique - App.md`, dernière revue 07/07).
> C'est du dev : ça vit dans le repo, pas dans Obsidian.*

## Infra / Process

- [ ] **CI légère (GitHub Action)** — sur chaque push : `tsc + build + npx supabase db push --dry-run --linked`, pour attraper les erreurs **avant** la prod. *(Idée XO 28/06 — plus rentable qu'un staging à ce stade, faible friction.)*
- [ ] **Base de staging** — **pas maintenant** (alpha : friction > valeur). À monter quand l'app sort de l'alpha (vrai trafic/revenus), via **Supabase Branching**. Le merge prod n'est PAS le problème (migrations = fichiers `NNN` + `db push`) ; le vrai coût = données représentatives sans PII.

## Sécurité — durcissement restant (post-audit 28/06)

> Le critique + tout l'accès **anon** (lecture ET écriture) sont déjà clos : migrations **320→324**.
> Reste du defense-in-depth contre un user **connecté** + du cosmétique. Aucune ERROR advisor restante.

- [ ] **Least-privilege storage par bucket** — aujourd'hui tout user *connecté* peut écrire n'importe quel bucket. Réserver les buckets **admin** (`app-ads`, `app-fragments`, `home-banners`, `app-assets`, `announcement-covers`, `tag-icons`) à `_is_admin()`. ⚠️ `faction-emblems`/`faction-patterns` sont **user-writable** (Compagnies créées V0.10). Mini-projet → à faire avec un filet (staging/branche).
- [ ] **`function_search_path_mutable` ×162** — `ALTER FUNCTION … SET search_path` (advisor 0011). Mécanique mais risqué sur prod sans filet → tester en transaction `ROLLBACK` ou branche jetable.
- [ ] **RPC mutation appelables par anon (~245)** — ⚠️ l'hypothèse « protégées par `auth.uid()` en interne » était **fausse pour 41 d'entre elles** (audit 27/09/2026, corrigé migs 346-348 : garde d'identité). Reste : `REVOKE EXECUTE` anon sur celles qui n'ont aucune raison d'être appelées déconnecté, en defense-in-depth.
- [ ] **2 extensions dans `public`** (`unaccent`, `fuzzystrmatch`) → déplacer vers schéma dédié (prudence : refs non qualifiées).
- [ ] **Leaked-password protection** — toggle dashboard Auth (impact faible : magic-link).
- [ ] **`place_tags` INSERT (authenticated, true)** — utilisé en direct par explore-web (`AddPlaceFlow`) → basculer vers RPC pour scoper.

## Observabilité — pattern « échecs muets » ⚠️

> Découvert le 07/07 : **deux** flux échouaient en silence (aucun log d'erreur, aucune alerte,
> aucune trace exploitable). C'est un **pattern**, pas deux incidents isolés. Un échec qui ne
> crie pas = du contenu et des ventes perdus pendant des mois sans qu'on le sache.

- **Instance 1 — webhook fragments Shopify** : tag produit `fragment:skjaldmo` (deux-points) vs `shopify_unlocks` = `fragment-skjaldmo` (tiret). Match exact → pas de déblocage. Et comme d'autres tags de la commande matchaient (`skipped>0`), la branche de log « no_match » ne se déclenchait même pas → **zéro trace**.
- **Instance 2 — upload studio soumission** (mig 331, 07/07) : le bucket `community-photos` refusait ce que le front invitait (vidéos + images 10-15 Mo ; plafond 10 Mo, mime/RLS image-only). L'upload jetait, la ligne `hub_photo_submissions` (créée AVANT la boucle) restait vide, l'user réessayait → soumissions vides en rafale. Victimes réelles : Pierrick, Ayden, Vincent (relancés par email).

- [ ] **Mini-audit des flux à échec silencieux** — webhooks (Shopify order), uploads publics (studio, place-images), RPC anon de mutation. Pour chacun : est-ce qu'un échec **laisse une trace exploitable** ? Ajouter log/alerte (ou statut en base) là où un échec passe sous le radar. Cible : plus jamais « le client dit que ça marche pas et on n'a rien ».

- **Acquis réutilisables** : `send-email` edge a désormais un type **`content_retry`** (template parchemin « renvoie tes contenus », prénom via `data.first_name`) — resservira pour toute relance post-bug. Bucket `community-photos` : 50 Mo + `video/mp4,quicktime,webm` (mig 331).

## Dette / cohérence

- [ ] **Une seule colonne de nom** (11/10/2026) — `users.first_name` (écrite) et `display_name` (lue, `COALESCE(display_name, first_name)` dans ~190 lectures SQL) disent la même chose depuis la mig 488, tenues égales par `trg_sync_display_name_with_first_name`. Garder `display_name`, reprendre les lectures et l'écriture d'`update_my_profile`, puis retirer `first_name` (vérifier le Hub et seo-pages). Les noms par défaut des comptes sans nom varient encore selon les fonctions (« Voyageur », « Un Voyageur »…).
- [ ] **2 migrations orphelines non filées** — `grade_founding_always_counts_306/307` (appliquées prod via MCP le 25/06, SQL perdu au `repair --reverted`). Effet **superseded** par 306/307/311/312/318 → repo = source de vérité OK ; à reconstituer seulement si on veut un repo 100 % rejouable.

## Hub — les « Réactivations » ne mesurent pas des réactivations (découvert le 01/10/2026)

- [ ] **Le chiffre est faux depuis sa création (28/02/2026).** Voulu : un ancien compte qui revient
  sur la nouvelle app, compté **une seule fois**. Codé : « compte de plus de 7 j (30 j sur le
  tableau de bord) connecté dans la période » = des anciens comptes **actifs**, recomptés à chaque
  période (`Dashboard.tsx` compteurs, `Users.tsx` badge « Réactivé ! » et export). *Reporté par
  Uriel le 01/10.*
  - Correctif proposé : une colonne « revenu le », écrite une fois à la première ouverture d'un
    ancien compte (`touch_last_login`), remplie au mieux pour le passé ; l'ancien chiffre renommé
    « Anciens comptes actifs ». **Il manque la date de sortie de la nouvelle app**, qui définit
    « ancien » — à demander à Uriel.
  - Le vrai chiffre se retrouve en partie : `last_login_at` n'est écrite que par la nouvelle app,
    depuis le 28/02. Au 01/10, sur 4 282 comptes créés avant février 2026, 174 revenus — mais par
    groupe : boutique (`account_source = shopify`) 30/1 311, inscrits jamais actifs 78/2 125,
    **vrais Explorateurs 66/846 (8 %)**. Minimum : un retour avant le 28/02 n'a pas laissé de trace.
  - Depuis la V2 1.0.10, revenir dans l'app après 10 min avance aussi `last_login_at` : les
    compteurs actuels montent un peu sans qu'il y ait plus de retours.

## V2 — zone Compte, suites (27/09)

- [ ] **Article de chaque Fragment dans le Hub** — un champ (« l' », « le », « la », aucun) pour que le profil dise juste *sous le signe de l'Hoplite / du Varègue / d'Avalon*. Remplace la règle approchée de `apps/web-v2/src/features/compte/lib/signe.ts` (décision d'Uriel).
- [ ] **Titres offerts** — table (qui, quel titre, pourquoi, quand, offert par), action « Offrir un titre » dans le Hub réservée à Uriel, marque propre et feuille « Offert par Runes de Chêne — pourquoi, quand » dans la V2. Rares, jamais liés à un achat.
- [ ] **Page « Tous les titres »** — maquette en cours ; les compteurs existent déjà (`get_all_player_titles().stats`).

## Idées non instruites

- [ ] **Système d'emails séquencés** — brouillon de schéma jamais appliqué : `docs/db/drafts/systeme-emails-BROUILLON.sql` (tables `email_subscribers`, `email_sequences`, séquences `shopify_welcome` / `app_welcome` / `post_order` en J1/J3/J7/J10). Aucune de ces tables n'existe en prod ni dans le repo. À instruire ou à jeter — pas à appliquer tel quel.

## Fragments audio — mesure des écoutes (en ligne depuis le 16/08)

- Le compteur agrège toute la durée de vie : pas de fenêtre par drop.
- L'identité de session ne survit pas au navigateur : un second onglet compte une seconde écoute. À trancher.
- Écrans back-office connectés (liste et fiche joueur, tableau de bord, Fragments, Sync Shopify) basculés sur la vue staff, jamais testés avec une session admin.

## Hub : la modération écrit le récit sans version (relecture « Enrichir un lieu », 05/10/2026)

`mod_update_place` (mig 329, appelée par `apps/hub/src/components/moderation/PlaceEditPanel.tsx`) met à
jour `places.text` et `title` sans ligne dans `versions_lieu` ni mise à jour de `place_contributions` :
une correction de modérateur recrée l'écart V1/V2 que la mig 416 a réparé, et la version « Actuelle »
ne correspond plus à la fiche. À faire : qu'elle passe par une version (auteur = le modérateur, note
« Modération ») et tienne `place_contributions` à jour, comme `modifier_lieu` (mig 414).

## Hub : `Photos.css` redéfinit `.mod-row` pour tout le Hub (07/10/2026)

`apps/hub/src/components/photos/Photos.css` pose `.mod-row { display: flex; … }` sans préfixe : le CSS
du Hub est global, la règle écrase celle d'`App.css` sur toutes les pages qui utilisent `.mod-row`
(Mises à jour : l'image et le texte se rangeaient côte à côte). Contourné dans `MisesAJour.tsx`
(`display: 'block'` en ligne). À faire : renommer les classes de `Photos.css` (`photo-row…`).

## Le scan — mineurs de la relecture (09/10/2026)

> Relecture de la branche du scan (spec `2026-10-09-v2-scan`) : les 8 points importants sont
> corrigés (commit `843e73af`) ; ceux-ci sont reportés, aucun ne bloque le test de l'atelier.

- [ ] **Vieux téléphones** : sans `navigator.mediaDevices` (navigateurs intégrés, iOS < 14.3), `useCamera` lève ; sans `AudioContext` (iOS < 14.1, `webkitAudioContext` seul), `debloquerSon` lève et le bouton « Scanner » ne fait rien. Garder les deux, et un état « caméra absente ».
- [ ] **Son** : `biper()` ne relance pas un contexte `suspended`/`interrupted` (appel, notification) ; l'iPhone en silencieux ne joue pas Web Audio (`navigator.audioSession.type = 'playback'` là où il existe). Au deuxième passage, `resume()` étant asynchrone, le bouton « Scanner » peut réapparaître après le toucher de l'icône.
- [ ] **Caméra** : toute erreur dit « refusée » (même `NotReadableError`, `NotFoundError`) ; elle reste allumée dans un onglet caché ; une piste `ended` après la veille iOS laisse le viseur noir (`visibilitychange`).
- [ ] **Rendu** : `setMeilleur` redessine `ScanScreen` ~8 fois par seconde, même pour un visiteur qui n'en a pas besoin.
- [ ] **Feuille des admins** : `agir` sans `catch` — un `ajouter_vue` raté ne dit rien.
- [ ] **SQL** : `noter_scan` ouvert à tous sans limite (le chiffre des scans peut être gonflé ; les bips de l'atelier comptent) ; `remplacer_empreintes_illustration` efface sans filtrer sur `modele` (ajouter `AND modele = p_modele`) ; le test des RPC vit hors dépôt (à ranger sous `supabase/tests/`).
- [ ] **Retour du scanner** : un lien vers `/accueil` ou `/bienvenue`, pas le retour du navigateur ; depuis la carte, on revient sur l'Accueil.

## Le choix du calendrier — mineurs de la relecture (10/10/2026)

> Relecture de la branche `feat/choix-du-calendrier` (spec `2026-10-09-choix-du-calendrier`) : aucun
> point important ; ceux-ci sont reportés.

- [ ] **Ouverture à froid** : le calendrier n'est pas dans le cache persisté — l'appli affiche une seconde le chrétien avant le choix du joueur.
- [ ] **Onboarding** : « Suivant » pressé avant la fin de la lecture du calendrier enregistre `chretien` par-dessus un choix déjà fait (lien direct ou retour arrière seulement ; les Préférences corrigent).
- [ ] **Paquet `calendrier`** : la regex des siècles accepte des chiffres romains mal formés ; `anneeEnClair(0)` n'est pas gardé ; `romain()` mute `reste` dans un `reduce` (un `for…of` serait plus simple) ; une année démesurée donne un chiffre romain géant.
- [ ] **Hub** : la recherche des énigmes porte sur le texte brut (avec accolades) ; le garde QCM compare la réponse rognée mais enregistre la réponse telle quelle (sans effet : `percer_enigme` normalise) ; des accolades tapées par un joueur dans un signalement disparaissent à l'affichage.
- [ ] **Énigme #58** : QCM dont la réponse n'est pas l'un des choix (antérieur au calendrier, injouable).
- [ ] **Lockfile** : un second vitest/vite résout `@types/node` 25.2.0 (24.19.0 ailleurs) — aligner le devDep pour dédoublonner.

## La frise des époques — mineurs de la relecture (11/10/2026)

> Branche `feat/frise-des-epoques` (spec `2026-10-10-frise-des-epoques-design.md`), en prod en
> Pythéas 1.16.0 : aucun point important ouvert ; ceux-ci sont reportés.

- [ ] **Bouton Filtre** : une plage choisie dans la frise le cercle aussi de rouge (`filtresActifs` inchangé, voulu par la spec) ; on ouvre « Filtre (actif) » et rien n'y est choisi. Piste : une ligne dans la feuille qui nomme la plage de la frise.
- [ ] **Animation** : la bande entre en fondu mais sort d'un coup ; la rose, « Ma position » et le « + » restent atteignables au clavier pendant le fondu (`visibility` bascule à la fin).
- [ ] **Tests** : `frise.ts` sans cas « frise vide » ni « ensemble non contigu » ; l'assertion « pas de bouton Renaissance » de la feuille peut passer avant la réponse ; le test du sablier ne vérifie que le libellé.
- [ ] **CSS** : `Sablier.tsx` importe `CarteScreen.module.css` ; `FriseDesEpoques.module.css` est le seul fichier à utiliser `composes:` ; la règle `data-bord` (années aux bords) ne sert que si la première époque a un début ou la dernière une fin.
- [ ] **SQL** : `supabase/tests/v2-carte/396_filtres_de_carte.sql` rejoue la 396 (sans `debut`/`fin`) : le pointer sur la 477 s'il resservait.

## Le carnet des mises à jour — mineurs (11/10/2026)

> Branche `feat/carnet-des-mises-a-jour` (spec `2026-10-11-carnet-des-mises-a-jour-design.md`), en
> prod en Pythéas 1.17.0 (migs 478-479). Relecture faite par l'auteur seul (sans relecteur neuf).

- [ ] **Sous une note** : pas de rangée de visages (seul l'auteur ouvre la liste des cœurs) ; la feuille des cœurs s'ouvre sans adresse (le retour quitte la page) ; un carnet qui ne se charge pas ne dit rien.
- [ ] **Sur un lieu** : l'équipe n'y voit toujours « Effacer » que sur ses mots (`_mot` ne rend pas `peutEffacer`), alors que `effacer_mot` l'autorise.
- [ ] **Essai** : pas encore vu en largeur téléphone ni avec un vrai mot écrit en prod (pour ne pas notifier les admins) — le premier commentaire réel fera foi.

## Test instable (11/10/2026)

- [ ] `features/scan/hooks/useAnalyse.test.tsx` « une analyse qui échoue en cours de route (contexte GPU perdu) » a échoué une fois sur la suite complète, puis passé seul trois fois et sur la suite suivante : une course de minuterie sous charge à rendre déterministe.

## Hub V2 (14/10/2026)

- **Hub V2 — santé** : la version d'Explore (`app_settings.explore.version`) dans « La santé » ; la santé des
  fiches publiques ne voit pas un déploiement réussi mais vide.
- **Hub V2 — fil et santé, reste de la spec §9/§10** : recherche par Explorateur ou lieu ; lien de
  chaque ligne du fil vers sa page ; « Porteur » dans le détail d'un compte ; nature du lieu et
  nombre de photos ; nombre de photos d'une contribution ; lignes `purchase_log` sous Boutique ;
  version d'Explore dans « La santé » ; libellés lisibles pour les canaux de chat (nom de la
  Compagnie) et les types de notification (plus d'identifiants bruts) ; déconnexion depuis la
  coquille ; fenêtre de comparaison de « Aujourd'hui » (en attente de la décision d'Uriel).
- **Hub V2 — image de fond** : une grande image de parchemin (≥ 2 880 px) pour le PC (spec §13.5).
- **Hub V2 — communauté** : Associer un Fragment à la main depuis la fiche d'un compte (plan 4).
- **Hub V2 — communauté** : Membres d'une Compagnie : pas de retrait ni de changement de rôle par l'équipe (YAGNI, à demander).
- **Hub V2 — communauté** : Signalements → fiche de modération : fermer la fiche ramène aux Lieux, pas à la file (passer un retour).
- **Hub V2 — communauté** : Export CSV des comptes limité à 10 000 lignes.
- **Hub V2 — jeu** : Énigmes : pas de suppression (on désactive) ; pas de filtre « Universelle » (`hub_enigmes` ne filtre pas sur une culture nulle).
- **Hub V2 — jeu** : Cultures et natures : ni création de culture ni suppression de nature.
- **Hub V2 — jeu** : Titres de Compagnie V1 masqués, à purger avec `docs/v2/purge-back.md`.
- **Hub V2 — jeu** : Une icône ou une image envoyée puis abandonnée sans enregistrer reste dans son bucket.
- **Hub V2 — fonctions Netlify** : un `netlify/tsconfig.json` + `tsc --noEmit -p netlify` une fois que les copies pourront diverger de l'ancien Hub (après la bascule).
- **Hub V2 — fonctions Netlify** : l'étape PATCH de `shopify-sync` ignore les codes de réponse (`updated` = taille des lots, même si Shopify ou la base refuse) — à corriger dans la fonction après la bascule.
- **Hub V2 — fonctions Netlify** : `shopify-callback` ne vérifie ni `state` ni le `hmac` de Shopify (déjà le cas dans l'ancien Hub) ; son HTML renvoie encore vers l'ancienne route `/shopify/sync`.
