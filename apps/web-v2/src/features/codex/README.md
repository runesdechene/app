# codex

Le Codex, le Pokédex de Runes de Chêne (spec `docs/superpowers/specs/2026-11-02-codex-design.md`) :
toute la collection des Fragments rangée par collection thématique, l'état de chacun (inconnu,
scanné, porté), sa fiche, ses anecdotes.

- `api/` — `mon_codex`, `mon_fragment`, `tirer_anecdote` et leurs lecteurs.
- `hooks/` — les requêtes TanStack Query.
- `components/` — la page, ses sections, la fiche d'un Fragment, la découverte animée.
  Pour qui découvre : le lien « Comment ça marche ? » sous le titre, et sa feuille.
