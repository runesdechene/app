# RPCs — Liste complète

## Game Core
| RPC | Params | Logique |
|-----|--------|---------|
| `discover_place` | target_place_id, method, p_user_lat, p_user_lng, p_free | Coût énergie × distance × (1-reduction), insert places_discovered, +2 Gloire |
| `claim_place` | target_place_id, p_user_lat, p_user_lng, p_free | Coût énergie × distance × (1-reduction) + fortif, change faction/claimed_by + avatar, +5 Gloire |
| `fortify_place` | target_place_id, ct_id, p_user_lat, p_user_lng | Coût énergie × distance + fortif_cost, monte level, +5 Gloire |
| `get_user_energy` | p_user_id | Énergie + regen + bonus faction/fragments + underdog + Gloire |
| `get_underdog_faction_id` | — | ID heritage underdog |
| `preview_action_cost` | — | RPC unique pour calculer le coût de toute action (source de vérité) |

## Compétences
| RPC | Params | Logique |
|-----|--------|---------|
| `get_my_abilities` | p_user_id | Liste compétences actives du joueur + cooldown |
| `use_fragment_ability` | p_user_id, p_fragment_id | Active la compétence, enregistre cooldown |

## Titres & Fragments
| RPC | Params | Logique |
|-----|--------|---------|
| `get_user_titles` | p_user_id | Titres généraux + titre faction par rang (RANK()). **⚠️ TOUJOURS inclure `'unlocks', t.unlocks` dans json_build_object (généraux ET faction). Oublié 3 fois.** |
| `get_all_player_titles` | p_user_id | 3 catégories + stats + conditions + displayedIds |
| `set_displayed_titles_v3` | p_user_id, p_ids | Sauvegarde max 3 titres affichés |
| `get_user_fragments` | p_user_id | Fragments possédés |
| `get_all_fragments` | p_user_id | Tous les fragments avec flag owned + ability |
| `get_player_profile` | p_user_id | Profil complet (v3 titres, stats, Gloire, avatar protecteur) |
| `migrate_user_to_auth_id` | p_old_id, p_new_id | Migration ancien ID Firebase → UUID Supabase (toutes FK) |

## Map & Feed
| RPC | Params | Logique |
|-----|--------|---------|
| `get_map_places` | lim | Lieux avec coords, faction, tags, scores, avatar protecteur |
| `get_faction_notoriety` | — | Score par heritage (heures × fortif) + isUnderdog |
| `get_winning_territory_names` | — | Noms gagnants par territoire |

## Territory Naming
| RPC | Params | Logique |
|-----|--------|---------|
| `get_territory_votes` | anchor, user_id, blob_ids | Propositions + votes (filtrés par faction) |
| `propose_territory_name` | user_id, anchor, name, blob_ids | Max 2 propositions, vérifie faction |
| `vote_territory_name` | vote_id, user_id, proposal_id, value, blob_ids | Vote (+1/-1), vérifie faction |
