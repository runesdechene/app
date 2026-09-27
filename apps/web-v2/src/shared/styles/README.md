# styles — la DA en variables

- `tokens.css` — toutes les couleurs, polices, tailles, espacements et formes. **Le seul endroit**
  où une valeur visuelle s'écrit en dur ; Stylelint refuse les autres.
- `global.css` — remise à zéro et fond commun.

Pour voir toute la DA d'un coup : `/v2/da`.

Fond fixe ou défilant : dans `tokens.css`, `--background-attachment: fixed` (le fond reste) ou
`absolute` (il défile avec la page).
