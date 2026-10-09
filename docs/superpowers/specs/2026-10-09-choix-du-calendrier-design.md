# Le choix du calendrier — conception

> 09/10/2026 · V2 (`apps/web-v2`), Hub (`apps/hub`), nouveau paquet `packages/calendrier`, base
> (migrations 474-475) · pas de maquette : le style des Préférences · décision dans le `_État.md`
> d'Explore (Tranché et Écarté, 09/10) · reprend l'idée de la V1 (`2026-04-09-epoque-lieu-design.md`)

## Pourquoi

La V1 laissait choisir le calendrier des dates. L'option a été masquée le 02/05 (« peu utilisée »), puis la
V1 a quitté le dépôt. Uriel la veut de retour, et plus audacieuse : **les dates des énigmes changent aussi
avec le calendrier choisi**.

## Les quatre calendriers

| Valeur | Libellé dans les Préférences | Ligne d'explication |
|---|---|---|
| `chretien` (défaut) | Chrétien — av. / ap. J.-C. | Compté depuis la naissance de Jésus selon Denys le Petit (VIe siècle), qui s'est trompé de quelques années : les historiens la placent entre 7 et 4 av. J.-C. |
| `moderne` | Moderne — AEC / EC | Les mêmes années, sans référence religieuse : avant / de l'ère commune. |
| `rome` | Fondation de Rome | Compté depuis la fondation légendaire de Rome, en 753 av. J.-C. |
| `constantinople` | Chute de Constantinople | Compté depuis la prise de Constantinople par les Ottomans, en 1453. |

Écartés : le calendrier gaulois (aucun compte des années gaulois n'est attesté, l'« ère gauloise +800 » de
la V1 était inventée) et le calendrier impérial de la V1. Le calendrier chrétien garde la convention de
Denys : le décaler sur la « vraie » naissance serait aussi arbitraire, et nos dates divergeraient des
livres et des panneaux.

## Le réglage

- `users.calendrier text NOT NULL DEFAULT 'chretien'`, contrainte `CHECK` sur les quatre valeurs. Il suit le
  joueur d'un appareil à l'autre (la V1 le gardait dans le navigateur).
- `set_calendrier(p_calendrier text)` : `set_my_preference` ne prend que des booléens. Même forme que
  `set_title_gender` (316) : valeur inconnue → `{error}`.
- `get_my_preferences()` renvoie en plus `calendrier`. Réécrite depuis sa définition **live**, copiée entière.
- Dans *Préférences* (`PreferencesPage.tsx`) : une ligne « Calendrier » qui montre le calendrier choisi et
  ouvre les quatre choix, chacun avec sa ligne d'explication. Mise à jour optimiste, comme les
  interrupteurs (`usePreferences`).
- Sans compte (vitrine, scan) : `chretien`.

## Les règles de conversion

Une date se balise dans le texte entre accolades, écrite comme d'habitude en chrétien : `{52 av. J.-C.}`,
`{930}`, `{IIIe siècle av. J.-C.}`.

**Grammaire acceptée dans une balise**, rien d'autre :
- une année : `N`, `N av. J.-C.` ou `N ap. J.-C.` (N de 1 à 4 chiffres) ;
- un siècle : chiffres romains + `e` / `er` / `ᵉ` / `ᵉʳ` + ` siècle`, suivi ou non de ` av. J.-C.` /
  ` ap. J.-C.`.

Une balise hors grammaire (un millénaire, une faute de frappe) s'affiche **telle quelle, sans les
accolades**, dans tous les calendriers. Le Hub la signale.

**Le calcul.** On passe en année astronomique (an 1 = 1, 1 av. J.-C. = 0, 52 av. J.-C. = −51 : il n'y a
pas d'an zéro), puis :
- `rome` : `a + 753`. Résultat ≥ 1 → « N ap. la fondation de Rome » ; sinon « (1 − N) av. la fondation de
  Rome ».
- `constantinople` : `d = a − 1453`. `d > 0` → « d ap. la chute de Constantinople » ; `d < 0` → « −d av. la
  chute de Constantinople » ; `d = 0` → « l'année de la chute de Constantinople ».
- `moderne` : même nombre ; « av. J.-C. » devient « AEC », « ap. J.-C. » devient « EC », rien reste rien.
- `chretien` : **le contenu de la balise, mot pour mot.** Les textes actuels ne bougent pas.

**Un siècle** se convertit par son milieu (Uriel, 09/10) : le IIIe siècle av. J.-C. (−300 à −201) a pour
milieu −250, soit l'an 504 de Rome → « VIᵉ siècle ap. la fondation de Rome ». Le rang du siècle d'un compte
N est `ceil(N / 100)`, dans les deux sens.

| Écrit | Chrétien | Moderne | Fondation de Rome | Chute de Constantinople |
|---|---|---|---|---|
| `{52 av. J.-C.}` | 52 av. J.-C. | 52 AEC | 702 ap. la fondation de Rome | 1504 av. la chute de Constantinople |
| `{930}` | 930 | 930 | 1683 ap. la fondation de Rome | 523 av. la chute de Constantinople |
| `{IIIe siècle av. J.-C.}` | IIIe siècle av. J.-C. | IIIᵉ siècle AEC | VIᵉ siècle ap. la fondation de Rome | XVIIIᵉ siècle av. la chute de Constantinople |
| `{1515}` | 1515 | 1515 | 2268 ap. la fondation de Rome | 62 ap. la chute de Constantinople |

La V1 ajoutait 753 sans tenir compte de l'an zéro : elle se trompait d'un an sur toute date avant notre ère.

## Le paquet `packages/calendrier`

TypeScript pur, sans dépendance, testé avec Vitest. Utilisé par l'appli **et** le Hub, pour que l'aperçu
du Hub et l'appli calculent la même chose (aujourd'hui ils ne partagent aucun code).

- `type Calendrier = 'chretien' | 'moderne' | 'rome' | 'constantinople'` et les libellés du tableau.
- `dateEnClair(contenu, calendrier)` : une balise → le texte affiché.
- `texteEnClair(texte, calendrier)` : un texte entier, toutes ses balises converties.
- `balisesIncomprises(texte)` : pour l'aperçu du Hub.
- `siecleDe(annee, calendrier)` : pour la fiche d'un lieu. `romain()` et `siecle()` de
  `features/lieu/lib/faits.ts` y déménagent (plus de doublon).

## Où ça s'applique

**L'appli** — un hook `useCalendrier()` lit les préférences (`chretien` sans compte) :
- `FeuilleEnigme` : récit, question, choix du QCM. Un choix s'affiche converti, mais `onRepondre` reçoit le
  choix **tel qu'il est stocké** : `percer_enigme` compare toujours les mêmes textes, rien ne change côté
  serveur. Le repérage du bon choix après le verdict (`c === verdict.reponse`) compare aussi les textes
  stockés.
- `VerdictEnigme` : la réponse et l'explication.
- `PageCulture` : question, réponse et explication des énigmes résolues.
- `FicheLieu` (`ligneDeFaits`) : le siècle dans le calendrier choisi — « Antiquité · VIᵉ siècle ap. la
  fondation de Rome ».
- `EtapeApercu` : l'année dans le calendrier choisi.

**La saisie de l'année** à l'ajout d'un lieu (`ChampsDuLieu`) se fait **en AEC / EC** quel que soit le
calendrier choisi (Uriel, 09/10) : la case « av. J.-C. » devient « AEC ». Mêmes années, rien ne change dans
la base (négatif = avant notre ère). Pas de saisie dans les autres calendriers : convertir à la saisie,
comme la V1, multiplie les erreurs.

**Ne change pas** : le filtre d'époques de la carte (des noms,
pas d'années) ; les notifications et « Sur les chemins » (aucun texte d'énigme).

**Le Hub** :
- `FormulaireEnigme` : sous les champs, un aperçu du récit, de la question, des choix, de la réponse et de
  l'explication dans les quatre calendriers, et la liste des balises incomprises.
- Il refuse d'enregistrer une **balise dans la réponse d'une énigme libre** : personne ne taperait « 702
  ap. la fondation de Rome ». Aucune énigme libre n'a de date pour réponse aujourd'hui (vérifié le 09/10).
- `Enigmas.tsx` et `EnigmesSignalees.tsx` affichent les textes en chrétien, sans accolades.

## Les énigmes existantes

421 énigmes actives, dont ~260 contiennent un nombre, un siècle ou « J.-C. » — beaucoup de ces nombres ne
sont pas des dates (« 1 100 litres », « 62 mois », « 24 runes »). Une quinzaine de QCM ont une date pour
réponse.

1. Un script repère les candidats dans `lore_text`, `question`, `explanation`, `answer`, `choices`.
2. Tri à la main : seules les dates se balisent.
3. **Uriel relit la liste avant/après**, énigme par énigme, avant toute migration.
4. Migration 475 : chaque `UPDATE` ne touche une énigme que si ses textes sont encore ceux relus
   (`WHERE id = … AND lore_text = …`), pour ne rien écraser d'une modification faite entre-temps.

Règles du balisage :
- Dans un QCM, la réponse et le choix correspondant reçoivent **exactement** la même balise ; les autres
  choix datés aussi, pour que tous se convertissent.
- Chaque date balisée est complète : « entre 107 et 86 av. J.-C. » devient « entre {107 av. J.-C.} et {86
  av. J.-C.} ». En chrétien, la phrase s'alourdit un peu (« entre 107 av. J.-C. et 86 av. J.-C. ») ;
  accepté le 09/10 plutôt qu'une balise de fourchette.
- Les millénaires et les dates approximatives (« vers 500 ») ne se balisent que si la grammaire les
  couvre ; sinon on les laisse.

## Tests et vérification

- `packages/calendrier` : chaque ligne du tableau d'exemples, les cas limites (1 av. J.-C., 1 ap. J.-C.,
  753 et 754 av. J.-C., 1453), les siècles des deux côtés de l'an 1, une balise incomprise, un texte sans
  balise, plusieurs balises dans un texte.
- `faits.test.ts` : la ligne de faits dans les quatre calendriers.
- Après la migration 475, en prod : aucune énigme QCM dont `answer` n'est pas l'un de ses `choices` ;
  aucune balise incomprise (`texteEnClair` passé sur toutes les énigmes par un script).
- Dans le navigateur : changer de calendrier dans les Préférences, ouvrir une énigme datée (QCM et texte),
  répondre juste, voir le verdict, ouvrir une fiche de lieu datée, la page d'une culture.
