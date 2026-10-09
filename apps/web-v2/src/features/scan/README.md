# scan — reconnaître un Fragment dans la caméra

Passer le téléphone devant un t-shirt : un modèle de vision (MediaPipe, MobileNet V3 small, servi sous
`/modeles/`) résume le carré du viseur en une empreinte, comparée aux empreintes de référence
(`empreintes_du_scan`, migration 474). Ça bipe, puis le Récit du Fragment s'ouvre. Sans compte.
Spec `docs/superpowers/specs/2026-10-09-v2-scan-design.md`, maquettes Figma 530:796 et suivantes.

- `lib/` — `regleDuBip.ts` (ressemblance, classement, quand biper), `modele.ts` (le chargeur paresseux),
  `viseur.ts` (le carré envoyé au modèle), `son.ts` (débloquer le son, biper).
- `api/` — `scan.ts` (les RPC, la liste des Fragments), `lireEmpreintes.ts`.
- `hooks/` — `useEmpreintes`, `useCamera`, `useAnalyse`.
- `components/` — `ScanScreen` (l'écran), `FeuilleApprendre` (admins : ajouter une vue), `ListeFragments`.

Les références : les illustrations (calculées par le Hub) et les vues du vrai t-shirt (ajoutées par les
admins depuis le scanner). Les mockups de la boutique sont écartés : ils font biper à tort (essai du 09/10).
