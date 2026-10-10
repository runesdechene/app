# La frise des époques — conception

> 10/10/2026 · V2 (`apps/web-v2`), paquet `packages/calendrier`, base (migration 477) · maquette Figma
> 539:542 et suivantes (« Carte — frise ouverte », PC et téléphone) · décision dans le `_État.md`
> d'Explore (Tranché, 10/10) · suite du choix du calendrier (`2026-10-09-choix-du-calendrier-design.md`)

## Pourquoi

Depuis le choix du calendrier, les dates des énigmes et des fiches suivent le calendrier du joueur, mais
le filtre des époques de la carte reste une liste de boutons dont un nom porte une année chrétienne
(« Monde post-1945 »). Uriel veut à la place une **frise** : on y choisit une plage, de l'une à l'autre
époque, et la carte ne garde que les lieux de cette plage.

## Ce que voit le joueur

- Sur la carte, à côté du bouton des filtres, un **bouton sablier** de même forme (48 × 48, mêmes bord et
  fond). Sur téléphone, la recherche raccourcit pour lui faire place.
- La frise est **repliée par défaut**. Le sablier l'ouvre en **bande posée sur la carte** et la referme.
  Ouverte, elle reste ouverte jusqu'à ce qu'on la referme ; on peut déplacer la carte et ouvrir un lieu
  pendant ce temps. Le sablier est **à l'encre** tant que la frise est ouverte **ou** qu'une plage est
  choisie : c'est le seul rappel d'un filtre quand la frise est repliée (pas de gélule, Uriel, 10/10).
- Pareil sur PC et sur téléphone. Sur PC, la bande est centrée en bas de la partie carte ; sur téléphone,
  elle se pose au-dessus de la barre du bas. La rose des vents, « Ma position » et le « + » s'effacent
  tant qu'elle est ouverte (le « + » serait recouvert par la bande).
- La bande :
  - en tête, la plage en clair — « Haut Moyen Âge → Renaissance » — et dessous « de 1229 à 2353 — en
    années depuis la fondation de Rome » ; au repos, « Toutes les époques » et « Glisse les poignées pour
    remonter le temps » ;
  - **une case de même largeur par époque datée**, dans l'ordre des époques ; les cases de la plage à
    l'encre, les autres en sable. Sur PC le nom de l'époque est écrit dans sa case ; sur téléphone
    (≈ 29 px par case) il n'y tient pas, « Préhistoire » et « Ère digitale » marquent les deux bouts ;
  - **deux poignées**, une à chaque bout de la plage, l'année de la borne écrite sous chacune ; une
    borne ouverte (le début de la Préhistoire, la fin de l'Ère digitale) n'a pas d'année ;
  - hors du repos, un lien « Tout » remet la frise au repos (sur PC comme sur téléphone).
- Au repos (les deux poignées aux deux bouts), rien n'est filtré.
- La plage choisie ne survit pas à la fermeture de l'onglet, comme les autres filtres aujourd'hui.
- Sans compte (vitrine) : ni sablier ni frise, comme le bouton des filtres.

## Les époques sur la frise

Les époques viennent de la table `eras` (`year_start`, `year_end`, `sort_order`). La frise montre celles
qui ont au moins une borne : les onze de la Préhistoire à l'Ère digitale. « Indéfinie » (`unknown`) et
« Non concerné » (`not-applicable`) n'y sont pas.

**Le filtre ne change pas de nature.** Aujourd'hui `Filtres.epoques` est l'ensemble des époques retenues
et un lieu passe si son époque en fait partie (`filtrer`, `lib/filtres.ts`). La frise remplit ce même
ensemble avec les époques de la plage, de l'une à l'autre. Au repos, l'ensemble est vide : rien n'est
filtré. Une plage resserrée cache donc les lieux sans époque, « Indéfinie » et « Non concerné » (Uriel,
10/10) : ils ne sont jamais dans l'ensemble. `filtrer`, `filtresActifs` et le compte « Voir les N lieux »
restent tels quels.

Un lieu qui a une année exacte (216 sur 3 505) a aussi une époque : la frise ne regarde que l'époque.

## Les années des bornes

Une borne est le `year_start` de l'époque qui suit (ou le `year_end` de la dernière de la plage), écrite
**courte** dans le calendrier du joueur, le nom du calendrier une seule fois dans la phrase d'en-tête.

Nouveau dans `@runes/calendrier` :
- `anneeCourte(annee, calendrier)` : le nombre seul après le début du compte, suivi de « av. » avant —
  chrétien et moderne : `476`, `3300 av.` ; Rome : `1229`, `447 av.` ; Constantinople : `523 av.`, et
  `0` pour 1453. Même calcul que `anneeEnClair` (année astronomique, pas d'an zéro).
- `compteDuCalendrier(calendrier)` : la fin de phrase d'en-tête — « avant et après J.-C. », « avant et
  pendant l'ère commune », « en années depuis la fondation de Rome », « en années depuis la chute de
  Constantinople ».

Exemples, Haut Moyen Âge → Renaissance (476 → 1600) : chrétien « de 476 à 1600 — avant et après J.-C. » ;
Rome « de 1229 à 2353 — en années depuis la fondation de Rome ».

## La base — migration 477

- `UPDATE eras SET name = 'Après-guerre mondiale' WHERE id = 'post-1945'` : le nom d'une période ne se
  convertit pas, il ne doit donc porter aucune année. L'identifiant et les 100 lieux ne bougent pas ; le
  nouveau nom apparaît partout où l'époque est nommée (fiche d'un lieu, Hub).
- `filtres_de_carte()` : chaque époque renvoie en plus `debut` (`year_start`) et `fin` (`year_end`).
  Réécrite depuis sa définition **live**, copiée entière (dernière version : mig 396). Le thème Shopify
  ne l'appelle pas.

## Le code

- `features/carte/components/FriseDesEpoques/` (`.tsx`, `.module.css`, test) : la bande. Props : les
  époques datées, l'ensemble choisi, `onChoix(ensemble)`. Elle lit `useCalendrier()`. Les deux poignées
  sont **deux `<input type="range">` natifs** superposés sur la piste (pas de bibliothèque : l'outil
  standard, le clavier et les lecteurs d'écran gratuits) ; une poignée ne peut pas dépasser l'autre.
- `features/carte/lib/frise.ts` (pur, testé) : de la plage (deux rangs) à l'ensemble des époques et
  retour, la phrase d'en-tête, les bornes.
- `CarteScreen.tsx` : le sablier à côté du bouton des filtres, `friseOuverte` (un `useState`), la bande ;
  les époques par `useFiltresDeCarte` (aujourd'hui lu à l'ouverture de la feuille : il le sera aussi à
  l'ouverture de la frise).
- `FiltreFeuille.tsx` : la rubrique « Époques » disparaît (code mort supprimé dans le même commit) ;
  « Réinitialiser » remet aussi la frise au repos, puisqu'il vide `Filtres`.
- L'icône du sablier : un SVG dans les icônes de la carte, dessiné comme dans la maquette.
- La page DA (`/da`) ne la montre pas : elle ne porte que les briques de `shared/ui`, et la frise
  appartient à la carte.

## Ne change pas

Le choix d'une époque à l'ajout et à la modification d'un lieu (ses propres boutons) ; les natures et
« Ma progression » dans la feuille des filtres ; la vitrine.

## Tests et vérification

- `packages/calendrier` : `anneeCourte` dans les quatre calendriers (476, −3300, 1453, 1 av. J.-C.) ;
  `compteDuCalendrier`.
- `frise.test.ts` : la plage au repos donne l'ensemble vide ; une plage d'une seule époque ; les bornes
  ouvertes ; la phrase d'en-tête en chrétien et en Rome.
- `FriseDesEpoques.test.tsx` : déplacer une poignée au clavier change l'ensemble ; une poignée ne
  dépasse pas l'autre ; « Tout » remet au repos.
- `filtres.test.ts` : un lieu « Non concerné » est caché par une plage resserrée.
- Après la 477, en prod : le nom de `post-1945`, `filtres_de_carte()` renvoie `debut` et `fin`.
- Dans le navigateur, sur PC et en largeur téléphone : ouvrir la frise, resserrer la plage, voir les lieux
  disparaître en direct, refermer (le sablier reste à l'encre), « Réinitialiser » dans les filtres ; passer
  en calendrier de Rome et voir les bornes changer.

## La date du jour (Uriel, 11/10)

La date du jour s'écrit dans le calendrier du joueur, à trois endroits :
- **sur la carte, toujours** : une ligne sous le nom du territoire (« Comté de Nice »), centrée, plus
  petite et plus discrète que lui, à l'encre de la carte. Elle reste même quand le nom s'efface
  (au-dessus de la mer) ; membres seulement, pas la vitrine ;
- **dans la frise**, en tête de bande : « Aujourd'hui · 11 octobre 2779 ap. la fondation de Rome » ;
- **dans le choix du calendrier** (Préférences et onboarding, `ChoixDuCalendrier`) : sous l'explication
  de chaque calendrier, « Aujourd'hui : 11 octobre 2779 ap. la fondation de Rome » — on voit ce que
  donne chaque choix avant de le prendre.

Le jour et le mois ne changent pas (« 1er » pour le premier du mois) ; l'année passe par
`anneeEnClair` (chrétien « 11 octobre 2026 », moderne « 11 octobre 2026 », Constantinople
« 11 octobre 573 ap. la chute de Constantinople »). Nouveau dans `@runes/calendrier` :
`dateEnClair(date: Date, calendrier)` — pure, la date passée en argument (testable), lue dans le fuseau
de l'appareil.
