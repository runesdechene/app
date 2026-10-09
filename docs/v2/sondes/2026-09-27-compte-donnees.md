# Sonde — ce que la base sait pour le Compte (27/09/2026)

> Relevé en prod, en lecture seule, avant la spec de la zone Compte. Un relevé d'un jour, pas
> un fait éternel : le revérifier si la spec s'écrit plus tard.

## « Mon parcours » (spec V2 §4) — ce qui existe

| Jalon voulu | Source réelle | Constat |
|---|---|---|
| N lieux **découverts** (à distance) | `places_discovered` (`user_id`, `place_id`, `method`, `discovered_at`) | `method` = `remote` ou `gps`. 42 393 lignes, dont 3 682 en `gps`. |
| N lieux **visités** (sur place) | `place_explorers` (`user_id`, `place_id`, `visited_at`) — **pas de colonne de méthode** | 7 062 lignes. Écrite par la visite GPS (`_visit_place_gps_internal`), `plant_flag`, `publish_gps_mark` — **mais aussi** par `_create_place_internal` et `_contribute_to_place_internal`, qui ne supposent pas d'être sur place. |
| N fragments réunis | `user_fragments` (`user_id`, `fragment_id`, `unlocked_at`, `source`) | `source` distingue l'achat Shopify (`shopify`) des autres voies. |
| N régions parcourues | — | **N'existe pas.** `places` n'a que `latitude` / `longitude` : ni région, ni département, ni commune. |
| Porteur depuis … | `users.created_at`, ou le premier `user_fragments.unlocked_at` | à trancher : « inscrit depuis » ≠ « porteur depuis ». |

## Pièges à trancher dans la spec

1. **Découvrir ≠ visiter** (`.claude/rules/produit.md`). Un lieu découvert à distance puis visité
   sur place n'est **pas** réécrit dans `places_discovered` (`already_discovered`) : la visite
   vit seulement dans `place_explorers`. « Lieux visités » doit donc lire `place_explorers`,
   et décider si la création et la contribution comptent comme une visite.
2. **Régions** : il faut une correspondance lieu → région (polygones des régions, ou une
   colonne calculée une fois). C'est du back à ajouter — une ligne pour `purge-back.md`
   « Ajouté pour la V2 » si on le fait.
3. **« Porteur depuis »** : date d'inscription, ou date du premier fragment ? La spec V2 appelle
   « porteur » celui qui a un fragment ; « inscrit depuis » serait un autre jalon.
