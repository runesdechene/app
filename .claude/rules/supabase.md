---
paths:
  - "supabase/**"
  - "**/*.sql"
---

# Base de données — Supabase, RLS, RPC, migrations

> Pièges payés une session de débogage chacun. Ne jamais improviser sur cette couche.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## ALTER PUBLICATION ne supporte pas IF EXISTS

`ALTER PUBLICATION nom DROP TABLE IF EXISTS public.foo;` → **erreur de syntaxe Postgres**.

**Why:** Postgres ne supporte pas `IF EXISTS` sur les commandes `ALTER PUBLICATION ... DROP TABLE`. Découvert le 5 mai 2026 lors du push de la mig `072_drop_micro_social_notes.sql` qui voulait retirer `users` de `supabase_realtime` avant de DROP COLUMN. Le push a échoué avec `syntax error at or near "EXISTS"`.

**How to apply:** Quand on doit retirer une table d'une publication realtime de manière idempotente, utiliser un DO block avec check explicite :

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'foo'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.foo;
  END IF;
END $$;
```

Pareil pour `ALTER PUBLICATION ... ADD TABLE IF NOT EXISTS` (n'existe pas non plus) — wrap dans un DO block similaire si idempotence requise.

## Appliquer les migrations SQL moi-même, sans demander

Quand j'écris une nouvelle migration dans `supabase/migrations/`, je l'applique moi-même via `pnpm dlx supabase db push` depuis le repo. Pas besoin de demander à Uriel de la lancer.

**Why:** Uriel m'a dit (30 avril 2026) après que je lui ai passé la main pour appliquer la migration 013_user_place_influence_v05.sql. Il préfère que je gère le cycle complet (écriture + application + commit + push), il garde la validation pour le contenu de la migration en amont, pas pour la commande d'application.

**How to apply:**

1. Le repo doit être déjà identifié (voir `reference_machines.md`). Sur FONDATION : `C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/`.
2. Commande qui marche : `cd "<repo>" && pnpm dlx supabase db push`
   - `npx supabase db push` peut échouer avec `ERR_INVALID_URL` (cache npm corrompu sur FONDATION fin avril 2026) — préférer `pnpm dlx`.
   - `supabase` n'est pas installé globalement ni en deps locales — `pnpm dlx` télécharge à la volée (cohérent avec CLAUDE.md monorepo "npx seulement pour supabase", interprété comme "via dlx/npx, pas en dep locale").
3. Lire les NOTICEs en sortie pour repérer les surprises (signatures qui n'existent pas, etc.) — ne pas paniquer pour les "skipping", c'est normal en idempotence.

**Garde-fou** : pour les opérations destructives (DROP TABLE, DELETE en masse, etc.), garder la règle de [feedback_verify_before_drop.md](feedback_verify_before_drop.md) — vérifier en amont avec Uriel avant le push. Cette préférence couvre le flux normal (CREATE/ALTER/INSERT/UPDATE/CREATE OR REPLACE FUNCTION), pas les DROPs risqués.

## Audit code mort RPC — tester les edge cases, pas juste les colonnes/tables

Quand Uriel demande un cleanup ou un audit du code mort, ne PAS se contenter de lister les colonnes/tables encore référencées. Il faut **tester chaque RPC sur les chemins d'exécution possibles**, surtout les edge cases : user sans avatar, sans faction, sans points, etc.

**Why** : audit du 15 avril 2026 a affirmé "plus de code mort" alors que `get_my_informations` contenait encore une branche `ELSIF v_user.profile_image_id IS NOT NULL` pointant vers une colonne supprimée. Le piège : la branche est dans un `ELSIF avatar_url IS NULL`, donc invisible pour 95% des users (ceux avec photo de profil). Bug détecté 2 semaines plus tard parce qu'un user sans avatar (Angelofsoul) voyait 0 gloire au lieu de 168 — la RPC plantait silencieusement et le store côté client n'était pas hydraté. ~25 users impactés en prod.

**How to apply** :
- Avant de dire "c'est propre" : pour chaque RPC modifiée, écrire un curl de test avec `service_role` qui couvre les branches conditionnelles (avec/sans avatar, avec/sans faction, etc.)
- Si une RPC fait `IF / ELSIF / ELSE`, tester chaque branche au moins une fois avec un user réel qui satisfait la condition
- Documenter dans le rapport d'audit les cas testés, pas juste "les RPCs sont propres"
- En particulier : toute RPC qui retourne `{error: ...}` au lieu de planter franchement masque la cause (le client voit `data` non-null avec une shape inattendue) → suspect prioritaire à tester

## Ne jamais improviser une RPC — toujours lire l'ancienne version

Ne JAMAIS réécrire une RPC en improvisant la structure du retour ou les colonnes utilisées.

**Why:** Le 29 mars 2026, j'ai réécrit `get_place_by_id` en inventant des colonnes (`v_place.description`, `v_place.score`, `unnest(v_place.images)`) qui n'existaient pas. Ça a causé 3 erreurs en cascade et Uriel était frustré à juste titre. La table `places` utilise `text` pas `description`, `images` est du JSONB pas un array, etc.

**How to apply:**
1. TOUJOURS lire la dernière version de la RPC dans les migrations (trouver la plus récente avec Grep)
2. **COPIER-COLLER la fonction entière, puis modifier uniquement la partie concernée.** Ne JAMAIS réécrire from scratch, même si on "comprend" la logique. Le problème n'est pas de ne pas lire — c'est de reconstruire au lieu de copier. Quand on reconstruit, on oublie les champs qui n'ont rien à voir avec le fix en cours (ex: `unlocks` oublié 3 fois dans `get_user_titles`).
3. Ne modifier QUE la partie concernée par le changement demandé
4. Vérifier les noms de colonnes contre la structure réelle de la table
5. Ne jamais deviner un nom de colonne — le vérifier

## WORKFLOW OBLIGATOIRE — vérifier le schéma DB AVANT toute mig SQL qui référence une colonne ou une jointure

## La règle dure

**AVANT** d'écrire toute migration SQL qui :
- référence une colonne (`f.tag_id`, `t.pattern_url`, etc.)
- fait une jointure entre tables (`JOIN tags ON t.id = f.tag_id`)
- modifie une RPC existante en touchant son schéma

**EXÉCUTER SYSTÉMATIQUEMENT ces 2 étapes** :

### Étape 1 — Lister les colonnes des tables impliquées

```bash
pnpm dlx supabase db query --linked "
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('factions', 'tags', '<autres>')
  ORDER BY table_name, ordinal_position;
"
```

OU lire directement `<repo>/graphify-out/graph.json` (section SQL schema).

### Étape 2 — Confirmer la jointure cible

Pour chaque `JOIN x ON y.col = z.col` que je m'apprête à écrire, vérifier que :
- `y.col` existe dans la table y
- `z.col` existe dans la table z
- Les types matchent

Si le moindre doute → query, ne pas deviner.

## Pourquoi c'est non-négociable

**Récidive #5 cette semaine** (8 mai 2026, mig 133). Symptôme : invest_crowns plante silencieusement à chaque bascule, aucune Couronne créditée, aucun lieu basculé en prod. Bug remonté par Uriel : "ma dernière Couronne ne veut pas se mettre". Diagnostic à froid : `factions.tag_id` n'existe pas, la table `factions` a directement `color` et `pattern`. J'avais supposé une jointure normalisée par déduction logique. Faux.

L'historique :
- Le **CLAUDE.md du repo** Check 4 dit explicitement : *"Pour toute opération DB : lire docs/db/gotchas.md. Ne JAMAIS deviner un nom de colonne. Le graph indexé contient l'inventaire courant."*
- La mémoire `feedback_never_improvise_rpcs.md` (réf MEMORY.md) dit : *"NE JAMAIS improviser une RPC, toujours lire l'ancienne version."*
- Aujourd'hui je n'ai même pas lu la version courante de invest_crowns avant la mig 133 ; j'ai écrit le SELECT couleur de tête.

Le coût : prod cassée, Uriel bloqué, hotfix à chaud (mig 138), confiance entamée.

## Antidote : check Graphify obligatoire

Avant chaque mig, ajouter dans la mig elle-même un commentaire `-- SCHEMA CHECKED:` qui liste les colonnes vérifiées. Ça force à le faire. Exemple :

```sql
-- 138_fix_invest_crowns_factions_columns.sql
-- SCHEMA CHECKED (2026-05-08) :
--   factions.color       : TEXT — confirmed via information_schema
--   factions.pattern     : TEXT — confirmed
--   factions.tag_id      : ❌ N'EXISTE PAS (était la source du bug 133)
--   tags.color           : TEXT — confirmed
--   tags.pattern_url     : ❌ N'EXISTE PAS
```

Si je n'ai pas posé cette ligne `SCHEMA CHECKED`, je n'ai pas le droit d'écrire la mig.

## Trace

- 8 mai 2026 — récidive #5. Hotfix mig 138 (`factions.color`, `factions.pattern`). Cette règle.
- Précédentes : `feedback_never_improvise_rpcs.md` (mai), `feedback_redef_rpc_copy_paste_baseline.md` (5/05).

## Ne pas coupler les sous-systèmes via PERFORM dans les RPCs SQL

Quand une RPC `A` (ex : `validate_emoji_throw`) appelle `PERFORM B(...)` (ex : `increment_quest_progress`) en SQL, toute exception de B remonte et fait échouer A. Conséquence concrète : le 2026-05-02, un bug d'ambiguïté `reward_xp` dans `increment_quest_progress` (mig 056) a rendu **100 % des clics emoji impossibles** (mig 060), alors que les emojis n'ont structurellement rien à voir avec le tracking de quêtes.

**Why:** chaque PERFORM côté serveur est un point de couplage caché qui survit aux refactors et aux hotfixes (la mig 058 a drop les triggers de quêtes mais a oublié de défaire les PERFORM dans validate_emoji_throw / react_to_note). On accumule de la dette invisible.

**How to apply:** côté serveur, les RPCs métier doivent rester monothématiques. Le tracking transverse (quêtes, analytics, achievements) se déclenche **côté client** après un succès, pas via PERFORM SQL. Si un side-effect SQL est strictement nécessaire (cohérence transactionnelle), envelopper dans un BEGIN/EXCEPTION WHEN OTHERS qui log et continue — jamais laisser une fonction tierce faire échouer le geste de l'utilisateur.

**À reprendre dans les 3 jours de cleanup post-V0.7.1** : auditer toutes les RPCs micro-social et quêtes pour découpler les PERFORM transverses.

## Pour redéfinir une RPC SQL, copier-coller la baseline ENTIÈRE

**Quand je dois redéfinir une RPC SQL existante (CREATE OR REPLACE FUNCTION), je dois COPIER-COLLER la version courante ENTIÈRE depuis la migration source, puis retirer JUSTE les parties à virer. Jamais réécrire de mémoire.**

**Why:** Le 5 mai 2026 (sprint Purification, batch B7), j'ai redéfini `get_place_by_id` dans la mig 074 sans copier-coller la baseline complète. Résultat : version grossièrement incomplète qui :
- Manquait des champs critiques (metrics, lastExplorers, type, beginAt/endAt/eraId/eraName/yearExact)
- Utilisait des noms de tables/colonnes différents (`image_media.place_id` au lieu de `reviews.place_id`)
- Renommait des champs (author.firstName au lieu de lastName)

→ Erreur prod immédiate : "column place_id does not exist", impossible d'accéder aux lieux. Hotfix urgent (mig 076) nécessaire.

**How to apply:**
1. Identifier la version COURANTE de la RPC (dernière `CREATE OR REPLACE FUNCTION` dans les migs).
2. **Read** intégralement cette version (du `CREATE` au `$$;` final).
3. La copier-coller telle quelle dans la nouvelle migration.
4. Retirer SEULEMENT les lignes à virer (refs aux colonnes droppées, blocs morts, etc.).
5. Vérifier que la SIGNATURE de retour reste compatible avec le frontend (PlaceDetail dans usePlace, etc. — relire le type TS si on touche au JSON build).
6. Tester dès que possible (`pnpm dlx supabase db push` puis essayer l'écran qui appelle la RPC).

Cette règle vaut aussi pour les RPCs qu'on modifie à plusieurs reprises dans un même sprint (ex: handle_new_user en B6 puis B7) — toujours partir de la dernière version, pas refaire de zéro.

## Vérifier manuellement avant DROP en prod (pas seulement rapport agent)

Ne jamais supprimer un artefact SQL (RPC, table, colonne, policy) en production sur la seule base d'un rapport d'agent d'investigation. Toujours re-vérifier manuellement chaque cible avant le DROP, avec plusieurs patterns de grep (guillemets simples, doubles, template literals, Promise.all, destructuring).

**Why:** Le 15 avril 2026, un agent Explore a marqué `get_place_detail_v05` comme morte (grep 0 résultat). J'ai commit migration 083+084 qui l'a droppée en prod. Résultat : plus aucun lieu n'affichait de récit/carnet/explorers/rating. L'appel était bien présent ligne `PlacePanel.tsx:433` dans un `Promise.all`, mais le grep de l'agent n'a pas matché cette syntaxe. Il a fallu restaurer via migration 085 en urgence.

**How to apply:** Avant tout DROP en prod d'un artefact SQL, pour chaque cible :
1. Grep avec `rpc('X'`, `rpc("X"`, et juste le nom `X` seul dans `apps/` et `packages/`
2. Lire les premières lignes de chaque hit pour confirmer contexte (pas dans un commentaire, pas dans un test archivé)
3. Vérifier aussi les appels internes SQL (autres fonctions qui pourraient appeler celle qu'on drop)
4. Si doute → NE PAS drop, demander à Uriel
5. Préférer un IF EXISTS idempotent qui peut être re-run sans casser

## Toujours signaler les buckets Supabase à créer

Toujours signaler à Uriel quand un nouveau bucket Supabase Storage doit être créé manuellement dans le dashboard.

**Why:** Les buckets ne peuvent pas être créés via migration SQL. Si le code référence un bucket qui n'existe pas, ça casse silencieusement. Uriel préfère être prévenu explicitement.

**How to apply:** À chaque fois qu'on écrit du code avec `.from('nouveau-bucket')`, dire à Uriel : "Crée le bucket `nouveau-bucket` (public/privé) dans le dashboard Supabase."

## Ne jamais oublier unlocks dans get_user_titles

Quand je réécris `get_user_titles`, TOUJOURS inclure `'unlocks', t.unlocks` dans les json_build_object — pour les titres généraux ET les titres faction.

**Why:** J'ai oublié ce champ 3 fois (migrations 182, 191, et probablement d'autres à venir). À chaque fois, le bouton "ajouter un lieu" se retrouve grisé pour tous les joueurs, même ceux qui ont le titre Explorateur. Le frontend fait `t.unlocks?.includes('add_place')` — sans le champ, ça retourne toujours `undefined`. Bug silencieux, pas d'erreur visible, frustrant pour les utilisateurs.

**How to apply:**
1. Avant de réécrire `get_user_titles`, LIRE la version actuelle (migration la plus récente)
2. Vérifier que `'unlocks', t.unlocks` est dans CHAQUE json_build_object (généraux + faction)
3. Plus généralement : ne jamais retirer un champ du retour d'une RPC sans vérifier qui le consomme côté frontend

## Il n'y a pas de table `fragments`

Le catalogue des Fragments est `title_fragments`. Côté Shopify, la clé d'un Fragment est le
`system.handle` du métaobjet Illustration (type `illustrations`, au pluriel) — jamais le tag
produit `fragment:*`, dont la casse varie (migs 251-253).
