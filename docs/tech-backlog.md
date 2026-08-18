# Backlog technique — chantiers différés

> Infra, durcissement, observabilité, dette transverse. Ce qu'on a décidé de **ne pas** faire
> tout de suite, avec la raison — pour ne pas re-débattre à chaque fois qu'on y repense.
>
> Ce fichier ≠ `docs/db/tech-debt.md` (dette **DB/SQL** détaillée, format origine/coût/urgence)
> ≠ `_ContexteIA/xo-status.md` (ce qu'on fait **maintenant**).
>
> *Rapatrié du vault le 18/08/2026 (`L'app/📌 Backlog technique - App.md`, dernière revue 07/07).
> C'est du dev : ça vit dans le repo, pas dans Obsidian.*

## Infra / Process

- [ ] **CI légère (GitHub Action)** — sur chaque push : `tsc + build + npx supabase db push --dry-run --linked`, pour attraper les erreurs **avant** la prod. *(Idée XO 28/06 — plus rentable qu'un staging à ce stade, faible friction.)*
- [ ] **Base de staging** — **pas maintenant** (alpha : friction > valeur). À monter quand l'app sort de l'alpha (vrai trafic/revenus), via **Supabase Branching**. Le merge prod n'est PAS le problème (migrations = fichiers `NNN` + `db push`) ; le vrai coût = données représentatives sans PII.

## Sécurité — durcissement restant (post-audit 28/06)

> Le critique + tout l'accès **anon** (lecture ET écriture) sont déjà clos : migrations **320→324**.
> Reste du defense-in-depth contre un user **connecté** + du cosmétique. Aucune ERROR advisor restante.

- [ ] **Least-privilege storage par bucket** — aujourd'hui tout user *connecté* peut écrire n'importe quel bucket. Réserver les buckets **admin** (`app-ads`, `app-fragments`, `home-banners`, `app-assets`, `announcement-covers`, `tag-icons`) à `_is_admin()`. ⚠️ `faction-emblems`/`faction-patterns` sont **user-writable** (Compagnies créées V0.10). Mini-projet → à faire avec un filet (staging/branche).
- [ ] **`function_search_path_mutable` ×162** — `ALTER FUNCTION … SET search_path` (advisor 0011). Mécanique mais risqué sur prod sans filet → tester en transaction `ROLLBACK` ou branche jetable.
- [ ] **RPC mutation appelables par anon (~245)** — protégées par `auth.uid()` en interne ; `REVOKE EXECUTE` anon possible en defense-in-depth.
- [ ] **2 extensions dans `public`** (`unaccent`, `fuzzystrmatch`) → déplacer vers schéma dédié (prudence : refs non qualifiées).
- [ ] **Leaked-password protection** — toggle dashboard Auth (impact faible : magic-link).
- [ ] **`place_tags` INSERT (authenticated, true)** — utilisé en direct par explore-web (`AddPlaceFlow`) → basculer vers RPC pour scoper.

## Observabilité — pattern « échecs muets » ⚠️

> Découvert le 07/07 : **deux** flux échouaient en silence (aucun log d'erreur, aucune alerte,
> aucune trace exploitable). C'est un **pattern**, pas deux incidents isolés. Un échec qui ne
> crie pas = du contenu et des ventes perdus pendant des mois sans qu'on le sache.

- **Instance 1 — webhook fragments Shopify** : tag produit `fragment:skjaldmo` (deux-points) vs `shopify_unlocks` = `fragment-skjaldmo` (tiret). Match exact → pas de déblocage. Et comme d'autres tags de la commande matchaient (`skipped>0`), la branche de log « no_match » ne se déclenchait même pas → **zéro trace**.
- **Instance 2 — upload studio soumission** (mig 331, 07/07) : le bucket `community-photos` refusait ce que le front invitait (vidéos + images 10-15 Mo ; plafond 10 Mo, mime/RLS image-only). L'upload jetait, la ligne `hub_photo_submissions` (créée AVANT la boucle) restait vide, l'user réessayait → soumissions vides en rafale. Victimes réelles : Pierrick, Ayden, Vincent (relancés par email).

- [ ] **Mini-audit des flux à échec silencieux** — webhooks (Shopify order), uploads publics (studio, place-images), RPC anon de mutation. Pour chacun : est-ce qu'un échec **laisse une trace exploitable** ? Ajouter log/alerte (ou statut en base) là où un échec passe sous le radar. Cible : plus jamais « le client dit que ça marche pas et on n'a rien ».

- **Acquis réutilisables** : `send-email` edge a désormais un type **`content_retry`** (template parchemin « renvoie tes contenus », prénom via `data.first_name`) — resservira pour toute relance post-bug. Bucket `community-photos` : 50 Mo + `video/mp4,quicktime,webm` (mig 331).

## Dette / cohérence

- [ ] **2 migrations orphelines non filées** — `grade_founding_always_counts_306/307` (appliquées prod via MCP le 25/06, SQL perdu au `repair --reverted`). Effet **superseded** par 306/307/311/312/318 → repo = source de vérité OK ; à reconstituer seulement si on veut un repo 100 % rejouable.

## Idées non instruites

- [ ] **Système d'emails séquencés** — brouillon de schéma jamais appliqué : `docs/db/drafts/systeme-emails-BROUILLON.sql` (tables `email_subscribers`, `email_sequences`, séquences `shopify_welcome` / `app_welcome` / `post_order` en J1/J3/J7/J10). Aucune de ces tables n'existe en prod ni dans le repo. À instruire ou à jeter — pas à appliquer tel quel.
