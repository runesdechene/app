# SPEC — Compteur collectif « Ensemble contre l'Oubli »

> Brainstorm Uriel + XO, 25 juin 2026. Statut : **validé, prêt pour plan d'implémentation**.
> Déclencheur : retour joueur (Rémy) — « à quoi sert de conquérir / tenir si ça ne rapporte
> rien à la Coupe ? ». Décision de fond : **on récompense la tenue de territoire AILLEURS, pas
> dans la Coupe**. La Coupe reste **au mérite-action** (Modèle B intact). Ce compteur est la
> 1ʳᵉ brique : **recadrer la Coupe comme reliée à nos actions réelles et collectives**.

## Intention

Afficher, au-dessus des classements, un **compteur agrégé des actions de la saison** (toutes
Compagnies / tout le Mouvement confondus), en langage de marque. Objectif : faire comprendre
**visuellement** que la Coupe récompense ce qu'on FAIT pour le patrimoine — pas ce qu'on possède.

**Purement visuel / lecture. AUCUN changement de calcul de la Coupe.** Additif, zéro risque de
snowball / pay-to-win.

## Contenu

Saison en cours, 3 chiffres (les actions les plus nobles et les mieux payées à la Coupe) :

> ⚜ Cette saison, ensemble : 🏛️ **X** lieux sortis de l'Oubli · 📍 **Y** visités · 📜 **Z** énigmes percées

- **lieux sortis de l'Oubli** = lieux **ajoutés** pendant la saison (`places.created_at` dans la fenêtre).
- **visités** = visites GPS de la saison (`place_explorers.visited_at` dans la fenêtre).
- **énigmes percées** = bonnes réponses de la saison (`enigma_responses.correct` dans la fenêtre).

Périmètre = **toute la communauté** (pas de filtre membre) — plus simple, plus grand, et ces
actions sont de fait quasi toutes faites par des membres. Wording « Ensemble » (le Mouvement).
*(Si on veut un jour le restreindre aux membres de Compagnies, c'est un simple JOIN — non retenu ici.)*

## Emplacements (3)

1. **Modale Coupe** (`CoupeModal`) — bandeau **complet** au-dessus du classement.
2. **Accueil, section Coupe** (`CoupeHeritagesSection`) — bandeau **complet** en tête.
3. **Scoreboard carte** (`FactionBar`) — variante **compacte** : 1 ligne sobre au-dessus du rail.
   Respecte le compactage mobile récent (petite typo, pas de pavé ; masquée si tous les compteurs = 0).

## Technique

- **Source unique = `get_coupe_state`** : les 3 vues l'appellent déjà (`FactionBar`, `useCoupe` pour
  home + modale). On ajoute un bloc `collective` au retour :
  ```json
  "collective": { "lieuxSortisOubli": int, "lieuxVisites": int, "enigmesPercees": int }
  ```
  Calcul = 3 `COUNT` sur la fenêtre de saison (`v_season.started_at` → `v_window_end`), déjà
  disponibles dans la fonction. Coût négligeable. **Aucun autre champ touché.**
- **Type** : ajouter `collective` à `CoupeState` (`types/coupe.ts`).
- **Composant réutilisable** `CollectiveCounter` (`components/map/badges/` ou `components/home/coupe/`) :
  - props : `{ lieuxSortisOubli, lieuxVisites, enigmesPercees, variant: 'full' | 'compact' }`.
  - `full` : bandeau parchemin, 3 métriques + libellé de marque.
  - `compact` : 1 ligne dense (icône + chiffre ×3) pour la carte.
  - Sobre, DA parchemin/sépia (cohérent UI logiciel, pas RPG).
- Posé aux 3 endroits ; pas de nouvel appel réseau.

## Hors périmètre (non-goals)

- Pas de changement du **calcul** de la Coupe (mérite-action, Modèle B).
- Pas de récompense de la tenue de territoire **dans** la Coupe (ce sera une brique séparée :
  classement de territoire / valorisation trésor+Chef — à brainstormer plus tard).
- Pas de cumul « depuis toujours » (saison uniquement, pour rester collé à la Coupe).

## Cas limites

- **Pas de saison active** → pas de bloc `collective` (compteur masqué).
- **Tous les compteurs à 0** (début de saison) → bandeau affiché en modale/home (« ensemble : 0… »,
  ça se remplit), **masqué** dans la variante compacte carte (évite une ligne vide inutile).

## Lots d'implémentation (pour writing-plans)

1. **Backend** : mig — `get_coupe_state` renvoie le bloc `collective` (3 counts saison).
2. **Type** : `CoupeState.collective` dans `types/coupe.ts`.
3. **Composant** : `CollectiveCounter` (full + compact) + CSS DA.
4. **Intégration** : CoupeModal (full), CoupeHeritagesSection (full), FactionBar (compact).
5. **Vérif** : counts cohérents en prod, rendu desktop + mobile (3 vues), aucun impact score.
