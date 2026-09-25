---
paths:
  - "apps/**"
---

# Produit — les mots et les règles du domaine

> Vocabulaire et arbitrages produit. Se charge dès qu'on touche au code applicatif : un mot faux dans l'interface coûte plus cher qu'un bug.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## Découvrir = à distance + énergie. Visiter = GPS + gratuit. Ne jamais confondre.

**Règle :** dans tout brainstorm, spec, plan, code, copy user-facing : **"découvrir" = action à distance qui coûte de l'énergie** (révéler un lieu sans y aller). **"Visiter" / "explorer en GPS" / "poser ma marque" = action physique sur place, gratuite** (proximity < 500m).

**Why :** Uriel l'a recadré une 1ère fois (date antérieure non tracée), puis re-recadré le 7 mai 2026 quand j'ai écrit la spec + plan + code de l'éco Couronnes en branchant le gain sur `v_method = 'gps'`. La spec elle-même disait "Découverte d'un lieu (1ère visite GPS)" — j'ai propagé la confusion jusqu'au CHANGELOG. Indice donné par Uriel et zappé : "on dépense de l'énergie pour découvrir, et l'énergie c'est seulement à distance". Donc énergie + découverte sont liés sémantiquement → GPS gratuit ne peut pas être une "découverte".

**How to apply :**

1. **Avant d'écrire toute spec, plan ou copy qui touche à la carte** : faire un check sémantique express. Le mot "découvrir" est-il bien aligné sur l'action remote (énergie) ? Le mot "visiter" sur l'action GPS (gratuite) ? Si je les mélange dans une phrase, je m'arrête et je clarifie.

2. **Dans le code** : la RPC `discover_place` traite les deux cas (remote et GPS) sous le même nom — c'est de la dette héritée, pas une licence pour confondre. Toute logique conditionnelle sur `v_method` doit utiliser des noms de variables explicites (`is_remote_discovery`, `is_gps_visit`).

3. **Dans le CHANGELOG / posts user-facing** : utiliser littéralement "découvrir à distance" et "visiter sur place" / "poser ta marque". Jamais "1ère visite GPS" comme synonyme de "découverte" — c'est le piège.

4. **Économie Couronnes (mai 2026, pour mémoire concrète)** : la Couronne se gagne sur **les deux actions** (découverte remote + visite GPS) — Uriel a tranché ainsi le 7 mai. La mini-quête "3 découvertes du jour" = **3 découvertes remote uniquement** (l'énergie dépensée est l'effort à récompenser).

**Précédent qui m'a coûté un revert :** mig 123 (committée puis fix par mig 124 le 7 mai 2026), CHANGELOG V0.7.6 réécrit après commit. Coût : ~30 min, demi-honte salutaire.

## Terminologie user-facing — "Mécénat" préféré à "Cour

Préférence Uriel — terminologie user-facing.

**Règle** : dans les textes vus par les users (modales d'info, slides tutoriel, descriptions de badges, footers explicatifs), employer **"Mécénat"** ou **"mécénat d'un lieu"** plutôt que **"La Cour"** ou **"la Cour d'un lieu"**.

**Exceptions** :
- Le **"Trône des Mécènes"** reste tel quel (composant `PatronsList`, libellé top du leaderboard).
- Les **"Mécènes"** comme rôle (#1 = "Mécène Principal") : OK, déjà aligné.

**Why** : Confirmé le 6 mai 2026 lors de l'ajout du slide tutoriel et de la modale d'info Couronnes. Uriel : "slide tutoriel, pas la cour, mais le mécénat. Je préfère le terme mécénat." Le mot "Cour" évoque trop le politique/cour royale, "Mécénat" est plus juste — un acte d'art et de patronage, qui colle mieux au ton parchemin/chevaleresque RdC.

**How to apply** :
- À chaque nouveau texte user-facing impliquant l'investissement de Couronnes sur un lieu, employer "mécénat" / "investir en mécénat" / "Le Mécénat".
- **NE PAS renommer le code interne** : `PlaceCourtView`, `useCourtNotifications`, `place_court_invest`, `get_court_invested_per_place`, types `Patron`/`Court...` restent en "court". Le coût d'un rename complet est trop élevé pour un bénéfice nul (ne fait pas progresser le festival du 12 mai).
- Si Uriel demande à terme un rename complet, le faire dans une session dédiée avec son accord explicite.

## reference_terminologie_compagnie_vs_faction

Depuis le [[project_pivot_factions_creables]] (24/06) : la mécanique de groupe joueur = le **moteur Faction** (tables/RPC `faction*`, `faction_members`), mais **dans le jeu on dit « Compagnie »**, jamais « faction ».

- **User-facing (copy UI, toasts, modales)** : « Compagnie », « Chef de Compagnie », « Fonder une Compagnie », etc.
- **Code / DB / RPC / commits internes** : `faction`, `faction_id`, `create_faction`, `faction_members`…

Même convention que [[feedback_terminologie_mecenat_vs_cour]] (« Mécénat » user / `court` code). Les composants portés depuis l'ex-SPEC2 affichent déjà « Compagnie » → pratique. Bucket emblèmes = `faction-emblems` (créé par Uriel).

## Ne jamais checker une action contre une valeur cosmétique client

**Règle** : Si une valeur est "calculée localement pour donner l'illusion d'une progression continue" (typique des jauges qui montent en temps réel), elle ne doit JAMAIS servir à activer/désactiver un bouton ni à valider qu'une action est possible. Elle est uniquement pour l'œil. Le check doit utiliser la VRAIE valeur store (celle synchronisée avec le serveur).

**Why** : Bug d'énergie traîné pendant des mois — `fractionalEnergy = energy + fractionOfTick` (useFractionalEnergy.ts) servait d'affichage HUD ET de check `canAfford` dans FoggedPlaceView. À 1.9 illusoire, le bouton paraissait actif, mais `users.energy_points` côté DB valait 1 (régen par ticks entiers FLOOR), le serveur renvoyait `not_enough_energy`, et le composant ignorait ce retour → clic mort silencieux. Pour le user, "le bouton marche pas". Pour Uriel, suspecté à juste titre que "l'affichage prend le bonus mais le mécanisme non". Fix V0.8.8 (10 mai 2026).

**How to apply** :
- Dans tout composant qui gate une action (bouton disabled, condition de submit), utiliser les valeurs store brutes (synchronisées serveur), pas les valeurs cosmétiques dérivées.
- Si un hook fait `localStorage + interpolation client` pour une jauge, son retour ne sert QU'À l'affichage, jamais à un check de capacité.
- Toujours surfacer l'erreur serveur en toast en defense-in-depth — si le serveur refuse une action que le front a laissé passer, le user doit savoir pourquoi (pas un clic mort).
- Note connexe : `users.energy_points` (et autres ressources) sont `NUMERIC(6,1)` en DB. La régen par tick = entière (FLOOR), mais la dépense peut laisser un .5 réel. Donc le store `energy` peut légitimement valoir 0.5 / 1.5 — ne pas confondre avec l'illusion fractionalEnergy.

## Jamais de spoilers d'énigmes dans contenus user-facing

**Règle absolue** : tout contenu vu par les joueurs (changelog in-app, posts Insta, emails, push notif, blog SEO) ne doit JAMAIS citer une bonne réponse d'énigme, ni un fait précis qui constitue la réponse à une énigme existante.

**Why** : Le 29 avril 2026, j'ai écrit dans le changelog V0.5.12 : "Hannibal redevient carthaginois et non romain ; le cratère de Vix retrouve sa contenance de 1 100 litres ; les Nerviens regagnent le Hainaut au lieu de la Champagne". Ces 3 phrases spoilaient les bonnes réponses des énigmes #160, #242, #195. Uriel m'a rattrapé : "tu viens littéralement donner les réponses, c'est complètement con". J'ai appliqué un pattern de "changelog technique transparent" sans me demander si ce que j'écris sabote la mécanique du jeu — défaut de jugement contextuel.

**How to apply** :
- Avant d'écrire tout texte user-facing qui mentionne des "corrections", des "améliorations" ou des "ajouts" sur les énigmes : vérifier si la formulation révèle une réponse correcte.
- Pour communiquer une correction sans spoiler : rester en généralité ("quelques erreurs factuelles corrigées", "passe orthographique", "fond historique resserré"). NE JAMAIS donner l'avant/après.
- Vaut aussi pour les nouvelles énigmes annoncées : OK de teaser le THÈME ("32 nouvelles énigmes sur la Grèce antique"), mais NE PAS lister les sujets précis si ces sujets sont les réponses (ex: ne pas écrire "des énigmes sur Hannibal, Marathon, Hécate" si ce sont les answers).
- Si je dois mentionner un sujet précis dans un contenu marketing, demander d'abord à Uriel si c'est une réponse d'énigme.
- Cette classe d'erreur peut se reproduire dans n'importe quel contenu public futur — vigilance permanente.

## Pas de section "Sous le capot" dans les changelogs user-facing

Dans `apps/explore-web/CHANGELOG.md` (lu par les users via VersionBadge en bas à droite de la carte), **ne jamais ajouter de section "Sous le capot" / "Détails techniques" / liste de migrations / refactors / composants extraits**. Les users ne le lisent pas, c'est juste du bruit qui dilue le message UX.

**Why:** Uriel a flaggé le 10 mai 2026 après V0.7.8 home-mobile-hub où j'avais détaillé toute la stack technique (composants partagés, routing platform-aware, lazy loading...). Pour les users c'est illisible et ça leur donne l'impression qu'on parle pour les devs.

**How to apply:**
- Changelog user-facing = uniquement les sections narratives par feature (titre + 1-2 paragraphes en français accessible, ton voie 3 RdC)
- Détails techniques (migrations, refactors, helpers extraits, conventions partagées) = dans le **commit message** ou la **PR description**, pas dans le changelog
- Si on a vraiment besoin de tracer côté dev, faire un fichier séparé `CHANGELOG_TECH.md` (pas user-facing)
- Vérifier le draft avant commit : si une section commence par "Sous le capot" ou liste des paths de fichiers / noms de composants → la supprimer

## V0.7 carte — privilégier le visuel HUMAIN (nom veilleur) au TRIBAL (emblème faction)

Décision Uriel (1er mai 2026, après plusieurs itérations design carte).

**Why:** Quand les emblèmes faction sont posés sur chaque lieu de la carte, le réflexe instinctif devient "ma tribu doit dominer telle région" — Uriel l'a ressenti lui-même : "j'ai envie d'aller rétamer toute la faction celtique parce qu'elle prend trop de place". C'est exactement le frein V0.5 qu'on voulait dépasser avec le pivot V0.7 ("la PERSONNE veille le lieu, pas la faction"). Les emblèmes carte sapent cet objectif.

À l'inverse, afficher le **nom du veilleur** sur le lieu humanise — on lit "Kelpie veille ce lieu" et la rivalité devient inter-individuelle ("je vais le supplanter pour le fun") au lieu de tribale ("éliminer les Celtes").

**How to apply:**

- Toute future feature visuelle de la carte qui exprime "qui possède ce lieu" doit privilégier l'**identité personnelle** (nom du joueur, monogramme, signature) plutôt que l'**identité tribale** (emblème faction, drapeau, pattern).
- Les emblèmes faction restent acceptables uniquement dans des **vues stratèges optionnelles** (toggle "Héritages") où l'utilisateur veut explicitement la lecture par faction.
- Pour le mode default, la carte doit rester épurée. La couleur subtile de territoire (info de fond) suffit comme indication faction passive — pas besoin de la crier visuellement.

**Itérations rejetées explicitement** (ne pas y revenir sans bonne raison) :
- Avatars photo carte → laids, perf, redondance expedition
- Emblème faction par lieu → tribal
- Composite avatar + emblème → "an 2000"
- Facepile d'avatars (3 ronds + nom) → trop chargé en zone dense

**Vainqueur final** : pilule sépia parchemin sous le lieu, **nom du veilleur en uppercase brun encre**, badge "+N" si expedition. Visible uniquement en mode "Héritages" (toggle ON). Mode OFF par défaut = carte vraiment épurée.

**Cohérent ligne éditoriale Voie 3** (chevalier errant, signature manuscrite, sublime allemand). Le nom posé sur le lieu = la marque du marcheur, pas la bannière de la légion.

## Direction éditoriale et artistique

L'histoire est la vraie fantaisie. Elle a existé, c'est notre monde mais différent — plein de couleurs, d'inconnus, de choses incroyables. La fantaisie n'est que l'œuvre de l'imagination ; l'histoire, elle, EST arrivée. Et c'est ça qui la rend plus puissante.

**Mission :** Montrer que l'histoire est plus cool, plus tendance que la fantaisie. Déringardiser l'histoire, la rendre ludique et inspirante. Comme une "Histoire naturelle" de Pline l'Ancien — un livre qui donne envie d'explorer le monde réel.

**Ligne éditoriale :** Bonapartiste.
- Droite forte, patriote, civilisationnelle
- JAMAIS extrémiste, royaliste partisane, ou prenant parti pour une vision de l'histoire contre une autre
- Valeurs du Bon, du Beau et du Grand (Platon)
- Respect de tous les peuples et toutes les cultures — la vraie droite célèbre la diversité des civilisations
- Enrichissement mutuel entre cultures (esprit du discours de Napoléon III au Mont-Saint-Michel)
- Inspire les gens à se réveiller, à redevenir le meilleur d'eux-mêmes

**Application aux énigmes :**
- Les very_easy et easy = storytelling interactif, pas des questions d'examen
- Le lore_text pose l'ambiance comme un roman d'aventure
- L'explication récompense avec un fait fascinant qui donne envie d'en savoir plus
- Le joueur doit se sentir enrichi et inspiré, jamais humilié ou ennuyé
- Chaque héritage (Celte, Nordique, Romain, Byzantin) est traité avec le même respect et la même admiration

**Philosophie profonde :** Un humanisme enraciné — pas un universalisme abstrait, mais un universalisme ancré dans la conviction que chaque peuple peut atteindre la grandeur s'il cultive ses plus belles vertus. Protection et respect de toutes les civilisations. Grandeur, excellence, bonté humaine. Les vertus platoniciennes appliquées : chaque culture a son génie propre, et c'est en le cultivant qu'elle contribue au concert des civilisations. De la philosophie, pas de la politique.

**Why:** C'est la raison d'être de la marque. Chaque contenu produit (énigmes, descriptions, textes) doit porter cette vision.

**How to apply:** Avant de générer du contenu textuel (énigmes, lore, descriptions), vérifier qu'il porte cette vision : émerveillement, respect, inspiration civilisationnelle. Montrer la grandeur de chaque peuple sans hiérarchie, célébrer les vertus humaines universelles à travers le prisme de chaque héritage.

## Ton des énigmes

Sources historiques fiables uniquement. Jamais de blogs witchy, païens, wicca. Archéologie, textes anciens, historiographie sérieuse.

**Why:** Le jeu a un positionnement culturel/patrimonial sérieux. La crédibilité du contenu est non négociable.

**How to apply:** Chaque énigme doit être vérifiable. Mais on cherche l'étonnement : zones d'ombre de l'Histoire, faits méconnus, mystères non résolus, anecdotes surprenantes. On donne de la magie et du mystère au monde réel. Ligne de pensée droite/enracinée/patriote assumée, mais sans clichés du roman national. On peut être politiquement incorrect si c'est historiquement fondé. Fun > scolaire.

**Sources de référence privilégiées :**
- **Dominique Venner** — historien, vision européenne enracinée, Histoire et tradition des Européens
- **Georges Dumézil** — mythologie comparée, structure trifonctionnelle indo-européenne (prêtres/guerriers/producteurs), idéal pour les liens entre Héritages celtes, nordiques, romains, byzantins
- Sources antiques directes : César, Strabon, Pline l'Ancien, Tacite, Procope, etc.
- Archéologie récente, épigraphie, numismatique

## users.first_name vs users.display_name — toujours lire first_name

**Règle de fer pour le SQL nouveau** : `COALESCE(u.display_name, u.first_name, 'Voyageur')` quand on lit le nom d'un user dans une RPC, JAMAIS `u.display_name` seul.

**Why:** 6 mai 2026, j'ai écrit les RPCs Voyages avec `u.display_name` seul. Bug : la colonne est NULL pour ~tous les users (l'app n'écrit jamais dedans). Côté front, l'auth lit `userData.first_name` (cf. `apps/explore-web/src/hooks/usePlayer.ts:91`). Donc `first_name` est la source de vérité de fait. Bug latent dans 50 migrations V0.7 (Coupe, Cour, plantage, leaderboards) : leurs RPCs renvoient des noms NULL en silence depuis des semaines, mais les composants ont des fallbacks (`?? 'Voyageur'` ou similaire) qui masquent le problème.

**How to apply:**
- Toute nouvelle RPC SQL qui retourne un nom user → `COALESCE(u.display_name, u.first_name, 'Voyageur')`
- Tout patch d'une RPC existante (CREATE OR REPLACE) → ajouter le COALESCE en passant
- Frontend : continuer à utiliser `userData.first_name` pour l'auth/UI. Pour les payloads RPC qui renvoient `display_name`, c'est désormais correct car le SQL coalesce.
- **Cleanup planifié** (à inscrire dans `docs/db/tech-debt.md` D2) : à terme, drop `users.first_name` (la colonne historique) après avoir backfillé `display_name = COALESCE(display_name, first_name)` partout. Mais ça demande de refondre 50 migrations + 19 fichiers TS — c'est une journée de refacto. À traiter dans un sprint dédié.

**Backfill défensif déjà appliqué** (mig 117, 6 mai soir) :
```sql
UPDATE users SET display_name = first_name WHERE display_name IS NULL AND first_name IS NOT NULL;
```
Ça résout immédiatement le problème pour TOUTES les RPCs V0.7 (pas que Voyages). Mais la règle COALESCE reste obligatoire pour les futurs users qui n'ont qu'un first_name à l'inscription.

## feedback_purification_neutraliser_pas_supprimer

**Purifier les factions ≠ supprimer les éléments. On GARDE les structures visuelles (zones de territoire, barre d'investissement Couronnes de la Cour, marqueurs, etc.) et on NEUTRALISE seulement la couleur / le sens de camp** → gris/neutre à la place de la couleur de faction.

**Why :** le 23/06/2026, pendant l'implémentation de la purification (MAJ 1.0 classes), les subagents ont *supprimé* la couche de territoire (zones math autour des clusters) et `CourtTensionBar` (la barre montrant l'investissement Couronnes défenseur vs challengers). Uriel les voulait **conservées en gris/neutre**. Mon spec disait « carte totalement neutre (ni zones) » → mauvaise calibration. Le vrai principe = **dé-colorer, pas effacer**.

**How to apply :**
- Zones de territoire : restent affichées, rendues **en gris** (neutre), pas supprimées.
- Barre d'investissement Cour (`CourtTensionBar`) : reste, on retire juste la couleur de faction (avatars/segments neutres ; le rouge "attaque" / doré "défense" sont des couleurs de RÔLE, OK à garder).
- Exception légitime (supprimées, validé Uriel) : le **scoreboard Coupe (FactionBar)** et toute la **présence Coupe** (compétition entre camps) → ça, oui, table rase.
- Distinction clé : structure d'**affichage/identité** → garder neutralisé ; surface de **compétition entre camps** → supprimer.

Lié à [[project_maj_1_0_refonte_identite]].
