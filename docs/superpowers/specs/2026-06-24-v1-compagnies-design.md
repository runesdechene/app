# SPEC 2 — Les Compagnies (refonte identité V1.0)

> Deuxième brique de la campagne **MAJ 1.0** (Mouvement > Compagnie > Classe).
> Socle : `LA CITADELLE/📱 L'application (La Carte)/🌳 SPEC — Le Mouvement, les Compagnies & les Classes (refonte identité V1.0).md`
> Précédent : `2026-06-23-v1-classes-chevaliers-errants-design.md` (SPEC 1, figée).
> Brainstormé le 24 juin 2026 — Uriel + XO. Branche `v1-refonte-identite`.

## À retenir (30 sec)

La **Compagnie** est une **micro-faction que les joueurs créent et rejoignent** pour jouer ensemble : un **chat propre**, un **score à la Coupe**, et la capacité de **prendre des lieux et des zones en groupe**, sous une **couleur + un emblème** sur la carte. Elle est **persistante** entre saisons. C'est l'entité compétitrice de la saison (le rôle qu'avaient à tort les Maisons).

Sa singularité de design : **la hiérarchie interne est organique**. Personne ne nomme d'officiers — on **monte les échelons par ses actes** (territoire tenu + présence), et chaque échelon **débloque un pouvoir**. Un rang se **tient**, il ne se garde pas : il s'érode si on devient inactif. Le Fondateur n'a aucun privilège permanent — juste une **avance de départ** proportionnelle aux Couronnes qu'il a investies pour fonder.

## Ce que la Compagnie n'est PAS

- **≠ Expédition / Voyage.** Une Expédition, c'est plusieurs joueurs — **peu importe leur Compagnie** — qui se retrouvent **physiquement (GPS) sur un même lieu** et se groupent le temps d'une sortie. Éphémère, géographique, cross-Compagnie. Aucun recouvrement avec la Compagnie (persistante, identitaire). Les deux coexistent sans se toucher.
- **≠ Classe.** La Classe (ex-Maison) est une identité **perso** (type d'explorateur). La Compagnie est un **collectif**. Un membre garde sa Classe en rejoignant n'importe quelle Compagnie ; une Compagnie mélange librement les Classes (et c'est désirable — synergies de classes, vision post-1.0 du socle).

---

## 1. Appartenance

- **Exclusive : un joueur appartient à au plus UNE Compagnie à la fois.** Identité forte, rivalité lisible, score non dilué. (Contrainte data : `company_members.user_id` unique.)
- **Rejoindre = ouvert à tous, en un clic.** Pas de validation de candidature. La porte est ouverte ; la sélection se fait, si besoin, par l'exclusion (échelon Capitaine, cf. §3).
- **Quitter = libre, à tout moment.** En partant :
  - le **territoire** que le joueur avait pris **reste à la Compagnie** (le territoire est attaché à la Compagnie, pas au membre — cf. spec Territoire) ;
  - sa **valeur de service** pour cette Compagnie est **perdue** (repart de zéro s'il revient ou rejoint ailleurs).
- **Le solo reste un jeu complet** (garde-fou cold-start du socle) : un joueur sans Compagnie plante, tient du territoire sous sa **bannière perso**, grimpe le classement solo, gagne des médailles. La Compagnie amplifie, ne conditionne jamais.

## 2. Fondation

- **Fonder coûte des Couronnes.** C'est le débouché clair qui manquait à la monnaie, et un filtre anti-Compagnies-fantômes. La dépense **n'est pas perdue** : elle se convertit en **avance de valeur de service** pour le fondateur (cf. §3).
  - *Montant par défaut : 150 Couronnes* — molette d'équilibrage, valeur finale calée à l'implémentation contre le taux de gain courant (cap 15/j → ~10 jours d'effort, significatif mais atteignable).
- Au moment de fonder, le joueur choisit l'**identité** de la Compagnie (cf. §4).
- Fonder une Compagnie **fait quitter** l'éventuelle Compagnie courante (appartenance exclusive).

## 3. Hiérarchie organique (la singularité)

### 3.1 La valeur de service

Chaque membre porte une **valeur de service** *dans sa Compagnie courante* (remise à zéro s'il la quitte). Elle monte avec ce qu'il fait **pour la Compagnie** :

- **Tenir du territoire** sous la bannière de la Compagnie (lieux/zones pris et veillés) — le cœur.
- **Activité / présence** : planter, résoudre des énigmes, visiter en GPS, être actif. Récompense les piliers présents même sans gros territoire.

> Volontairement **exclus** du calcul : verser au trésor / dépenser des Couronnes (le pouvoir ne s'achète pas) et recruter (pas d'ingénierie sociale). Le rang s'arrime à la **boucle de jeu**.

**Érosion douce** : la valeur de service **décroît lentement pendant l'inactivité** (vers un plancher). Le territoire tenu y contribue tant qu'il est tenu ; la présence se mesure sur une fenêtre récente. On **tient** son rang en restant actif, on ne le **garde** pas en dormant. (Taux d'érosion = molette d'équilibrage.)

### 3.2 Les échelons

Les échelons sont des **seuils**, pas des sièges uniques : **tous** ceux au-dessus du seuil détiennent le pouvoir correspondant. Une Compagnie active a donc **plusieurs** Porte-voix / Capitaines — un conseil mouvant des plus présents, jamais un chef unique.

| Échelon | Seuil | Pouvoirs cumulés |
|---|---|---|
| **Membre** | entrée | Plante sous la bannière, chatte, compte au score de la Coupe |
| **Porte-voix** | `T1` | + poste une **annonce / un ralliement** à toute la Compagnie ; **modère** le chat (mute, effacer) |
| **Capitaine** | `T2` | + **édite l'identité** (nom, image, couleur, description ; cf. §4) ; **exclut** un membre |

> `T1`, `T2` = seuils de valeur de service, molettes d'équilibrage. À l'implémentation : seuils relatifs (ex. percentile interne) ou absolus — tranché au plan, en gardant l'esprit « plusieurs Capitaines possibles ».

### 3.3 Le Fondateur

**Aucun privilège permanent. Pas de protection.** Le Fondateur démarre seulement avec une **avance de valeur de service** proportionnelle aux Couronnes investies à la fondation (`service_initial = k × couronnes_investies`, `k` = molette). Cette avance s'érode comme celle de tout le monde : s'il décroche, il **se fait dépasser**, et peut même être exclu par les Capitaines qui ont émergé. Méritocratie pure.

### 3.4 Exclusion & extinction

- **Exclure** (pouvoir Capitaine) = **bannissement court** : l'exclu ne peut pas re-rejoindre immédiatement (fenêtre = molette). Sans ça, la porte ouverte annulerait toute modération.
- **Pas de bouton « dissoudre ».** Cela supprime le risque de **dissolution hostile** par un grimpeur. Une Compagnie **s'éteint d'elle-même quand son dernier membre la quitte** — son nom redevient alors disponible (ou est archivé, cf. plan).

## 4. Identité

Le créateur pose les **quatre éléments** à la fondation. Ensuite, **seuls les plus influents** (échelon **Capitaine**, §3.2) peuvent les modifier.

- **Nom** : unique (insensible à la casse), requis.
- **Image** : un logo / une bannière **uploadée** par le créateur (cadre sobre cohérent RdC ; pas de blason RPG clinquant — cf. ligne UI « sobre logiciel »). ⚠️ **Bucket Supabase à créer** : `company-emblems` (public, images, taille plafonnée) — cf. §8.
- **Couleur** : identité de la Compagnie sur la carte (le *rendu* carte appartient à la spec Territoire).
- **Description (mission)** : texte libre qui dit **la mission / la raison d'être** de la Compagnie — sert au recrutement (un nouveau venu choisit une Compagnie sur sa mission). Requise mais éditable.

Édition de ces quatre éléments = pouvoir **Capitaine** uniquement (§3.2).

## 5. Le chat de Compagnie

- La Compagnie a **son chat**. Il **remplace le Dortoir** (chat de Maison), qui **disparaît** conformément au socle (« le chat d'équipe devient celui de la Compagnie »).
- Modération : mute / effacer = pouvoir **Porte-voix** ; exclusion d'un membre = pouvoir **Capitaine**.
- **Additif** : on crée le chat de Compagnie ; le chat de Maison/Dortoir est **parqué** (pas droppé pendant la campagne) — dette tracée dans `docs/db/cleanup-v1-identity.md`.

## 6. Score & territoire (frontières de spec)

- La Compagnie **a un score à la Coupe** et **prend des lieux/zones en groupe** — c'est sa raison d'être compétitive.
- **Le détail** (comment les actes des membres s'agrègent en score, recoloration de la carte par Compagnie, comptage des zones, pondération territoire→score, et surtout la **normalisation** pour qu'une grosse Compagnie ne gagne pas juste au nombre — garde-fou du socle) appartient à **SPEC 3 — Territoire & scoring**. Cette spec-ci pose seulement : *la Compagnie est l'entité qui porte ce score et ce territoire*.
- Reset de saison, médailles, fil de prestige permanent (neutre au score) : **SPEC 4 — Saison & récompenses**.

## 7. Taille

- **Pas de plafond dur** (anti-cohésion artificielle ; on n'empêche pas un crew de grandir).
- L'avantage de nombre est neutralisé **non pas par un cap**, mais par la **normalisation du score** (SPEC 3). Garde-fou du socle respecté sans brider l'auto-organisation.

---

## 8. Modèle de données (esquisse — détaillé au plan)

> Doctrine campagne : **migrations additives uniquement** (CREATE, colonnes nullable/défaut, nouvelles RPC). Zéro DROP / ALTER cassant. L'ancien monde (Maisons/factions, Dortoir) tourne sous les users pendant la bascule.

- `companies` — `id`, `name` (unique, citext), `image_url` (vers le bucket), `color`, `description`, `founder_user_id`, `created_at`. Les 4 éléments d'identité sont éditables par les Capitaines. Le coût de fondation est **débité une fois** à la création.
- **Bucket Supabase `company-emblems`** (public, type image, taille plafonnée) — à créer. Stocke les logos/bannières uploadés.
- `company_members` — `company_id`, `user_id` (**unique** → appartenance exclusive), `joined_at`, `service_value` (numeric), échelon **dérivé** de `service_value` (vue/fonction, pas stocké).
- `company_bans` — `company_id`, `user_id`, `until` (bannissement court post-exclusion).
- Chat : nouvelle table de messages de Compagnie (réemploi du moteur de chat existant si possible ; chat de Maison parqué).
- **Valeur de service** : alimentée par les événements territoire + présence (RPC/trigger ou recompute périodique) et érodée dans le temps. Mécanisme exact (event-sourced vs recompute) tranché au plan.

## 9. Hors-scope (rappels)

- Rendu carte par couleur de Compagnie, agrégation/normalisation du score → **SPEC 3**.
- Reset de saison, prestige permanent, médailles, promo Shopify → **SPEC 4**.
- Synergies / compétences de Classe au sein d'une Compagnie → **vision post-1.0** (le data-model porte déjà la Classe par membre, donc calculable plus tard).
- Trésor commun de Compagnie / dépense collective de Couronnes pour grossir : évoqué au socle (« on investit les Couronnes pour faire grossir sa Compagnie »), mais **pas un moteur de rang** ici ; sa mécanique précise se cale en SPEC 3/4 si retenue.

## 10. Risques & garde-fous

- **Cold-start en faible densité** : une Compagnie s'amorce mal seul. → Le solo complet est le filet ; fonder coûte (on ne crée pas une coquille vide à la légère).
- **Revolving door** sur porte ouverte + exclusion : réglé par le **bannissement court**.
- **Capture du pouvoir / Fondateur absent** : réglé par l'**érosion** + **échelons-seuils multiples** (le pouvoir suit les présents, pas un titre figé).
- **Avantage de nombre** : réglé par la **normalisation du score** en SPEC 3, pas par un cap.
- **Dissolution hostile** : impossible — pas de bouton dissoudre, extinction seulement à 0 membre.
