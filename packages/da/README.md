# @runes/da — la direction artistique en variables

Partagé par `apps/web-v2` (Explore) et `apps/hub-v2` (le Hub).

- `tokens.css` — toutes les couleurs, polices, tailles, espacements, formes et mouvements. **Le
  seul endroit** où une valeur visuelle s'écrit en dur ; Stylelint refuse les autres, dans les
  deux applis.
- `global.css` — remise à zéro et fond parchemin commun.
- `polices.ts` — les polices, servies par l'appli (jamais Google).

Ajouter un jeton = le montrer sur `/da` (Explore, `src/app/da/`). Pour voir toute la DA : `/da`.
