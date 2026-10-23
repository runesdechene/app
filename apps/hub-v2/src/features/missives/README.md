Les Missives : les lettres de la marque, écrites et envoyées depuis le Hub (spec
`docs/superpowers/specs/2026-10-22-mailing-parcours-client-design.md`, plan lot 1).

- `Listes` : les cinq listes (`hub_listes`) et les ambassadeurs qu'Uriel choisit (`hub_ambassadeurs`, mig 542).
- `Ecrire` : l'e-mail tel qu'il partira, modifiable sur place (les modèles de `@runes/missives` en mode édition) ; les réglages à gauche (`Reglages`), le brouillon en fonctions pures (`lib/brouillon`), les photos penchées avant dépôt (`lib/pencher`, stockage `missives`, mig 543).
- `Envois` : une ligne par Missive et ce qu'il en est advenu (`hub_envois`, mig 544) ; un brouillon ou une Missive programmée se rouvre dans Écrire.
- Les modèles d'e-mail vivent dans `packages/missives` ; l'envoi dans `netlify/functions/missives-envoyer.ts`.
