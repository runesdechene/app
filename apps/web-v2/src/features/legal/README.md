# legal — les textes légaux

Publics, lisibles sans compte : `/legal/mentions` (LCEN art. 6), `/legal/confidentialite` (RGPD
art. 13-14 : Explore, la boutique et le Hub, un compte Explore étant aussi un compte client),
`/legal/conditions` (avec la Charte). Rédigés le 11/10/2026 à partir de ce que le code fait
vraiment (audit `docs/superpowers/specs/2026-10-11-conformite-securite.md`) : **changer un
traitement de données, c'est relire ces textes** — et, s'ils changent, avancer
`VERSION_DES_CONDITIONS` (`shared/lib/conditions.ts`) pour qu'ils soient acceptés à nouveau.

- `components/` — `PageLegale` (la mise en page), `Mentions`, `Confidentialite`, `Conditions`.
