# App V2 — la zone Compte (design)

> Statut : **validé en conversation le 27/09/2026**, à relire par Uriel.
> Fondation : `2026-09-26-v2-socle-design.md`. Référence fonctionnelle : `2026-08-18-app-v2-design.md`
> (§4 Compte, révisé ici). Sonde des données : `docs/v2/sondes/2026-09-27-compte-donnees.md`.

## 1. Ce que devient le Compte

Le Compte n'est plus un écran unique : c'est **un profil public d'Explorateur**, le même pour tout
le monde, et **un menu** ouvert par l'avatar. Quatre écrans, tous maquettés dans Figma
(fichier `MKqyVhDPreg06PMEAaDxde`) :

| Écran | Maquette | Auteur |
|---|---|---|
| Menu avatar | `89:238` « Menu Avatar » | Uriel |
| Profil public | `89:124` « COMPTE » | Uriel |
| Modifier mon profil | `91:107` « Modifier mon profil » | XO, validé par Uriel (titre de page réduit par Uriel) |
| Préférences | `91:166` « Préférences » | XO, validé par Uriel |

Le Compte porte la **fierté sociale** voulue par la V2 révisée (spec V2 §1) : niveau, titres,
parcours visible. **Aucun classement** ici : les podiums vivront ailleurs.

## 2. Les écrans et leurs adresses

Tout état navigable est une URL (décision 006) : le retour arrière ferme toujours le dernier
écran ouvert, et **aucun ne fait quitter l'app**.

| Écran | Adresse | Mobile | Desktop |
|---|---|---|---|
| Menu avatar | `/<onglet>/menu` | feuille du bas, fond assombri | feuille sous l'avatar |
| Profil public | `/<onglet>/explorateur/<id>` | plein écran | panneau à gauche |
| Modifier mon profil | `/<onglet>/explorateur/<id>/modifier` | plein écran | panneau |
| Préférences | `/<onglet>/preferences` | plein écran | panneau |

- **Le menu a une adresse** : c'est ce qui permet au bouton retour d'Android de le fermer. Il
  propose **Mon profil**, **Préférences**, **Déconnexion** (en rouge).
- **Déconnexion** : on ferme la session Supabase ; la porte d'accès (socle) voit le changement
  et renvoie vers la V1.
- **Le détail vide `/<onglet>/compte` du socle disparaît** : le menu le remplace, l'avatar
  ouvre le menu.
- `/<onglet>/explorateur/<id>/modifier` ouvert pour **un autre** que soi → redirigé vers son profil.

## 3. Le profil public

Dans l'ordre de la maquette :

1. **En-tête** : retour · titre de page · badges **« Porteur vérifié »** (au moins un fragment,
   quelle que soit sa source) et **rôle** (« Admin », « Modérateur ») s'il y a lieu.
2. **Identité** : grand avatar, nom (`COALESCE(display_name, first_name)`), **« Niveau N »**,
   titres portés en pastilles.
3. **Présentation** : bio libre (liens et `@mentions` cliquables), Instagram, « Explorateur
   depuis le … » (date d'inscription), et la ligne d'attache — **« Noble représentant des
   Alpes-Maritimes »** (France, article officiel de l'INSEE) ou **« Noble représentant · Portugal »**
   (hors France : l'INSEE ne donne pas d'article pour les pays, on n'en devine pas). « Noble » est
   une tournure de style. Pas de ligne si le joueur n'a aucune visite ou l'a masquée.
4. **Action** : sur **mon** profil, **« Modifier mon profil »** (comme Instagram) ; sur celui
   d'un autre, **« Envoyer un murmure »** — visible, mène à « bientôt » tant que la zone
   Messages n'existe pas.
5. **Ses fragments** : la grille des fragments réunis.
6. **Ses découvertes**, trois onglets **exclusifs** :

| Onglet | Contenu | Règle |
|---|---|---|
| **Ajoutés** | les lieux dont il est l'auteur (`places.author_id`) | prioritaire : un lieu ajouté n'apparaît nulle part ailleurs (on n'ajoute qu'un lieu où l'on a été) |
| **Visités** | ses visites sur place (`place_explorers`), moins ses ajouts | un lieu visité n'est plus une envie |
| **Envie d'y aller** | sa liste d'envies (`place_wishlist`), moins le reste | **publique par défaut** — c'est une invitation à grouper ; masquable dans Préférences |

Chaque onglet affiche son nombre (« Ajoutés 2 · Visités 18 »), et le même dédoublonnage.

## 4. Modifier mon profil et Préférences

**Modifier mon profil** (maquette `91:107`) : changer la photo · ton nom · ta présentation
(300 caractères, compteur visible) · ton Instagram · **tes titres portés** (deux au plus, parmi
ceux que tes fragments t'ont offerts) · **l'accord des titres** (Masculin — Chevalier /
Féminin — Chevalière) · **Enregistrer**.

**Préférences** (maquette `91:166`), trois cartes :
- **Ce qu'on t'envoie** : les nouvelles importantes · le récit de la semaine ;
- **Ta présence sur la carte** : brouiller tes pistes (50 km) · montrer ton département ·
  **montrer mes envies** (nouveau, activé par défaut — voir §3) ;
- **Ton compte** : ton adresse e-mail (c'est elle qui relie tes achats) · « Un fragment qui
  n'apparaît pas ? Envoie-nous une photo » — **le système existant** : le formulaire public de
  soumission du Hub (`hub.runesdechene.com/soumettre-contenu`), décision d'Uriel du 27/09.

## 5. Les données

### Lecture — une seule fonction

**`get_profil_explorateur(p_user_id text)`**, `SECURITY DEFINER`, `search_path` épinglé,
exécutable par `authenticated`. Elle renvoie **exactement** ce qu'un profil public a le droit
de montrer, en un aller-retour : identité, niveau, titres portés, bio, Instagram, date
d'inscription, badges, ligne d'attache, fragments, et les trois listes **déjà dédoublonnées**
(Ajoutés > Visités > Envie d'y aller ; cette dernière seulement si montrée, ou si c'est moi).
Jamais d'e-mail, jamais de position.

*Écartées :* lire les tables depuis la V2 (six requêtes, chaque colonne exposée devient un
risque — la classe de faille de `users_admin`) ; une vue (moins claire, pièges de droits).

### Ajouts au back (registre de purge, « Ajouté pour la V2 »)

1. **`places.departement` et `places.pays`** — remplis **une fois** pour les lieux existants, puis
   à chaque nouveau lieu. France : géocodage inverse de l'État (`api-adresse.data.gouv.fr`,
   gratuit). Hors France : le pays seul. **Réalisé plutôt en base par PostGIS** (contours IGN et
   Natural Earth) avec les articles officiels de l'INSEE : aucun appel externe, rattachement à
   l'insertion de chaque lieu (plan du 27/09). **Ligne d'attache** d'un joueur = le département (ou,
   à défaut, le pays) qui compte le plus de ses visites sur place.
2. **Un déclencheur** : une visite enregistrée (`place_explorers`) retire le lieu de la liste
   d'envies du joueur. Vit en base : marche aussi pour les visites faites depuis la V1. La
   migration **nettoie une fois** les envies déjà visitées.
3. **`users.show_departement` et `users.show_envies`** (booléens, vrais par défaut) et leur
   fonction d'écriture.

### Écritures — l'existant d'abord

| Besoin | Fonction |
|---|---|
| nom, bio, Instagram, avatar | `update_my_profile` (existe, vérifie `auth.uid()`) — ⚠️ écrit `first_name`, jamais `display_name` : la lecture coalesce, la dette est notée au registre |
| accord des titres | `set_title_gender(p_gender)` (existe) |
| brouiller les pistes | `set_brouiller_pistes(p_enabled)` (existe) |
| titres portés | à relever au plan (définition live) |
| notifications | à relever au plan (la V1 écrit `push_*_enabled`) — passer par une fonction |
| e-mail | `supabase.auth.updateUser` (flux de confirmation Supabase) |
| photo | bucket de stockage des avatars (à relever au plan) |

**Le niveau** se calcule depuis `xp_total` par la règle de niveaux V1 (mig 040) — la fonction
exacte est à relever au plan, **copiée depuis le live**, jamais devinée.

## 6. Hors de ce cycle

- **L'abonnement aux notifications** du téléphone reste géré par la V1 jusqu'à la bascule ; les
  interrupteurs de la V2 enregistrent le choix, que lit la fonction d'envoi.
- **Envoyer un murmure** : zone Messages.
- **Relier ceux qui ont la même envie** (« Hey, je peux te guider ! ») : graine notée.
- **Revendiquer sur place, podiums mensuels, panthéon** : avec la Carte et le Campement.
- **Couronnes et énigmes** : en sommeil (décision du 27/09).

## 7. Les cas limites (tous testés)

- joueur **sans visite** → pas de ligne d'attache ;
- lieu **hors de France** → pays, pas de département ; lieu **sans coordonnées** → aucun des deux ;
- profil **inconnu ou supprimé** → message clair et retour, jamais un écran vide ;
- un lieu **ajouté, visité et désiré** → n'apparaît qu'une fois, dans Ajoutés ;
- une **envie visitée** (V1 ou V2) → sort de la liste, sans action du joueur ;
- **profil d'un autre** → ni « Modifier », ni données privées ; ses envies seulement s'il les montre ;
- `/explorateur/<autre>/modifier` → redirigé vers son profil ;
- **bio** à 300 caractères → refusée au-delà, compteur visible ;
- **déconnexion** → retour à la V1, jamais un écran blanc.
