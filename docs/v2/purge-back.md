# Registre de purge du back

> Tout ce que le back devra perdre ou corriger une fois la V2 lancée. **Des candidats, pas des
> ordres** : chaque DROP en prod est revérifié à la main au moment de le faire.
> Règle : un commit V2 qui croise un objet douteux ajoute sa ligne dans le même commit.

## 1. À supprimer après bascule

| Objet | Constat | Action | Quand | Source |
|---|---|---|---|---|
| Coupe des Héritages (`get_coupe_state`, tables associées) | classement entre Maisons, abandonné | supprimer | après bascule | spec V2 §1 |
| La Cour (`place_court_*`, `invest_crowns`, couronnes, mécénat, veilleurs) | prendre un lieu à un autre, abandonné | supprimer | après bascule | spec V2 §1 |
| Contestation de lieu | abandonnée | supprimer | après bascule | spec V2 §1 |
| Compagnies (mig 295, grades, bannières, buckets `faction-emblems` / `faction-patterns`) | Maisons qui s'affrontent, abandonnées | supprimer | après bascule | spec V2 §1 |
| Gloire / XP / niveaux (`notoriety_points`, `exploration_points`, `erudition_points`…) | progression comparable, abandonnée | supprimer | après bascule | spec V2 §1 |
| Énigmes (daily, fragment, lieu) + leurs 3 crons | boucle de rétention, abandonnée | supprimer | après bascule | spec V2 §1 |
| Expéditions joueur-joueur (`voyage_*`) | abandonnées | supprimer | après bascule | spec V2 §1 |
| Quêtes du jour (et leurs tables) | abandonnées — ≠ Missions, qui restent | supprimer | après bascule | spec V2 §1 |
| `floor_glory`, `floor_crowns` sur les appels | liés à la Gloire et à la Cour | supprimer | au portage des appels | spec V2, reste à faire |

## 2. À corriger

| Objet | Constat | Action | Quand | Source |
|---|---|---|---|---|
| `chat_messages` : `GRANT ALL` à `anon` | les RLS rattrapent pour un salon public, pas pour des murmures | révoquer, gater par appartenance à la conversation | avant la zone Messages | spec V2 §10 |
| `chat_messages.faction_id/color/pattern` | colorait les noms par Maison | neutraliser | au portage des Messages | spec V2 §10 |
| `cleanup_old_chat_messages()` | purge tout à 14 jours, murmures compris | rendre sélective | avant la zone Messages | spec V2 §10 |
| `@types/react` 18 dans explore-web et hub | React y tourne en 19.0.0 ; hissé à la racine, il sert aussi de types aux bibliothèques de la V2 (react-query) — contourné par un fragment dans `useV2Access.test.tsx` | aligner sur 19, puis retirer le fragment | après bascule | plan socle, Task 1 ; relecture 27/09 |

## 3. Ajouté pour la V2

| Objet | Rôle | Source |
|---|---|---|
| `users.v2_access` | autorisation V2 par compte | mig 344 |
| `has_v2_access()` | la V2 demande si l'appelant peut entrer | mig 344 |
| `set_v2_access(text, boolean)` | le Hub coche / décoche | mig 344 |
| Supabase Auth — URL `/v2/` | à autoriser quand la zone Compte aura sa propre connexion | spec socle §9 |
