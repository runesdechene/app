# Les notifications d'Explore — ce qui part, et où

> Inventaire du 08/10/2026 (Uriel : « il faut qu'on les liste quelque part pour savoir ce qu'on
> fait »). À tenir à jour à chaque notification ajoutée ou retirée, dans le même commit.

## Comment ça marche

1. Une action insère une ligne dans `notifications` (le plus souvent par `notify()`, qui garde les
   50 dernières par personne).
2. **La cloche** de l'app n'affiche que les sortes listées dans `_notification_v2()`.
3. **Le push** : le déclencheur `push_on_notification` appelle l'edge function `send-push`, qui
   n'envoie que les sortes rangées dans `supabase/functions/send-push/categories.ts` :
   - `important` — suit le réglage « Les nouvelles importantes » (`push_important_enabled`) ;
   - `recap` — suit « Le récit de la semaine » (`push_recap_enabled`) ;
   - absente = `silent` : rien ne part.
4. Le texte et l'écran ouvert par le push : `send-push/payloads.ts`. La phrase de la cloche :
   `apps/web-v2/src/features/notifications/lib/phrase.ts`.

Seuls les téléphones abonnés reçoivent un push (96 comptes le 08/10, sur 5 015).

## Les notifications

| Événement | Sorte | Qui la reçoit | Cloche | Push | Depuis |
|---|---|---|---|---|---|
| On aime ton lieu (cœurs) | `like_contribution` | l'auteur et ceux qui l'ont enrichi | ✅ | ✅ important | mig 384 |
| On aime ton récit | `like_carnet` | l'auteur du récit | ✅ | ✅ important | V1 |
| On écrit dans le carnet de ton lieu | `new_carnet` | l'auteur du lieu | ✅ | ✅ important | V1 (mig 201) |
| On aime ton mot du carnet | `coeur_mot` | l'auteur du mot | ✅ | ✅ important | mig 389 |
| On enrichit le récit de ton lieu | `description_edited` | l'auteur du lieu | ✅ | ✅ important | V1, puis Enrichir (mig 414) |
| On modifie ton lieu | `lieu_modifie` | l'auteur du lieu | ✅ | ✅ important | mig 387 |
| On ajoute des photos à ton lieu | `new_photo` | l'auteur du lieu | ✅ | ✅ important | mig 388 |
| On corrige la position de ton lieu | `place_position_edited` | l'auteur du lieu | ✅ | ✅ important | V1 |
| Commentaire, réponse | `new_comment`, `comment_reply` | l'auteur | ✅ | ✅ important | V1 |
| On te mentionne dans le Registre | `mention` | la personne mentionnée | ✅ | ✅ important | mig 386 |
| On te salue (premier salut seulement) | `salut` | la personne saluée | ✅ | ✅ important | mig 386 |
| On demande à rejoindre ta Compagnie privée | `demande_compagnie` | le Chef et les Officiers | ✅ | ✅ important | mig 421 |
| Ta demande est acceptée | `demande_acceptee` | le demandeur | ✅ | ✅ important | mig 421 |
| Une mise à jour de l'app | `mise_a_jour` | tous | ❌ (Nouveautés) | ✅ important | mig 397 |
| Paliers de ton lieu (vues, visites, cœurs) | `milestone_*` | l'auteur du lieu | ✅ | ✅ recap | V1 |
| **On visite ton lieu** (première visite d'un Explorateur) | `visite` | l'auteur du lieu | ✅ | ✅ important | **mig 464** |
| **On revendique un lieu que tu tenais** | `revendication_reprise` | celui qui le tenait | ✅ | ✅ important | **mig 464** |
| **Quelqu'un rejoint ta Compagnie** (publique) | `nouveau_membre` | les autres membres | ✅ | ✅ important | **mig 464** |
| **Une énigme t'attend sur la carte** (une fois par jour, vers 12 h 30) | `enigme_du_jour` | les abonnés au push qui ont une énigme réveillée non percée et ne sont pas venus depuis 18 h | ❌ | ✅ important | **mig 464** |

### Ce qui ne marchait pas avant le 08/10

- **L'énigme du jour** (`daily_enigma_ready`, tâche `daily_enigma_lunch_push`) : ~5 000 lignes par
  jour, mais rangée `silent` — aucun push n'est jamais parti depuis la bascule. Remplacée par
  `enigme_du_jour`, qui n'est créée que si un push peut partir.
- **Les visites** (`exploration`) : la notification était branchée sur la table de la V1
  (`places_explored`), plus remplie ; la V2 écrit dans `place_explorers`. Remplacée par `visite`.
- **Revendiquer un lieu déjà tenu**, **rejoindre une Compagnie publique** : rien n'était envoyé.

## À décider

- **`level_up_imminent`** (tâche `level_up_imminent_check`, chaque jour à 17 h) : ~18 000 lignes par
  mois, ni dans la cloche ni en push. La garder (et l'envoyer) ou arrêter la tâche ?
- **Les anciennes lignes `daily_enigma_ready`** (~150 000 sur 30 jours) : à supprimer en une fois
  (suppression en masse : avec l'accord d'Uriel).
- **Les sortes de la V1 encore créées** (`place_court_*`, `place_taken_*`, `mecene_principal_gained`) :
  la Cour V1 tourne encore en base (registre de purge).
