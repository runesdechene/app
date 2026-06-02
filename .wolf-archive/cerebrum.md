# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Last updated: 2026-04-06

## User Preferences

- Langue de travail : français
- Push souvent autorisé sans demander confirmation
- Déploiement Netlify toujours manuel (pas d'auto-deploy Git — repo privé)
- DB de dev = production (alpha) pour l'instant
- Moindre friction + Pareto (20% effort → 80% résultat)

## Key Learnings

- **Project:** runes-de-chene (monorepo pnpm : explore-web + hub + supabase)
- **Auth :** `auth.users` et `public.users` sont deux tables séparées. Lien par **email** (`email_address`), pas par `id`. Le Hub `fetchRole` doit requêter par `.eq('email_address', email)`.
- **Supabase `.single()`** ne throw pas — retourne `{ data: null, error }`. Toujours destructurer `{ data, error }`.
- **Fonctions STABLE** ne peuvent pas faire UPDATE/INSERT — PostgreSQL ignore silencieusement. Utiliser VOLATILE.
- **Migrations SQL** : toujours lire la dernière version de la fonction avant de modifier. Ne JAMAIS réécrire de mémoire.
- **Backfill + triggers** : TOUJOURS désactiver les triggers avant un INSERT massif, puis réactiver.
- **Onboarding nouveau joueur** : détection via `userName === '' && userFactionId === null`
- **`window.location.reload()`** après changement de faction (pas de refresh partiel fiable)
- **Images** : bucket `place-images`, paths `places/{authorId}/{imageId}.webp` + `_thumb.webp`. Avatar = `avatar_url` sur users.

## Do-Not-Repeat

- [2026-04] `get_user_titles` : TOUJOURS inclure `'unlocks', t.unlocks` dans json_build_object (généraux ET faction). Oublié 3 fois (mig 182, 191, 193). Sans ça → bouton ajouter lieu cassé.
- [2026-04] Ne jamais utiliser `-uall` avec `git status` (memory issues sur gros repos)
- [2026-04] Après claim/fortify : faire un refresh complet `get_user_energy` (pas juste `setEnergy`) sinon affichage fractionnaire incorrect.
- [2026-04] `usePlayer.ts` : détecter mismatch `userData.id ≠ auth.uid()` au boot → appeler `migrate_user_to_auth_id`.
- [2026-04] **RÉGRESSSION place_influence_action** : une réécriture (mig 196) a écrasé la suppression de la limite remote (mig 051), réintroduisant un cap de 5 pts/jour. **Règle** : avant de CREATE OR REPLACE une fonction, TOUJOURS `grep` les migrations pour trouver la version la plus récente ET comparer chaque comportement (limites, colonnes, retour JSON). Ne jamais réécrire de mémoire, même partiellement.

## Decision Log

- [2026-04] **Énergie unique** : les 4 jauges (énergie, conquête, construction, vitalité) → 1 seule jauge Énergie. Colonnes legacy gardées en BDD.
- [2026-04] **account_source** : `'app'` ou `'shopify'` uniquement (pas de `'both'`). C'est le canal d'acquisition, immuable.
- [2026-04] **Coût par distance** : multiplicateur GPS/proche/moyen/loin, seuils configurables Hub.
- [2026-04] **Découverte ≠ Exploration** : « découverte » = ajouter un lieu à sa liste (remote OK, coûte de l'énergie). Exploration GPS = +10 pts, découverte remote/free = +1 pt. `discover_place` vérifie la proximité côté serveur (migrations 082-083). Ne JAMAIS bloquer les découvertes remote !
- [2026-04] **Gloire** = score pur, jamais dépensé. Classement Héritages = somme Gloire membres.
- [2026-04] **Context cleanup** : CLAUDE.md disséqués vers .wolf/ (schema, rpcs, gameplay, stores, shopify) pour réduire le coût token par session de ~30k à ~4k.
- [2026-04] **V0.5 — Influence remplace Claim/Fortify** : système multi-Héritage par lieu, influence placée (decay) + influence de contenu (permanent). Fiches de lieu collaboratives = carnets (texte + photos + note). Énigme quotidienne. Migrations numérotées 004-019 dans supabase/migrations/.
- [2026-04] **PlacePanel redesign** : layout C (hero photo plein cadre, pas d'overlay) + cadre parchemin pour influence + onglets (Carnets/Galerie/Infos/Admin). Photos liées aux carnets, pas de vote individuel par photo. Infos = champs wiki éditables par tous.
- [2026-04] **Énigmes** : sources historiques fiables uniquement (Venner, Dumézil, sources antiques). Ton enraciné/patriote, mystère du réel. Jamais de witchy/wicca/new-age.
