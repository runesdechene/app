# hooks — les données de la zone Compte, en cache

- `useMonIdentifiant` — l'identifiant de l'Explorateur connecté.
- `useExplorateur(id)` — un profil public : `undefined` en chargement, `null` si introuvable.
- `useModifierProfil` — les valeurs de départ du formulaire et `enregistrer`.
- `usePreferences` — les préférences et `regler` (optimiste, revient si la base refuse).
