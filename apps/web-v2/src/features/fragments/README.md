# fragments — le récit d'un Fragment

Ouvert en touchant un Fragment sur la carte (le calque vit dans `features/carte`), pour tous, visiteurs
compris. Maquette Figma 99:145 ; contenu tiré de Shopify par la synchro du Hub (migrations 457 et 459).

- `api/` — `recit.ts` parle à Supabase (`recit_du_fragment`) ; `lireRecit.ts` lit son JSON.
- `hooks/` — `useRecit` (clé `['fragment', id]`).
- `lib/` — `texteRiche.ts` (le récit de Shopify en paragraphes, gras et italique gardés), `duree.ts`.
- `components/` — `RecitFragment` (l'écran), `LecteurAudio` (la voix off).

Pas encore là : le scanner, le Campement (« Déjà Porteur ? »), les énigmes du Fragment (onglet verrouillé).
