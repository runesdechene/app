# Les Compagnies — conception

> 05/10/2026 · V2 (`apps/web-v2`) · maquettes Figma « Compagnies — 1 à 8 » (fichier App v2, nœuds 393:236,
> 389:309, 393:285, 390:258, 390:327, 396:236, 396:326, 396:404) · décisions dans le `_État.md` d'Explore (Tranché, 05/10)

## Pourquoi

C'est la dernière pièce avant de remplacer la V1, et la communauté la demande. Les gens créent d'eux-mêmes
des **antennes locales** : la Compagnie V2 leur donne une maison, sans le PvP de la V1 (territoires, Coupe,
Couronnes, grades à pouvoirs). « Les joueurs veulent moins de PvP et plus d'entraide, mais aiment le côté
revendiquer » (Uriel).

## Ce qu'est une Compagnie

- **Une fiche** : avatar, nom (unique), **couleur**, **devise** (une phrase qui la présente dans les listes,
  80 signes — Uriel, 05/10), **mission** (la description, un seul champ),
  **publique ou privée**, date de fondation.
- **Un canal** : un canal de **La Communauté** (le Registre), comme « Bugs & suggestions », réservé à ses
  membres.
- **Des membres** : on rejoint **autant de Compagnies qu'on veut** ; on part quand on veut.
- **Deux rôles nommés par la Compagnie**, chacun en **forme masculine et féminine** :
  - **le Chef** (par défaut « Chef / Cheffe ») : nomme et retire les officiers, nomme les rôles, **passe la
    main** à un membre qui devient Chef à sa place (lui devient officier) ;
  - **les Officiers** (par défaut « Officier / Officière ») : modifient la fiche, acceptent les demandes,
    retirent un membre ;
  - les autres sont « Membre ». Pas de titre libre par membre.
  - Chacun voit son rôle accordé selon « Tes titres s'accordent au » (profil, `users.title_gender`).
  - Sans Chef (compte supprimé) : l'officier le plus ancien reprend, sinon le membre le plus ancien.
- **Fonder** : réservé aux **Porteurs** (au moins un Fragment visible dans `user_fragments`, la règle de
  `porteurVerifie`). Pas de coût.
- **Rejoindre** : publique → « Rejoindre » ; privée → « Demander à rejoindre » (un mot facultatif), un
  officier accepte ou refuse. Le canal d'une Compagnie privée est invisible aux non-membres.
- **Revendiquer** reste personnel (ou au nom d'une expédition) : la fenêtre propose « **Pour une Compagnie
  (facultatif)** » parmi les miennes. La fiche du lieu dit « · pour Le Lys de Fer », la fiche de la
  Compagnie liste « Leurs lieux ». **Rien sur la carte** : la pilule garde le nom de la personne ou de
  l'expédition (règle « le visuel humain, pas le tribal », `.claude/rules/interface.md`).
- **Ce qu'il n'y a pas** : territoire, couleur de Compagnie sur la carte, classement, Couronnes, Coupe,
  bonus, grades à pouvoirs, création ouverte à tous.

## Les écrans (maquettes validées le 05/10)

1. **La Communauté** (`MessagesScreen` → `Registre`) : chaque Compagnie dont je suis membre est **une gélule
   à sa couleur** après « Canal général » et « Bugs & suggestions », cochable comme elles (choix gardé,
   `lib/filtres.ts`) ; ses messages portent « [Le Lys de Fer] » et s'écrivent **à son encre** ; le sélecteur
   du champ propose mes Compagnies et le champ dit « Écrire au Lys de Fer… » à sa couleur ; **répondre à un
   message choisit son canal**. La rangée de gélules passe à la ligne. Au bout : « **＋ Compagnies** ».
2. **La page « Les Compagnies »** — `/<onglet>/compagnies`, ouverte par « ＋ Compagnies » (maquette 6 ;
   la feuille de la maquette 3 en est la version courte, écartée au profit de la page) : une recherche (nom,
   devise, mission) ; Mes Compagnies (rôle, nombre de membres) ; Découvrir (devise en italique, membres,
   « Privée », un bouton « Rejoindre » ou « Demander ») ; « ＋ Fonder une Compagnie ». Un non-Porteur qui
   touche « Fonder » arrive sur **« C'est réservé aux Porteurs »** (maquette 8) : ce qu'est un Porteur,
   « Découvrir la boutique › » (runesdechene.com), « Rejoindre une Compagnie », et « Déjà client ? Ton
   Fragment rejoint le compte de l'e-mail de ta commande. »
3. **La fiche d'une Compagnie** — adresse `/<onglet>/compagnie/<id>` (partageable) : bandeau à sa couleur,
   avatar, nom, sa devise à son encre, « publique/privée · fondée le … · N membres », mission ; le bouton selon mon cas
   (« Rejoindre la Compagnie », « Demander à rejoindre », « Demande envoyée », « Ouvrir le canal » — qui
   coche la gélule et ouvre La Communauté) ; le Chef et les Officiers avec leur rôle accordé ; les membres ;
   « Leurs lieux » ; « Gérer la Compagnie › » pour le Chef et les Officiers ; « Quitter la Compagnie » pour
   un membre.
4. **Gérer** — `/<onglet>/compagnie/<id>/gerer` : avatar, nom, devise, mission, couleur (une palette de huit, plus
   une couleur libre ; trop claire, elle est foncée au rendu pour rester lisible), publique/privée
   (`Segments`) ; les rôles en masculin/féminin (Chef seulement) ; les demandes (Accepter / Refuser) ; les
   membres (nommer/retirer un officier, retirer un membre) ; « Passer la main à un autre Chef… » (Chef).
5. **Fonder** — `/<onglet>/compagnie/fonder` (maquette 7) : avatar, nom, devise, mission, couleur,
   publique/privée, puis « Fonder la Compagnie » (les rôles se renomment ensuite dans « Gérer ») ; le canal s'ouvre sur un message système « La Compagnie est fondée ».
6. **Ailleurs** : la fenêtre « Revendiquer » (« Pour une Compagnie ») ; la fiche d'un lieu (« · pour … ») ;
   le profil d'un Explorateur montre ses Compagnies en gélules à leur couleur ; la cloche prévient les
   officiers d'une demande, et le demandeur quand elle est acceptée.

## Les données

On **reprend les tables de la V1** (`factions`, `faction_members`) : jusqu'à la bascule, une Compagnie existe
des deux côtés, et le canal est le même (`chat_messages.channel` = l'id de la Compagnie, comme la V1, avec
ses policies de la mig 297).

```sql
ALTER TABLE factions ADD COLUMN privee boolean NOT NULL DEFAULT false, ADD COLUMN devise text,
  ADD COLUMN chef_m text NOT NULL DEFAULT 'Chef', ADD COLUMN chef_f text NOT NULL DEFAULT 'Cheffe',
  ADD COLUMN officier_m text NOT NULL DEFAULT 'Officier', ADD COLUMN officier_f text NOT NULL DEFAULT 'Officière';
ALTER TABLE faction_members ADD COLUMN role text NOT NULL DEFAULT 'membre'
  CHECK (role IN ('chef', 'officier', 'membre'));
CREATE TABLE demandes_compagnie (faction_id, user_id, mot text, cree_le, PRIMARY KEY (faction_id, user_id));
ALTER TABLE expeditions ADD COLUMN pour_compagnie text REFERENCES factions(id) ON DELETE SET NULL;  -- l'historique (« Leurs lieux »)
ALTER TABLE place_veille ADD COLUMN pour_compagnie text REFERENCES factions(id) ON DELETE SET NULL;
```

- Nom (`title`), couleur (`color`), avatar (`image_url`, seau `faction-emblems`), mission (`description`)
  existent. Nom : 2 à 40 signes, unique sans casse ; devise : 80 signes ; mission : 500 signes ; rôles :
  30 signes. Les 8 Compagnies V1 commencent sans devise : leur Chef l'écrira.
- **Fonctions** (SECURITY DEFINER, `auth.uid()`, jamais d'id envoyé) : `compagnies()` (les miennes et les
  autres, pour la feuille), `compagnie(p_id)` (la fiche), `fonder_compagnie(...)`, `modifier_compagnie(...)`,
  `rejoindre_compagnie(p_id, p_mot)` (publique : membre ; privée : demande), `repondre_demande(p_id, p_user,
  p_oui)`, `quitter_compagnie(p_id)`, `changer_role(p_id, p_user, p_role)` (officier ↔ membre ; « chef » =
  passer la main), `retirer_membre(p_id, p_user)`. Chaque refus a son indice (`porteur`, `nom_pris`, `role`…).
- **Le Registre** : `registre(p_canaux)` accepte les ids des Compagnies dont je suis membre (refus sinon) ;
  `ecrire_au_registre` aussi ; `registre_non_lus` compte leurs messages. Chaque message rend la couleur et le
  nom de son canal.
- **Revendiquer** : `revendiquer_lieu` gagne `p_pour_compagnie` (facultatif, une Compagnie dont je suis
  membre) ; `fiche_lieu.revendication` rend `pourCompagnie {id, nom, couleur}`.
- **Notifications** : `demande_compagnie` (aux Chef et Officiers), `demande_acceptee` (au demandeur).
- **Profil** : `get_profil_explorateur` rend ses Compagnies (id, nom, couleur, avatar).

## La reprise des Compagnies V1 (une migration, une fois)

- Les **8 Compagnies actives** (non `retired`, au moins un membre) passent **publiques**.
- **Chef** : le membre `is_founder` ; sinon `created_by` s'il est membre ; sinon le plus ancien.
- **Officiers** : aucun (les grades V1 se gagnaient aux Couronnes) ; le Chef les nomme.
- **Noms des rôles** : si `faction_grade_labels` a des libellés, le rang le plus haut donne `chef_m/chef_f`,
  le suivant `officier_m/officier_f` ; sinon les défauts.
- Les 5 Compagnies retirées ne sont pas reprises (elles ne s'affichent pas).

## La cohabitation avec la V1 (jusqu'à la bascule)

- La V1 garde sa « Compagnie active » (`users.faction_id`) : rejoindre en V2 ne la change pas ; **quitter en
  V2 la Compagnie active V1 la vide** (`users.faction_id = NULL`).
- Ce que la V2 ignore (Couronnes investies, or, Coupe, bannières, bonus, grades à pouvoirs, territoires)
  reste à la V1 et va au registre de purge (`docs/v2/purge-back.md`) ; pas de DROP tant que la V1 tourne.
- `pour_compagnie` n'existe pas pour la V1.

## Erreurs

- Fonder sans être Porteur : refus `porteur`, le front ne montre pas le bouton.
- Nom pris : refus `nom_pris`, sous le champ.
- Écrire dans un canal dont on n'est plus membre : refus, le canal disparaît des gélules.
- Une Compagnie supprimée ou une demande déjà traitée : la fiche le dit, sans erreur technique.

## Tests

- SQL (`BEGIN … BILAN … ROLLBACK`) : fonder (Porteur / non-Porteur) ; rejoindre publique / privée ; accepter
  ; quitter (et `users.faction_id` vidé) ; passer la main ; un officier ne peut pas nommer de rôle ; un
  non-membre ne lit ni n'écrit le canal privé ; revendiquer « pour » une Compagnie dont on n'est pas membre
  est refusé ; la reprise des 8 Compagnies (un Chef chacune, publiques, libellés repris).
- Vitest : les gélules des Compagnies et leur encre ; répondre choisit le canal ; le rôle accordé
  (masculin/féminin) ; les états du bouton de la fiche ; « Fonder » caché aux non-Porteurs ; « Pour une
  Compagnie » dans la revendication.
- Navigateur (390 px et PC) : fonder, écrire dans le canal, rejoindre une privée avec un second compte,
  accepter, revendiquer pour la Compagnie ; comparer aux maquettes.

## Hors champ

Les événements de Compagnie, les stats communes, un mur de photos, une carte de Compagnie, les Compagnies au
Campement (même code, plus tard).
