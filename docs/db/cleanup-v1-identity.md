# Dette de nettoyage — Refonte identité V1.0

> Branche `v1-refonte-identite`. On bâtit en **additif uniquement** contre la prod réelle :
> `CREATE`, colonnes nullable / avec défaut, nouvelles RPC. **Zéro `DROP`, zéro `ALTER` cassant** pendant la campagne.
> Chaque élément de l'ancien monde rendu obsolète par le nouveau socle se note ici.
> Le grand nettoyage (`DROP` colonnes/RPC mortes) se fait **en fin de campagne, d'un coup, vérifié manuellement** (cf. `xo-discipline.md` + `feedback_verify_before_drop`).

Socle de référence : *🌳 SPEC — Le Mouvement, les Compagnies & les Classes* (vault, 19/06/2026).
Cascade : **Classes → Compagnies → Territoire/scoring → Saison/récompenses**.

---

## À DROP / nettoyer en fin de campagne

| # | Objet (colonne / RPC / table) | Rendu obsolète par | Migration additive liée | Vérifié avant DROP |
|---|---|---|---|---|
| _(rien encore)_ | | | | |

---

## Notes de transition

- _(à remplir au fil des specs : ce qui doit cohabiter, ordre de bascule front, données à backfiller)_
