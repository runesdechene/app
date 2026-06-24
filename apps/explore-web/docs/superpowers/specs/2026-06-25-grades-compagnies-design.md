# SPEC — Grades des Compagnies

> Conçu en boucle autonome la nuit du 25 juin 2026 (XO), pendant qu'Uriel dort.
> Commande : « le meilleur système de grades pour les Compagnies — **personnalisable par les
> joueurs**, **respectueux du grade de chacun**, et qui **crée vraiment de la vie dans les compagnies** ».
> Statut : **CONVERGÉ** (4 passes de critique/raffinement, nuit du 24→25 juin). Prêt pour revue d'Uriel
> puis `writing-plans`. Aucun code écrit. Les arbitrages produit restants (libellés, calibrage, onboarding
> genre) sont listés en §7.

---

## Les 3 étoiles polaires (le cahier des charges d'Uriel)

1. **Personnalisable** — chaque Compagnie nomme ses propres grades (son identité, pas un gabarit imposé).
2. **Respectueux** — personne ne se sent rabaissé par son grade. On ne « perd » pas contre les autres.
   Le titre honore ce qu'on a donné, et reste acquis.
3. **Crée de la vie** — le système doit *produire des moments sociaux* : montées célébrées, gouvernance
   partagée, fierté affichée, raisons de revenir et d'agir ensemble.

Tout choix de design est jugé contre ces trois critères (section « Jugement » à la fin).

---

## Principe directeur (la grande idée)

**Deux étages, une seule échelle visible.**

- **Étage HONNEUR (permanent, jamais rétrogradé)** : les grades du bas et du milieu se gagnent par le
  **service à vie rendu à SA Compagnie** et **restent acquis pour toujours**. C'est le moteur de respect
  et de progression : ton titre dit tout ce que tu as donné, et personne ne te le reprend.
- **Étage CONSEIL (dynamique, méritocratique)** : les grades du sommet sont **tenus** par les membres
  **les plus actifs du moment**. Ils portent les **pouvoirs** de gouvernance. Ils tournent — un membre
  qui décroche cède sa place, sans perdre son honneur acquis. C'est le moteur de vie et d'enjeu.

> Pourquoi pas un simple classement (top 1, top 2…) ? Parce qu'un classement pur rend *la majorité*
> perdante → viole le critère 2. Pourquoi pas un pur palmarès figé ? Parce que rien ne bouge → viole le
> critère 3. Le double étage résout la tension : **on garde ce qu'on a mérité (honneur), on se dispute
> seulement la barre (gouvernance)**.

Ce système **se branche sur l'existant** (ne réinvente rien) :
- adhésion = `faction_members` ; Compagnie principale = `users.faction_id` ; allié exclu des grades.
- « service » = `_user_faction_coupe(user, compagnie, …)` (mérite gagné **sous la bannière de cette
  Compagnie**, banner-history) — déjà calculé, déjà anti-triche, déjà anti-pay-to-win (l'or ne compte pas).
- le « Chef » actuel (`_faction_chef`) devient le sommet de l'échelle (le **Seigneur / la Dame**).

---

## 1. L'échelle (5 grades)

| # | Étage | Grade par défaut (m. / f. / neutre) | Comment on l'obtient | Pouvoirs |
|---|---|---|---|---|
| 1 | Honneur | **Compagnon / Compagne / Compagnon·ne** | à l'adhésion | — |
| 2 | Honneur | **Officier / Officière / Officier·ère** | service à vie ≥ `T1` | — |
| 3 | Honneur | **Sénéchal / Sénéchale / Sénéchal·e** | service à vie ≥ `T2` | — (honneur pur — la plus haute distinction permanente) |
| 4 | Conseil | **Co-seigneur / Co-dame / Régent·e** | **top contributeurs récents** (honneur ≥ Officier) au-dessus du plancher | **annonce** à la Compagnie · **modère** le chat · **invite** · édite l'identité & les libellés |
| 5 | Conseil | **Seigneur / Dame / Souverain·e** | **le** plus haut service récent (= le Chef actuel) | + **exclut** (ban court) · arbitre |

> **Pouvoirs = Conseil uniquement.** L'honneur (1-3) est **pure distinction** (aucun pouvoir) → cohérent
> avec « un pouvoir exige du service récent » (§6) : un titre permanent ne doit jamais donner un levier
> qu'un membre dormant pourrait actionner. Le Sénéchal est la **plus haute fierté permanente** ; gouverner
> se mérite *en plus*, dans le présent.

- **Étage Honneur (1-3)** : seuils **ABSOLUS** sur le **service à vie** (`_user_faction_coupe` cumulé,
  `from=NULL`). Absolus = **tu contrôles ta montée** (elle ne dépend pas des autres) et **elle est monotone**
  → on ne redescend JAMAIS. *(Un seuil en percentile a été écarté : il ferait baisser ton grade quand
  d'autres te dépassent — rétrogradation déguisée, viole le critère 2.)* Une fois Sénéchal, Sénéchal pour
  toujours dans cette Compagnie.
- **Étage Conseil (4-5)** : **RELATIF** et **tenu**, pas gardé. = les **top contributeurs du moment**
  (service sur fenêtre glissante `W`, ~30 j) au-dessus d'un plancher **ET** d'honneur ≥ Officier (porte de
  tenure légère : ~1 semaine — un inconnu du jour 1 ne gouverne pas, mais ça reste rapide). Le relatif est *assumé* ici : le
  Conseil **doit** être rare et tournant (c'est le moteur de vie). Plusieurs Co-seigneurs (un conseil, pas
  un siège unique — SPEC 2 « plusieurs Capitaines ») ; un seul Seigneur/Dame (le sommet = le Chef actuel).
  **Anti-yo-yo** : grâce de `G` jours avant de perdre un siège (molette) — on ne flicke pas chaque nuit.
  **Accès au Conseil = automatique/organique** (top-N par les actes), **jamais par nomination** (SPEC 2 :
  « personne ne nomme d'officiers ») → zéro favoritisme, méritocratie pure.
- **Le Fondateur** démarre avec une **avance de service** proportionnelle aux Couronnes investies à la
  fondation (`k × couronnes`), qui **s'érode** comme tout le monde : aucun privilège permanent (principe
  SPEC 2). Il peut se faire dépasser. Méritocratie.
- **L'allié** (2ᵉ adhésion) : **aucun grade**, badge « Allié », hors échelle (déjà acté).

> Les seuils `T1`, `T2`, la fenêtre récente, le plancher Conseil, le nombre de Co-seigneurs et `k` sont
> des **molettes d'équilibrage** (table `app_settings`), pas des constantes gravées.

### Valeurs de départ proposées (calibrage festival = montées rapides)

Ancrées sur le barème réel (visite GPS 3, ajout 7, veille 2, photo 1, énigme ~1) → ~5-10 pts de service
un jour actif.

| Molette | Valeur de départ | Raison |
|---|---|---|
| `T1` (→ Officier·e) | **30** | atteint en ~1ʳᵉ semaine d'activité réelle → élan tôt (critère 3) |
| `T2` (→ Sénéchal·e) | **150** | ~1 mois de jeu régulier → un vrai pilier |
| `W` (fenêtre Conseil) | **30 j** | « récent » = le dernier mois |
| `G` (grâce avant perte de siège) | **7 j** | anti-yo-yo |
| plancher Conseil | **service récent ≥ 20** | il faut être *vraiment* actif pour gouverner |
| nb Co-seigneurs | **top 3** (récent, hors Seigneur) | un conseil, pas une foule |
| `k` (avance fondateur) | **× 1 sur le service RÉCENT** (50 🪙 fondation → +50 récent, qui décroît) | démarre Seigneur, mais doit tenir |

> Important : l'avance du fondateur alimente le **service récent (Conseil)**, pas l'honneur à vie — il
> *commence* au sommet mais ne *garde* rien sans agir. L'honneur (1-3) ne se gagne que par de vrais actes.
> **Grade affiché = le plus haut auquel le membre a droit** (max de l'honneur acquis et du siège Conseil tenu).

---

## 2. Personnalisation (critère 1)

Chaque Compagnie possède **ses 5 libellés**. Deux modes, pour aller vite OU se distinguer :

- **Thèmes préfabriqués** (1 clic, cohérents, genrés) — ex. *Noblesse* (Compagnon→Seigneur),
  *Confrérie* (Novice→Grand Maître), *Équipage* (Mousse→Capitaine), *Légion* (Recrue→Légat),
  *Ordre* (Postulant→Commandeur). Anti cold-start : une Compagnie a une échelle nommée dès sa création.
- **Sur-mesure** : le sommet (Seigneur/Dame) édite chaque libellé. Champs **masculin + féminin**
  (+ neutre optionnel) par grade → le gendrage custom reste possible (cf. §3).

**Qui édite ?** Pouvoir **Conseil** (grade 4-5), comme l'édition d'identité de Compagnie (cohérent SPEC 2 §4).
Stockage : `faction_grade_labels(faction_id, rank, label_m, label_f, label_n)` — 5 lignes/Compagnie, défaut
seedé au thème *Noblesse*.

---

## 3. Le gendrage (le point bloquant — résolu)

**Constat** : il n'existe **aucun champ genre** sur `users` aujourd'hui (vérifié en base). Sans lui, on ne
peut pas accorder « Officier/Officière ». Or accorder le titre **est** un acte de respect (critère 2).

**Décision** : ajouter une préférence **`users.title_gender`** (`'f' | 'm' | 'n'`, défaut `'n'` neutre).
- Posée **à l'onboarding** (« Comment veux-tu être titré·e ? ») et éditable au profil. Léger, opt-in, digne.
- Le neutre `'n'` utilise une forme épicène (« Officier·ère » ou un libellé neutre fourni par le thème).
- L'affichage du grade lit `title_gender` → choisit `label_m / label_f / label_n`.

> Bénéfice secondaire : ce champ servira **partout** (titres de classe, hauts-faits, toasts), pas seulement
> les grades. Investissement propre, réutilisable.

---

## 4. Ce qui crée la vie (critère 3 — le cœur)

Le grade ne « crée de la vie » que s'il **produit des événements sociaux**. Mécaniques retenues :

1. **La montée est un événement, pas un chiffre.** Atteindre un grade déclenche :
   - un **toast** cérémoniel pour le joueur (« Tu es désormais **Sénéchale** des *Aigles de l'Empereur* »),
   - une **ligne d'activité dans le chat de la Compagnie** (« ⚔️ Pooka est devenue Sénéchale ») → les autres
     **félicitent** → moment social gratuit et récurrent. *(C'est le levier #1 : cheap, chaud, répété.)*
2. **Gouvernance partagée = appartenance.** Le Conseil (4-5) **anime** : poster un ralliement, accueillir
   les nouveaux, modérer, éditer la mission. Donner du pouvoir aux actifs → ils s'investissent → vie.
3. **Fierté affichée.** Le grade s'affiche sous le nom dans le **Hall** et sur le **profil** (à côté du
   Niveau). **Pas sur le marqueur de carte** (la pilule sépia = nom du veilleur, FIGÉE — on n'y touche pas ;
   + sobriété). Un titre qu'on **voit** est un titre qu'on **veut**.
4. **Le mur d'accueil.** Quand un Compagnon rejoint, un membre du Conseil reçoit une invite douce à lui
   souhaiter la bienvenue dans le chat. Rituel d'entrée = rétention (boussole : lien > tribal).
5. **L'objectif toujours visible.** Dans le Hall, une fine barre « prochain grade dans X » : il y a
   **toujours une marche au-dessus** → raison de replanter, résoudre, tenir du territoire **sous la bannière**.

> Note anti-RPG (feedback UI sobre) : tout ça reste **typographique et sobre** — un mot, une couleur de
> Compagnie, jamais un blason clinquant ni du cuir clouté. L'épique est dans le **mot** et le **rituel**,
> pas dans le pixel.

---

## 5. Respect — les garde-fous (critère 2)

- **Aucune rétrogradation d'honneur.** Les grades 1-3 ne baissent jamais. Tu ne « perds » jamais ton titre.
- **Pas de grade humiliant.** Le grade d'entrée est **Compagnon** (digne), pas « Bleu / Recrue / Rang 5 ».
- **Le Conseil tourne sans punir.** Perdre un siège de Co-seigneur = redescendre à son **honneur acquis**
  (ex. Sénéchal), jamais plus bas. On ne tombe pas, on **revient à ce qu'on a mérité**.
- **On annonce les MONTÉES, jamais les descentes.** Le toast + la ligne de chat ne se déclenchent qu'à la
  *promotion*. Perdre un siège de Conseil est **silencieux** — aucune humiliation publique. (Règle dure :
  l'événement social est une célébration, jamais une exposition.)
- **Le sommet n'écrase pas.** Plusieurs Co-seigneurs (conseil), pas un dictateur ; le Seigneur arbitre,
  il ne possède pas. Le Fondateur n'a aucun privilège de sang.
- **Choix du titre genré** = respect de la personne, pas une case par défaut imposée.

---

## 6. Technique (esquisse solide — détails fins au plan d'implémentation)

- **Service à vie** (honneur 1-3) : `_user_faction_coupe(u, f, NULL, NULL)` → seuils `T1/T2`. Monotone.
- **Service récent** (conseil 4-5) : `_user_faction_coupe(u, f, now()-W, now())` → classement intra-Compagnie,
  plancher + top-N. `W` = fenêtre (molette). *(Réutilise la fonction existante, juste d'autres bornes.)*
- **Calcul du grade** : un helper `_member_grade(u, f) → rank int (1..5)` + `get_faction_detail` renvoie
  `gradeRank` + `gradeLabel` (résolu via `faction_grade_labels` × `title_gender`) par membre.
- **Tables** : `faction_grade_labels` (libellés/Compagnie), `users.title_gender`,
  `faction_members.honor_rank` (int 1-3, **cache monotone** du plus haut honneur atteint). **Additif**.
- **Détection de montée (anti-spam, sans trigger lourd)** : `honor_rank` est un **plafond cliqueté**. À
  chaque action qui rapporte du service, on recalcule le service à vie, on en déduit le rang-seuil ; si
  `nouveau > honor_rank`, on **met à jour** `honor_rank` ET on émet l'événement (toast + ligne chat) — sinon
  rien. Un seuil ne se franchit donc qu'**une fois**, et on ne peut jamais le perdre (monotone). Le Conseil
  (4-5), lui, n'est **pas** caché : recalculé à la volée (top-N récent) à l'affichage / à l'exercice d'un
  pouvoir. *(Pas de cron obligatoire ; le grade Conseil « expire » naturellement faute de service récent.)*
- **Pouvoirs** : gating serveur sur le grade calculé ≥ seuil dans les RPC concernées (annonce, invite,
  exclude, édition identité, modération chat — étendre le modèle RLS/RPC déjà en place). Un pouvoir Conseil
  exige un grade Conseil **au moment de l'action** (donc service récent réel — pas un titre dormant).
- **Allié** : `_member_grade` renvoie NULL si `users.faction_id <> f` (déjà la frontière isAlly).
- **Ligne de chat à la montée** : faisable — précédent existant, les messages « système » (`user_name`
  = *Les Dieux*) sont déjà postés dans un canal (`ChatPanel`). Ici, émission **serveur** (SECURITY DEFINER,
  bypass RLS) dans le canal `chat_messages` `channel = faction_id`, auteur stylé « héraut » / nom de la
  Compagnie. → moment social sans nouvelle infra.
- **Caveat data** : `faction_banner_history` n'existe que **depuis le 24/06** (mig 288). Le « service à
  vie » est donc *de facto* compté depuis cette date — acceptable (go-forward), à mentionner si un ancien
  s'étonne d'un grade bas. Pas de rétro-attribution avant l'historique.

---

## 7. Jugement final contre les 3 étoiles

| Critère | Verdict | Comment c'est tenu |
|---|---|---|
| **Personnalisable** | ✅ | thèmes 1-clic OU libellés sur-mesure genrés, édités par le Conseil |
| **Respectueux** | ✅ | honneur **permanent** (jamais rétrogradé) · grade d'entrée digne (Compagnon) · genre **choisi** · descentes **silencieuses** · perdre un siège = revenir à son honneur, pas tomber |
| **Crée la vie** | ✅ | montées **célébrées dans le chat** (levier #1) · gouvernance partagée aux actifs · fierté affichée Hall/profil · accueil des nouveaux · barre « prochain grade » toujours visible · `T1` bas = élan dès la 1ʳᵉ semaine |

### Décisions tranchées (itération 2)
1. **5 grades** — conservés (collent à la mémoire d'Uriel : Officier·e / Sénéchal / Co-seigneur / Seigneur·Dame
   + Compagnon à l'entrée). Lisible : 3 honneur + 2 conseil.
2. **Affichage = Hall + profil uniquement, PAS le marqueur de carte.** Respecte la pilule sépia FIGÉE
   (nom du veilleur, ne pas y toucher) + la sobriété. Le grade se découvre dans le Hall et le profil.
3. **Conseil (4-5) = relatif top-N sur fenêtre `W`~30 j + grâce `G` jours** (anti-yo-yo). Molettes.
4. **Honneur (1-3) = seuils ABSOLUS** (jamais percentile) → contrôle + non-rétrogradation. **`T1` bas**
   (atteignable en ~1ʳᵉ semaine d'activité réelle) pour de l'élan tôt. Molettes.
5. **Coupe ⟷ Grade = même carburant, deux compteurs.** Un seul effort (énigmes/visites/veilles/ajouts/
   photos **sous ta bannière**) nourrit À LA FOIS la Coupe de ta Compagnie (compétition saisonnière) ET
   ton service personnel (ton grade). Registres distincts → pas de double compte. **Copy à soigner** :
   « Tout ce que tu fais pour ta Compagnie te fait monter en grade *et* marque à la Coupe. »
6. **Compagnies officielles RdC** (`is_official`) : **mêmes règles**, aucune exception de grade. L'admin-
   fondateur tient le sommet via l'avance de fondation comme n'importe quel fondateur ; il peut se faire
   dépasser. (Cohérent avec « pas de privilège de sang ».)
7. **Promotions célébrées, descentes silencieuses** (règle dure §5). **Accès Conseil organique**, jamais
   par nomination.

### Ce qui reste à décider AVEC Uriel (3 arbitrages produit, pas des trous techniques)
1. **Les libellés par défaut** : je propose le thème *Noblesse* (Compagnon → Officier·e → Sénéchal·e →
   Co-seigneur/Co-dame → Seigneur/Dame). À valider/retoucher — c'est ton vocabulaire d'origine.
2. **Calibrage des molettes** : valeurs de départ proposées (§1bis) à valider — agressif (festival, montées
   rapides) vs posé.
3. **`title_gender` à l'onboarding** : OK pour ajouter la question « comment veux-tu être titré·e ? » au
   parcours d'entrée (m./f./neutre) ? C'est la clé du gendrage.

### Prochaine étape
Spec prête. À ton GO → `writing-plans` pour découper l'implémentation en lots
(1. `title_gender` + résolution libellés · 2. honor_rank + seuils + toast de montée · 3. Conseil + pouvoirs
· 4. personnalisation des libellés · 5. UI Hall/profil). **Aucun code avant ton feu vert.**

---

## Verdict (XO)

Système **convergé**. Il coche tes 3 étoiles sans rien réinventer (il s'assoit sur `_user_faction_coupe`,
banner-history, le Chef existant). La grande idée à retenir en une phrase :

> **On garde pour toujours l'honneur qu'on a mérité (respect) ; on ne se dispute que la barre du pouvoir,
> entre les plus actifs du moment (vie) ; et chaque Compagnie nomme son échelle (identité).**

Le point qui demande vraiment ta main : **les libellés et le calibrage** — le reste est tranché.
