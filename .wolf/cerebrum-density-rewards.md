---
name: GPS Reward Modulation by Density + Accessibility
description: Feature plan — modulate visit/revisit GPS rewards based on nearby place density and accessibility field to avoid Paris-farming
type: project
---

## Contexte

Les lieux en ville (Paris, etc.) sont trop faciles à farmer en se baladant. Un joueur urbain gagne autant qu'un joueur qui va sur un lieu isolé et difficile d'accès. Il faut moduler les récompenses GPS.

**Why:** Équité gameplay — le terrain difficile doit rapporter plus que le centre-ville.

**How to apply:** Modifier les RPCs `visit_place_gps` et `revisit_place_gps` pour appliquer un multiplicateur.

## Design validé par l'utilisateur

### Système hybride : densité (base) + accessibilité (bonus)

**Multiplicateur densité** (lieux dans un rayon de 2km) :

| Densité (lieux < 2km) | Multiplicateur |
|------------------------|----------------|
| 10+ lieux | x0.5 |
| 5-9 lieux | x0.75 |
| 2-4 lieux | x1.0 (base) |
| 0-1 lieu | x1.5 |

**Bonus accessibilité** (champ `accessibility` dans `place_contributions` type info) :

| Accessibilité | Bonus |
|---------------|-------|
| Non renseignée | +0% |
| Facile | +0% |
| Modéré | +25% |
| Difficile | +50% |

**Formule :** `reward = base_reward * density_mult * accessibility_mult`

Exemple : lieu isolé + difficile = x1.5 * 1.5 = x2.25 vs lieu centre-ville facile = x0.5

### Implémentation prévue

1. Fonction SQL helper `get_density_multiplier(p_place_id)` — compte les lieux dans un rayon de 2km via `haversine_km`, retourne le multiplicateur
2. Fonction SQL helper `get_accessibility_multiplier(p_place_id)` — lit le champ accessibility, parse "Facile"/"Modéré"/"Difficile", retourne le multiplicateur
3. Modifier `visit_place_gps` et `revisit_place_gps` pour appliquer : `v_stock_gain := ROUND(base * density * accessibility)`
4. Afficher le multiplicateur dans le frontend (reward display) pour que le joueur comprenne pourquoi il gagne plus/moins
5. Seuils configurables dans `app_settings` (rayon, paliers de densité)

### Points d'attention

- Performance : la requête de densité est un COUNT spatial — s'assurer qu'un index spatial existe ou utiliser un calcul bbox avant haversine
- Le champ accessibility est du texte libre ("Facile / Modéré / Difficile + détails") — il faudra parser le début ou normaliser en enum
- Les revisit utilisent des gains décroissants — le multiplicateur s'applique sur le gain de base avant décroissance
