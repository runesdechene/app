# api — ce que la zone Lieu demande à Supabase

- `lireLieu.ts` — la forme d'une fiche, des Explorateurs et des compagnons ; lecture défensive
  du JSON (`null` = introuvable ou invisible).
- `modeleDePartage.ts` — le texte de partage réglé dans le Hub (null si la lecture échoue).
- `lieu.ts` — les huit appels : fiche, Explorateurs, envie, visite, présence, compagnons, noms
  d'expédition, revendication (migrations 364-365).
