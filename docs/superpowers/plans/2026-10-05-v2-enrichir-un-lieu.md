# Enrichir un lieu — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un récit partagé et trois rubriques pratiques (Accès, Quand y aller, Bon à savoir) + la case « Bivouac toléré », versionnés avec leur auteur, l'histoire qui montre l'ajouté et le retiré, l'histoire V1 reprise, la V1 en lecture seule.

**Architecture :** `versions_lieu` (mig 387) reste la source : une version est une photo complète de la fiche, on y ajoute les rubriques. Une seule fonction écrit (`modifier_lieu`) et tient à jour `places` et `place_contributions` (lus par la V1 et les pages SEO). La comparaison mot à mot se fait dans l'appli avec `diff`. Trois migrations : écriture (414), lecture (415), reprise de l'histoire V1 (416, après relecture de la liste par Uriel).

**Tech Stack :** Postgres/Supabase (plpgsql), React 19, TanStack Query 5, CSS modules + jetons, Vitest + jsdom, `diff` (jsdiff).

**Spec :** `docs/superpowers/specs/2026-10-05-v2-enrichir-un-lieu-design.md` (maquettes Figma « Enrichir — 1 à 4b », fichier `MKqyVhDPreg06PMEAaDxde`, nœuds 379:237, 379:324, 379:417, 379:523, 381:236).

## Global Constraints

- pnpm uniquement ; `pnpm dlx supabase` pour la CLI Supabase. TS strict : pas de `any`, `@ts-ignore`, `as unknown as`.
- Migrations : en-tête `-- WHY:` + `SCHEMA CHECKED`. Tout `CREATE OR REPLACE` part de la définition **live** copiée entière (`pg_get_functiondef`, voir Tâche 1 étape 1). Uriel applique : `pnpm dlx supabase db push --linked`. Test avant : `BEGIN … RAISE EXCEPTION 'BILAN %' … ROLLBACK` via `pnpm dlx supabase db query --linked -f <fichier>`.
- SQL et scripts écrits en fichiers Python dans le scratchpad (les heredocs bash cassent sur les apostrophes et les accents).
- Les noms d'utilisateur en SQL : `user_public_name(u.id, u.display_name, u.first_name)`.
- V2 : chaque fichier a son en-tête `QUOI / POURQUOI / (ATTENTION)` ; jetons CSS seulement (stylelint) ; les zones ne s'importent pas entre elles (partagé → `shared/`) ; toute image distante passe par `aLaTaille`.
- Rien de la V1 ne rentre dans la V2. Code mort croisé = supprimé dans le même commit. Objet back douteux → une ligne dans `docs/v2/purge-back.md`, même commit.
- Mots : « Le récit », « Infos en plus », « Accès », « Quand y aller », « Bon à savoir », « Bivouac toléré », « Récit de X » / « Récit partagé de X, Y et Z », « Un mot sur ta modification (facultatif) », « Il s'affiche dans l'histoire de la fiche, à côté de ton nom. », « Enrichir la fiche », « Enrichir dans la nouvelle appli ».
- Une rubrique : 1 000 signes au plus. Le récit : 1 à 5 000 signes.
- Conventional Commits, fin de message : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Déploiement : version Pythéas bumpée dans `apps/web-v2/package.json`, `pnpm build`, parcours testé dans le navigateur, déploiement Netlify manuel (`.claude/rules/deploiement.md`).

## Review Focus

1. **Un vieux front (onglet ouvert avant le déploiement) enregistre une modification** : il n'envoie pas les rubriques ; elles ne doivent pas être effacées. → `modifier_lieu` : paramètre absent (`NULL`) = inchangé, chaîne vide = vidé. Test SQL Tâche 1.
2. **Vider une rubrique** (effacer tout le texte de « Bon à savoir ») : la rubrique disparaît de la fiche, la version le montre en « retiré ». → test SQL Tâche 1 + test `ceQuiAChange` Tâche 5.
3. **Un lieu sans aucune révision V1** (61 lieux) : la reprise ne doit rien créer, l'histoire garde sa ligne d'origine synthétique. → bilan SQL Tâche 3.
4. **Un récit V1 vide dans `places.text`** (87 des 238) : la V2 affiche aujourd'hui une fiche sans récit ; après reprise, le récit V1. → bilan SQL Tâche 3 (compte des `places.text` vides après = 0 parmi les 238).
5. **Taper dans « Le récit », passer à « Infos en plus », revenir** : la saisie reste. → test Vitest Tâche 6.

---

### Tâche 1 : migration 414 — écrire (colonnes, `modifier_lieu`, V1 bloquée)

**Files :**
- Create : `supabase/migrations/414_enrichir_ecrire.sql` (généré par le script)
- Create (scratchpad) : `mig414.py`, `test414.sql`
- Modify : `docs/v2/purge-back.md`

**Interfaces :**
- Produces : `places.acces|quand|bon_a_savoir text`, `places.bivouac_tolere boolean`, mêmes colonnes dans `versions_lieu` ; `_etat_du_lieu(text)` → `(nom, natures, epoque, annee, recit, acces, quand, bon_a_savoir, bivouac_tolere)` ; `modifier_lieu(p_id text, p_nom text, p_natures text[], p_recit text, p_epoque text DEFAULT NULL, p_annee int DEFAULT NULL, p_note text DEFAULT NULL, p_acces text DEFAULT NULL, p_quand text DEFAULT NULL, p_bon_a_savoir text DEFAULT NULL, p_bivouac_tolere boolean DEFAULT NULL)` → `json {version}` ; `lieu_a_modifier(text)` renvoie en plus `acces, quand, bonASavoir, bivouacTolere`.

- [ ] **Étape 1 : récupérer les définitions live**

Script `scratchpad/live.py` (servira à toutes les tâches SQL) :

```python
import json, subprocess, sys
R = r'C:/Users/uriel/Desktop/DEVs/app (Runes de Chêne)'
S = r'C:/Users/uriel/AppData/Local/Temp/claude/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/6a7681b5-45ec-4d9f-91c8-27f26b70402e/scratchpad'

def live(signature):
    """La définition live d'une fonction, ex. 'public.modifier_lieu(text,text,text[],text,text,integer,text)'."""
    q = S + '/live.sql'
    open(q, 'w', encoding='utf-8').write(f"SELECT pg_get_functiondef('{signature}'::regprocedure) AS d;")
    out = subprocess.run(['pnpm', 'dlx', 'supabase', 'db', 'query', '--linked', '-f', q],
                         cwd=R, capture_output=True, shell=True).stdout.decode('utf-8')
    return json.loads(out[out.index('{'):])['rows'][0]['d'].rstrip() + ';'

if __name__ == '__main__':
    print(live(sys.argv[1]))
```

Run : `python live.py "public.modifier_lieu(text,text,text[],text,text,integer,text)"`
Expected : la fonction de la mig 387 (commence par `CREATE OR REPLACE FUNCTION public.modifier_lieu(`). Comparer à `387_faire_vivre_un_lieu.sql` : identique. Faire de même pour `public.revenir_a_version(bigint)`, `public.lieu_a_modifier(text)` (= mig 388), `public.edit_place_description(text,text,text)` (= mig 347) et `public.contribute_to_place(text,text,text,text,text)`.

- [ ] **Étape 2 : écrire le test qui doit échouer**

`scratchpad/test414.sql` est produit par `mig414.py` (étape 3) : `BEGIN;` + la migration + ce bloc + `ROLLBACK;`. Sans la migration, le bloc échoue sur `modifier_lieu(... p_acces => …)` (fonction inconnue).

```sql
DO $t$
DECLARE b text := ''; moi text; lieu text; x json; n int; e record;
BEGIN
  SELECT p.id, p.author_id INTO lieu, moi FROM places p
  WHERE p.author_id ~ '^[0-9a-f-]{36}$' AND p.masked IS NOT TRUE AND NULLIF(btrim(p.text), '') IS NOT NULL
  ORDER BY p.created_at DESC LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SELECT * INTO e FROM public._etat_du_lieu(lieu);
  -- 1. une rubrique seule fait une version, et met à jour places et place_contributions
  x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit, e.epoque, e.annee, 'test', p_acces => 'Par le sentier');
  b := b || 'acces=' || (SELECT acces FROM places WHERE id = lieu)
         || ' v=' || (SELECT acces FROM versions_lieu WHERE id = (x->>'version')::bigint)
         || ' v1=' || (SELECT content FROM place_contributions WHERE place_id = lieu AND type = 'accessibility');
  -- 2. un vieux front (sans rubriques) ne les efface pas
  x := public.modifier_lieu(lieu, e.nom || ' (t)', e.natures, e.recit, e.epoque, e.annee);
  b := b || ' garde=' || COALESCE((SELECT acces FROM places WHERE id = lieu), 'EFFACE');
  -- 3. chaîne vide = vidé
  x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit, e.epoque, e.annee, NULL, p_acces => '', p_bivouac_tolere => true);
  b := b || ' vide=' || COALESCE((SELECT acces FROM places WHERE id = lieu), 'NULL')
         || ' bivouac=' || (SELECT bivouac_tolere FROM places WHERE id = lieu)::text;
  -- 4. rien n'a changé
  BEGIN
    x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit, e.epoque, e.annee, NULL, p_bivouac_tolere => true);
    b := b || ' rien=NON';
  EXCEPTION WHEN others THEN b := b || ' rien=' || SQLERRM;
  END;
  -- 5. rubrique trop longue
  BEGIN
    x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit, e.epoque, e.annee, NULL, p_quand => repeat('a', 1001));
    b := b || ' long=NON';
  EXCEPTION WHEN others THEN b := b || ' long=' || SQLSTATE;
  END;
  -- 6. la V1 ne peut plus écrire le récit ni les rubriques
  BEGIN
    x := public.edit_place_description(moi, lieu, 'texte V1');
    b := b || ' v1recit=PASSE';
  EXCEPTION WHEN others THEN b := b || ' v1recit=' || SQLERRM;
  END;
  BEGIN
    x := public.contribute_to_place(moi, lieu, 'season', 'été');
    b := b || ' v1saison=PASSE';
  EXCEPTION WHEN others THEN b := b || ' v1saison=' || SQLERRM;
  END;
  SELECT count(*) INTO n FROM versions_lieu WHERE place_id = lieu;
  b := b || ' versions=' || n;
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

- [ ] **Étape 3 : écrire `mig414.py`**

```python
from live import live, R, S

def r(s, x, y):
    assert x in s, x[:70]
    return s.replace(x, y, 1)

modifier = live('public.modifier_lieu(text,text,text[],text,text,integer,text)')
modifier = r(modifier, """  p_note text DEFAULT NULL::text
)""", """  p_note text DEFAULT NULL::text,
  p_acces text DEFAULT NULL::text,
  p_quand text DEFAULT NULL::text,
  p_bon_a_savoir text DEFAULT NULL::text,
  p_bivouac_tolere boolean DEFAULT NULL::boolean
)""")
modifier = r(modifier, """  v_version bigint;
BEGIN""", """  v_version bigint;
  -- 414 : une rubrique absente (NULL, un vieux front) reste telle quelle ; vide ('') = effacée.
  v_acces text;
  v_quand text;
  v_bon text;
  v_bivouac boolean;
BEGIN""")
modifier = r(modifier, """  SELECT * INTO v_avant FROM public._etat_du_lieu(p_id);""", """  SELECT * INTO v_avant FROM public._etat_du_lieu(p_id);
  v_acces := CASE WHEN p_acces IS NULL THEN v_avant.acces ELSE NULLIF(btrim(p_acces), '') END;
  v_quand := CASE WHEN p_quand IS NULL THEN v_avant.quand ELSE NULLIF(btrim(p_quand), '') END;
  v_bon := CASE WHEN p_bon_a_savoir IS NULL THEN v_avant.bon_a_savoir ELSE NULLIF(btrim(p_bon_a_savoir), '') END;
  v_bivouac := COALESCE(p_bivouac_tolere, v_avant.bivouac_tolere);
  IF greatest(char_length(v_acces), char_length(v_quand), char_length(v_bon)) > 1000 THEN
    RAISE EXCEPTION 'Une rubrique de 1000 signes au plus' USING ERRCODE = '22023';
  END IF;""")
modifier = r(modifier, """     AND v_avant.annee IS NOT DISTINCT FROM p_annee AND v_avant.recit = v_recit THEN""",
             """     AND v_avant.annee IS NOT DISTINCT FROM p_annee AND v_avant.recit = v_recit
     AND v_avant.acces IS NOT DISTINCT FROM v_acces AND v_avant.quand IS NOT DISTINCT FROM v_quand
     AND v_avant.bon_a_savoir IS NOT DISTINCT FROM v_bon AND v_avant.bivouac_tolere = v_bivouac THEN""")
modifier = r(modifier, """    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit)
    VALUES (p_id, v_auteur, v_cree, v_avant.nom, v_avant.natures, v_avant.epoque, v_avant.annee, v_avant.recit);""",
             """    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere)
    VALUES (p_id, v_auteur, v_cree, v_avant.nom, v_avant.natures, v_avant.epoque, v_avant.annee, v_avant.recit,
            v_avant.acces, v_avant.quand, v_avant.bon_a_savoir, v_avant.bivouac_tolere);""")
modifier = r(modifier, """  UPDATE places SET title = v_nom, text = v_recit, era_id = p_epoque, year_exact = p_annee, updated_at = now()""",
             """  UPDATE places SET title = v_nom, text = v_recit, era_id = p_epoque, year_exact = p_annee,
    acces = v_acces, quand = v_quand, bon_a_savoir = v_bon, bivouac_tolere = v_bivouac, updated_at = now()""")
modifier = r(modifier, """  INSERT INTO versions_lieu (place_id, auteur, nom, natures, epoque, annee, recit, note)
  VALUES (p_id, v_moi, v_nom, p_natures, p_epoque, p_annee, v_recit, v_note)""",
             """  -- 414 : les rubriques aussi restent lisibles par la V1 et les pages SEO (une ligne par lieu et par type).
  PERFORM public._rubrique_v1(p_id, v_moi, 'accessibility', v_avant.acces, v_acces);
  PERFORM public._rubrique_v1(p_id, v_moi, 'season', v_avant.quand, v_quand);
  PERFORM public._rubrique_v1(p_id, v_moi, 'warning', v_avant.bon_a_savoir, v_bon);

  INSERT INTO versions_lieu (place_id, auteur, nom, natures, epoque, annee, recit, note,
                             acces, quand, bon_a_savoir, bivouac_tolere)
  VALUES (p_id, v_moi, v_nom, p_natures, p_epoque, p_annee, v_recit, v_note,
          v_acces, v_quand, v_bon, v_bivouac)""")

revenir = live('public.revenir_a_version(bigint)')
revenir = r(revenir, """  RETURN public.modifier_lieu(v.place_id, v.nom, v.natures, v.recit, v.epoque, v.annee,
    'Retour à la version du ' || to_char(v.cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'));""",
            """  -- 414 : les rubriques reviennent aussi ('' : une rubrique vide le redevient).
  RETURN public.modifier_lieu(v.place_id, v.nom, v.natures, v.recit, v.epoque, v.annee,
    'Retour à la version du ' || to_char(v.cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
    COALESCE(v.acces, ''), COALESCE(v.quand, ''), COALESCE(v.bon_a_savoir, ''), v.bivouac_tolere);""")

a_modifier = live('public.lieu_a_modifier(text)')
a_modifier = r(a_modifier, """      'annee', e.annee, 'recit', e.recit,""", """      'annee', e.annee, 'recit', e.recit,
      'acces', e.acces, 'quand', e.quand, 'bonASavoir', e.bon_a_savoir, 'bivouacTolere', e.bivouac_tolere,""")

GARDE = """  -- 414 : la V1 est en lecture seule pour le récit et les rubriques ; on enrichit dans la V2.
  RAISE EXCEPTION 'Enrichis ce lieu dans la nouvelle appli' USING ERRCODE = 'P0001', HINT = 'v2';
"""
v1recit = live('public.edit_place_description(text,text,text)')
v1recit = r(v1recit, 'BEGIN\n', 'BEGIN\n' + GARDE)
v1contrib = live('public.contribute_to_place(text,text,text,text,text)')
v1contrib = r(v1contrib, 'BEGIN\n', """BEGIN
  IF p_type IN ('description', 'accessibility', 'season', 'warning') THEN
""" + GARDE.replace('  ', '    ', 2) + """  END IF;
""")

head = """-- WHY: enrichir un lieu (spec 2026-10-05-v2-enrichir-un-lieu-design) : trois rubriques pratiques
--      (accès, quand y aller, bon à savoir) et la case « bivouac toléré », versionnées comme le récit.
--      modifier_lieu reste la seule à écrire ; elle tient à jour places et place_contributions (V1, SEO).
--      La V1 ne peut plus écrire le récit ni les rubriques (Uriel, 05/10 : V1 en lecture seule).
-- SCHEMA CHECKED (05/10/2026) : versions_lieu(id, place_id, auteur, cree_le, nom, natures, epoque, annee,
--      recit, note) ; places(text, accessibility, best_season, bivouac, updated_at) ;
--      place_contributions(place_id, user_id, type, content, created_at, updated_at), une ligne par
--      lieu et par type ; définitions live de modifier_lieu (387), revenir_a_version (387),
--      lieu_a_modifier (388), edit_place_description (347), contribute_to_place (baseline).
-- DROP vérifiés : _etat_du_lieu(text) n'est lue que par modifier_lieu et lieu_a_modifier (recréées
--      ici) ; l'ancienne signature de modifier_lieu n'est appelée que par revenir_a_version (recréée).

ALTER TABLE public.places
  ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text,
  ADD COLUMN bivouac_tolere boolean NOT NULL DEFAULT false;
ALTER TABLE public.versions_lieu
  ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text,
  ADD COLUMN bivouac_tolere boolean NOT NULL DEFAULT false;

DROP FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text);
DROP FUNCTION public._etat_du_lieu(text);
CREATE FUNCTION public._etat_du_lieu(p_id text)
 RETURNS TABLE (nom text, natures text[], epoque text, annee int, recit text,
                acces text, quand text, bon_a_savoir text, bivouac_tolere boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.title::text,
         COALESCE((SELECT array_agg(t.tag_id::text ORDER BY t.is_primary DESC, t.tag_id)
                   FROM place_tags t WHERE t.place_id = p.id), '{}'),
         p.era_id::text, p.year_exact, COALESCE(p.text, ''),
         p.acces, p.quand, p.bon_a_savoir, p.bivouac_tolere
  FROM places p WHERE p.id = p_id;
$function$;
REVOKE ALL ON FUNCTION public._etat_du_lieu(text) FROM PUBLIC, anon, authenticated;

-- Une rubrique changée rejoint place_contributions (lue par la V1 et les pages SEO) ; vidée, sa ligne part.
CREATE FUNCTION public._rubrique_v1(p_id text, p_qui text, p_type text, p_avant text, p_apres text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_avant IS NOT DISTINCT FROM p_apres THEN
    RETURN;
  END IF;
  IF p_apres IS NULL THEN
    DELETE FROM place_contributions WHERE place_id = p_id AND type = p_type;
    RETURN;
  END IF;
  UPDATE place_contributions SET content = p_apres, user_id = p_qui, updated_at = now()
  WHERE place_id = p_id AND type = p_type;
  IF NOT FOUND THEN
    INSERT INTO place_contributions (place_id, user_id, type, content, created_at, updated_at)
    VALUES (p_id, p_qui, p_type, p_apres, now(), now());
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._rubrique_v1(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

"""
grants = """
REVOKE ALL ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text, text, text, text, boolean) TO authenticated;
"""
out = head + modifier + '\n' + grants + '\n' + revenir + '\n\n' + a_modifier + '\n\n' + v1recit + '\n\n' + v1contrib + '\n'
open(R + '/supabase/migrations/414_enrichir_ecrire.sql', 'w', encoding='utf-8', newline='\n').write(out)
test = open(S + '/test414_bloc.sql', encoding='utf-8').read()
open(S + '/test414.sql', 'w', encoding='utf-8').write('BEGIN;\n' + out + '\n' + test + '\nROLLBACK;\n')
print('ok')
```

(Le bloc de l'étape 2 est enregistré dans `scratchpad/test414_bloc.sql`.) La définition live de `modifier_lieu` est `CREATE OR REPLACE` : comme l'ancienne signature vient d'être supprimée, elle crée la nouvelle.

Run : `python mig414.py` puis `pnpm dlx supabase db query --linked -f scratchpad/test414.sql`
Expected : `BILAN acces=Par le sentier v=Par le sentier v1=Par le sentier garde=Par le sentier vide=NULL bivouac=true rien=Rien n’a changé long=22023 v1recit=Enrichis ce lieu dans la nouvelle appli v1saison=Enrichis ce lieu dans la nouvelle appli versions=4` (origine + 3 versions). Si une `r()` échoue sur une assertion : la définition live diffère du fichier — relire la définition live et ajuster le motif, jamais l'inverse.

- [ ] **Étape 4 : registre de purge**

Ajouter au tableau « 1. À supprimer après bascule » de `docs/v2/purge-back.md` :

```markdown
| `places.accessibility`, `places.best_season`, `places.bivouac` | remplacées par `acces`, `quand`, `bivouac_tolere` (mig 414) ; plus lues par la V2 | supprimer | après bascule | spec enrichir 05/10 |
| `edit_place_description`, `restore_place_description_revision`, `get_place_description_history`, `place_description_revisions`, `contribute_to_place` (types texte), `_rubrique_v1` | V1 en lecture seule (mig 414) ; l'histoire vit dans `versions_lieu` | supprimer | quand la V1 s'arrête | spec enrichir 05/10 |
```

- [ ] **Étape 5 : Uriel applique, je vérifie, je régénère les types**

Demander à Uriel : `! cd "/c/Users/uriel/Desktop/DEVs/app (Runes de Chêne)" && pnpm dlx supabase db push --linked`.
Puis : `python live.py "public.modifier_lieu(text,text,text[],text,text,integer,text,text,text,text,boolean)"` → la définition contient `_rubrique_v1`. Puis `pnpm --filter web-v2 gen:types` ; `git diff --stat apps/web-v2/src/shared/supabase/database.types.ts` montre `p_acces`.

- [ ] **Étape 6 : commit**

```bash
git add supabase/migrations/414_enrichir_ecrire.sql docs/v2/purge-back.md apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(db): enrichir un lieu — les rubriques et le bivouac s'ecrivent en versions, la V1 en lecture seule (mig 414)"
```

---

### Tâche 2 : migration 415 — lire (fiche, histoire, une version, Sur les chemins)

**Files :**
- Create : `supabase/migrations/415_enrichir_lire.sql` ; scratchpad `mig415.py`, `test415_bloc.sql`

**Interfaces :**
- Consumes : colonnes de la Tâche 1.
- Produces :
  - `fiche_lieu(text)` : `faits` = `{epoque, annee}` seulement ; en plus `rubriques: {acces, quand, bonASavoir}` (chaînes ou null), `bivouacTolere: boolean`, `recitPar: [{id, nom, avatar}]` ; **plus de** `enrichiPar`.
  - `histoire_du_lieu(text)` : `champs` ⊂ `nom | natures | epoque | recit | acces | quand | bon_a_savoir | bivouac`.
  - `version_du_lieu(p_version bigint)` → `{id, quand, note, qui: {id, nom, avatar}|null, champs: [{champ, avant, apres}]}` (champs textuels changés : `recit`, `acces`, `quand`, `bon_a_savoir` ; `avant`/`apres` chaînes, `''` si vide) ; `null` si introuvable ou lieu invisible.
  - `sur_les_chemins` : type `enrichi` (récit ou rubrique changés) ou `modifie` (le reste), lus dans `versions_lieu` ; `_auteur_du_chemin` connaît `enrichi` et `modifie` par `versions_lieu`.

- [ ] **Étape 1 : le test qui échoue** — `scratchpad/test415_bloc.sql` :

```sql
DO $t$
DECLARE b text := ''; moi text; lieu text; e record; x json; f json; v json; c json;
BEGIN
  SELECT p.id, p.author_id INTO lieu, moi FROM places p
  WHERE p.author_id ~ '^[0-9a-f-]{36}$' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    AND NULLIF(btrim(p.text), '') IS NOT NULL
  ORDER BY p.created_at DESC LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SELECT * INTO e FROM public._etat_du_lieu(lieu);
  x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit || ' Ajout.', e.epoque, e.annee, 'un mot');
  x := public.modifier_lieu(lieu, e.nom, e.natures, e.recit || ' Ajout.', e.epoque, e.annee, NULL, p_acces => 'Sentier');
  f := public.fiche_lieu(lieu);
  b := 'rubriques=' || (f->'rubriques')::text || ' bivouac=' || (f->>'bivouacTolere')
    || ' recitPar=' || json_array_length(f->'recitPar') || ' enrichiPar=' || COALESCE(f->>'enrichiPar', 'absent')
    || ' faits=' || (f->'faits')::text;
  v := public.version_du_lieu((x->>'version')::bigint);
  b := b || ' version=' || (v->'champs')::text;
  SELECT y INTO c FROM json_array_elements(public.histoire_du_lieu(lieu)) y LIMIT 1;
  b := b || ' histoire=' || (c->'champs')::text;
  SELECT y INTO c FROM json_array_elements(public.sur_les_chemins(50)) y
  WHERE y->>'id' LIKE 'enrichi:' || lieu || ':%' LIMIT 1;
  b := b || ' chemin=' || COALESCE(c->>'type', 'aucun');
  x := public.modifier_lieu(lieu, e.nom || ' bis', e.natures, e.recit || ' Ajout.', e.epoque, e.annee);
  SELECT y INTO c FROM json_array_elements(public.sur_les_chemins(50)) y
  WHERE y->>'id' LIKE 'modifie:' || lieu || ':%' LIMIT 1;
  b := b || ' modifie=' || COALESCE(c->>'type', 'aucun')
    || ' auteur=' || COALESCE(public._auteur_du_chemin(c->>'id') = moi, false)::text;
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

Note : l'auteur du lieu modifie son propre lieu ; `sur_les_chemins` garde une ligne par personne, par type et par jour, et le type `enrichi` vs `modifie` les sépare.

- [ ] **Étape 2 : `mig415.py`**

```python
from live import live, R, S

def r(s, x, y):
    assert x in s, x[:70]
    return s.replace(x, y, 1)

fiche = live('public.fiche_lieu(text)')
fiche = r(fiche, """      'annee', l.year_exact,
      'saison', NULLIF(btrim(l.best_season), ''),
      'acces', NULLIF(btrim(l.accessibility), ''),
      'bivouac', NULLIF(btrim(l.bivouac), '')),""", """      'annee', l.year_exact),
    -- 415 : les rubriques pratiques et le bivouac (mig 414), écrits en versions comme le récit.
    'rubriques', json_build_object('acces', l.acces, 'quand', l.quand, 'bonASavoir', l.bon_a_savoir),
    'bivouacTolere', l.bivouac_tolere,""")
fiche = r(fiche, """    'enrichiPar', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name))
      FROM place_description_revisions r JOIN users u ON u.id = r.edited_by
      WHERE r.place_id = l.id AND r.edited_by IS DISTINCT FROM l.author_id
      ORDER BY r.created_at DESC LIMIT 1),""", """    -- 415 : « Récit partagé de… » — qui a changé le texte du récit, par ordre d'arrivée (l'origine
    -- comprise ; sans version, l'auteur seul).
    'recitPar', COALESCE((
      SELECT json_agg(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                        'avatar', u.avatar_url) ORDER BY a.premiere)
      FROM (
        SELECT w.auteur, min(w.cree_le) AS premiere
        FROM (SELECT v.auteur, v.cree_le, v.recit, lag(v.id) OVER o AS precedente, lag(v.recit) OVER o AS recit_avant
              FROM versions_lieu v WHERE v.place_id = l.id WINDOW o AS (ORDER BY v.cree_le, v.id)) w
        WHERE w.auteur IS NOT NULL AND (w.precedente IS NULL OR w.recit IS DISTINCT FROM w.recit_avant)
        GROUP BY w.auteur) a
      JOIN users u ON u.id = a.auteur),
      CASE WHEN l.author_id IS NULL OR EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = l.id) THEN '[]'::json
      ELSE (SELECT json_build_array(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                                      'avatar', u.avatar_url)) FROM users u WHERE u.id = l.author_id) END),""")

histoire = live('public.histoire_du_lieu(text)')
histoire = r(histoire, """           lag(recit) OVER w AS recit_avant, lag(id) OVER w AS precedente""",
             """           lag(recit) OVER w AS recit_avant, lag(id) OVER w AS precedente,
           acces, quand, bon_a_savoir, bivouac_tolere,
           lag(acces) OVER w AS acces_avant, lag(quand) OVER w AS quand_avant,
           lag(bon_a_savoir) OVER w AS bon_avant, lag(bivouac_tolere) OVER w AS bivouac_avant""")
histoire = r(histoire, """        CASE WHEN precedente IS NOT NULL AND recit IS DISTINCT FROM recit_avant THEN 'recit' END], NULL) AS champs""",
             """        CASE WHEN precedente IS NOT NULL AND recit IS DISTINCT FROM recit_avant THEN 'recit' END,
        CASE WHEN precedente IS NOT NULL AND acces IS DISTINCT FROM acces_avant THEN 'acces' END,
        CASE WHEN precedente IS NOT NULL AND quand IS DISTINCT FROM quand_avant THEN 'quand' END,
        CASE WHEN precedente IS NOT NULL AND bon_a_savoir IS DISTINCT FROM bon_avant THEN 'bon_a_savoir' END,
        CASE WHEN precedente IS NOT NULL AND bivouac_tolere IS DISTINCT FROM bivouac_avant THEN 'bivouac' END], NULL) AS champs""")

auteur = live('public._auteur_du_chemin(text)')
auteur = r(auteur, """    WHEN 'enrichi' THEN (
      SELECT d.edited_by FROM place_description_revisions d JOIN places p ON p.id = d.place_id
      WHERE d.place_id = split_part(p_evenement, ':', 2) AND d.edited_by = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)""", """    -- 415 : enrichi ou modifié, l'auteur d'une version (versions_lieu, où la mig 416 a versé la V1).
    WHEN 'enrichi' THEN (
      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id
      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
    WHEN 'modifie' THEN (
      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id
      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)""")

chemins = live('public.sur_les_chemins(integer)')
chemins = r(chemins, """    -- 406 : le récit enrichi (V1 et V2 écrivent place_description_revisions), sauf le récit de
    -- départ, posé par l'auteur à l'ajout.
    (SELECT 'enrichi:' || d.place_id || ':' || d.edited_by || ':'
              || floor(extract(epoch FROM d.created_at))::bigint,
            'enrichi', d.created_at, d.edited_by, d.place_id
     FROM place_description_revisions d JOIN places p ON p.id = d.place_id
     WHERE d.edited_by IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
       AND NOT (d.edited_by = p.author_id AND d.created_at < p.created_at + interval '10 minutes')
     ORDER BY d.created_at DESC LIMIT 200)""", """    -- 415 : chaque version sauf l'origine (Uriel, 05/10 : « quand on enrichit / modifie un lieu ») ;
    -- « enrichi » si le récit ou une rubrique a changé, « modifié » sinon.
    (SELECT w.genre || ':' || w.place_id || ':' || w.auteur || ':' || floor(extract(epoch FROM w.cree_le))::bigint,
            w.genre, w.cree_le, w.auteur, w.place_id
     FROM (
       SELECT v.place_id, v.auteur, v.cree_le, lag(v.id) OVER o AS precedente,
              CASE WHEN v.recit IS DISTINCT FROM lag(v.recit) OVER o
                     OR v.acces IS DISTINCT FROM lag(v.acces) OVER o
                     OR v.quand IS DISTINCT FROM lag(v.quand) OVER o
                     OR v.bon_a_savoir IS DISTINCT FROM lag(v.bon_a_savoir) OVER o
                   THEN 'enrichi' ELSE 'modifie' END AS genre
       FROM versions_lieu v WINDOW o AS (PARTITION BY v.place_id ORDER BY v.cree_le, v.id)) w
     JOIN places p ON p.id = w.place_id
     WHERE w.precedente IS NOT NULL AND w.auteur IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY w.cree_le DESC LIMIT 200)""")

version = """-- Une version et la précédente : les textes qui ont changé (récit, rubriques), pour la feuille
-- « Une version » ; la comparaison mot à mot se fait dans l'appli. null : introuvable ou invisible.
CREATE FUNCTION public.version_du_lieu(p_version bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (SELECT * FROM versions_lieu WHERE id = p_version),
  avant AS (
    SELECT p.* FROM versions_lieu p, v
    WHERE p.place_id = v.place_id AND (p.cree_le, p.id) < (v.cree_le, v.id)
    ORDER BY p.cree_le DESC, p.id DESC LIMIT 1)
  SELECT CASE WHEN NOT public._lieu_visible(v.place_id) THEN NULL ELSE json_build_object(
    'id', v.id,
    'quand', v.cree_le,
    'note', v.note,
    'qui', (SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
            FROM users u WHERE u.id = v.auteur),
    'champs', COALESCE((
      SELECT json_agg(json_build_object('champ', c.champ, 'avant', COALESCE(c.avant, ''), 'apres', COALESCE(c.apres, '')) ORDER BY c.rang)
      FROM (VALUES (1, 'recit', a.recit, v.recit), (2, 'acces', a.acces, v.acces),
                   (3, 'quand', a.quand, v.quand), (4, 'bon_a_savoir', a.bon_a_savoir, v.bon_a_savoir)) c(rang, champ, avant, apres)
      WHERE c.avant IS DISTINCT FROM c.apres), '[]'::json)) END
  FROM v LEFT JOIN avant a ON true;
$function$;
REVOKE ALL ON FUNCTION public.version_du_lieu(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.version_du_lieu(bigint) TO authenticated;
"""

head = """-- WHY: enrichir un lieu, la lecture : la fiche lit les rubriques, le bivouac et « Récit partagé de… »
--      (recitPar remplace enrichiPar) ; l'histoire nomme les rubriques ; version_du_lieu donne l'avant
--      et l'après d'une version ; « Sur les chemins » lit versions_lieu (enrichi / modifié, Uriel 05/10).
-- SCHEMA CHECKED (05/10/2026) : colonnes de la mig 414 ; définitions live de fiche_lieu (395),
--      histoire_du_lieu (387), sur_les_chemins (413), _auteur_du_chemin (410).

"""
out = head + fiche + '\n\n' + histoire + '\n\n' + version + '\n' + auteur + '\n\n' + chemins + '\n'
open(R + '/supabase/migrations/415_enrichir_lire.sql', 'w', encoding='utf-8', newline='\n').write(out)
test = open(S + '/test415_bloc.sql', encoding='utf-8').read()
mig414 = open(R + '/supabase/migrations/414_enrichir_ecrire.sql', encoding='utf-8').read()
open(S + '/test415.sql', 'w', encoding='utf-8').write('BEGIN;\n' + out + '\n' + test + '\nROLLBACK;\n')
print('ok')
```

- [ ] **Étape 3 : lancer le test**

Run : `python mig415.py` puis `pnpm dlx supabase db query --linked -f scratchpad/test415.sql` (la 414 est déjà en prod).
Expected : `BILAN rubriques={"acces" : "Sentier", "quand" : null, "bonASavoir" : null} bivouac=false recitPar=1 enrichiPar=absent faits={"epoque" : …, "annee" : …} version=[{"champ" : "acces", "avant" : "", "apres" : "Sentier"}] histoire=["acces"] chemin=enrichi modifie=modifie auteur=true`. `recitPar=1` : l'auteur seul (il a fait l'origine et l'ajout).

- [ ] **Étape 4 : Uriel applique, je vérifie**

**Ordre** : la 415 fait lire « Sur les chemins » et `_auteur_du_chemin` dans `versions_lieu`, où l'histoire V1 n'entre qu'avec la 416. Ne pas pousser la 415 seule : écrire d'abord la 416 (Tâche 3, liste relue par Uriel), puis Uriel pousse **415 et 416 ensemble** (`pnpm dlx supabase db push --linked` les applique dans l'ordre). Puis `pnpm --filter web-v2 gen:types` (ajoute `version_du_lieu`). Le commit de la Tâche 2 peut précéder la poussée.

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations/415_enrichir_lire.sql apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(db): enrichir un lieu — la fiche, l'histoire, une version et Sur les chemins lisent les rubriques (mig 415)"
```

---

### Tâche 3 : migration 416 — reprendre l'histoire de la V1 (avec la liste relue par Uriel)

**Files :**
- Create : `supabase/migrations/416_enrichir_histoire_v1.sql`, scratchpad `liste238.sql`, `liste238.md`, `test416.sql`

**Interfaces :**
- Consumes : colonnes de la Tâche 1. Produces : des versions pour chaque lieu qui a une histoire V1 ; `places.text|acces|quand|bon_a_savoir` = l'état final de cette histoire.

Faits vérifiés le 05/10 : 3 497 lieux, 3 436 avec révisions, 3 328 avec la révision « graine » (posée à l'ajout, < 10 min) ; 238 divergents, dont **la contribution V1 égale la dernière révision dans 238 cas sur 238** (la dernière révision est donc le texte V1 actuel) ; 87 des 238 ont `places.text` vide ; quelques `places.text` n'existent dans aucune révision (le texte d'origine d'avant l'historique). Un seul lieu a déjà des versions V2 (4 lignes) : il est sauté et listé.

- [ ] **Étape 1 : la liste pour Uriel (lecture seule)**

`scratchpad/liste238.sql` :

```sql
SELECT p.id, p.title AS lieu, left(COALESCE(p.text, ''), 160) AS texte_v2_actuel,
       left(r.content, 160) AS texte_garde, r.created_at AS ecrit_le,
       user_public_name(u.id, u.display_name, u.first_name) AS par,
       EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = p.id) AS deja_en_versions
FROM places p
JOIN LATERAL (SELECT * FROM place_description_revisions x WHERE x.place_id = p.id
              ORDER BY x.created_at DESC LIMIT 1) r ON true
LEFT JOIN users u ON u.id = r.edited_by
WHERE r.content IS DISTINCT FROM p.text
ORDER BY p.title;
```

Run : `pnpm dlx supabase db query --linked -f scratchpad/liste238.sql`, puis mettre le résultat en tableau dans `scratchpad/liste238.md` (lieu, texte V2 actuel, texte gardé, écrit le, par).
Expected : 238 lignes ; la Chapelle de la Madeleine (`1e45225b-d374-48fb-a93b-bf1344836043`) y est, « En cours d'écriture » → ses 390 signes.

- [ ] **Étape 2 : STOP — Uriel relit la liste**

Lui montrer : le nombre, les 10 premières lignes, les cas où le texte V2 actuel n'est ni vide ni un « à venir » (le texte V2 serait remplacé), et le lieu déjà en versions. Il dit « go » ou désigne les lieux à garder en V2. Les lieux à garder vont dans un tableau `garder text[]` en tête de la migration (vide par défaut). Ne rien appliquer avant son accord.

- [ ] **Étape 3 : écrire la migration**

`supabase/migrations/416_enrichir_histoire_v1.sql` :

```sql
-- WHY: l'histoire de la V1 entre dans versions_lieu (spec enrichir, « voir les ajouts de chacun ») : chaque
--      révision de récit (place_description_revisions) et chaque rubrique V1 (place_contributions
--      accessibility / season / warning) devient une version, avec son auteur et sa date. L'état final
--      devient la fiche : les 238 lieux où la V2 lisait un autre récit que la V1 prennent le plus récent
--      (liste relue par Uriel le <date>). Le nom, les natures et l'époque des versions reprises sont ceux
--      d'aujourd'hui (la V1 ne les historisait pas).
-- SCHEMA CHECKED (05/10/2026) : place_description_revisions(place_id, content, edited_by, created_at) ;
--      place_contributions(place_id, user_id, type, content, created_at, updated_at), une ligne par lieu
--      et par type ; versions_lieu (mig 414) ; _etat_du_lieu (mig 414).
DO $m$
DECLARE
  garder text[] := '{}'; -- les lieux qu'Uriel garde tels quels en V2 (étape 2)
  l record;
  e record;
  ev record;
  etat record;
  v_recit text;
  v_acces text;
  v_quand text;
  v_bon text;
BEGIN
  FOR l IN
    SELECT p.* FROM places p
    WHERE NOT EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = p.id)
      AND p.id <> ALL (garder)
      AND (EXISTS (SELECT 1 FROM place_description_revisions d WHERE d.place_id = p.id)
           OR EXISTS (SELECT 1 FROM place_contributions c WHERE c.place_id = p.id
                      AND c.type IN ('accessibility', 'season', 'warning') AND NULLIF(btrim(c.content), '') IS NOT NULL))
  LOOP
    SELECT * INTO etat FROM public._etat_du_lieu(l.id);
    -- L'origine : la révision posée à l'ajout ; sinon le texte de la fiche s'il n'est dans aucune
    -- révision (écrit avant l'historique) ; sinon la première révision.
    v_recit := COALESCE(
      (SELECT d.content FROM place_description_revisions d
       WHERE d.place_id = l.id AND d.created_at < l.created_at + interval '10 minutes'
       ORDER BY d.created_at LIMIT 1),
      (SELECT l.text WHERE NULLIF(btrim(l.text), '') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM place_description_revisions d WHERE d.place_id = l.id AND d.content = l.text)),
      (SELECT d.content FROM place_description_revisions d WHERE d.place_id = l.id ORDER BY d.created_at LIMIT 1),
      '');
    v_acces := NULL; v_quand := NULL; v_bon := NULL;
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere)
    VALUES (l.id, l.author_id, l.created_at, etat.nom, etat.natures, etat.epoque, etat.annee, v_recit,
            NULL, NULL, NULL, false);

    FOR ev IN
      SELECT d.created_at AS quand, d.edited_by AS qui, 'recit' AS champ, d.content AS valeur
      FROM place_description_revisions d WHERE d.place_id = l.id
      UNION ALL
      SELECT COALESCE(c.updated_at, c.created_at), c.user_id,
             CASE c.type WHEN 'accessibility' THEN 'acces' WHEN 'season' THEN 'quand' ELSE 'bon_a_savoir' END,
             NULLIF(btrim(c.content), '')
      FROM place_contributions c WHERE c.place_id = l.id AND c.type IN ('accessibility', 'season', 'warning')
      ORDER BY 1
    LOOP
      -- Ce qui ne change rien (la révision-graine, déjà l'origine) ne fait pas de version.
      CONTINUE WHEN (ev.champ = 'recit' AND ev.valeur IS NOT DISTINCT FROM v_recit)
                 OR (ev.champ = 'acces' AND ev.valeur IS NOT DISTINCT FROM v_acces)
                 OR (ev.champ = 'quand' AND ev.valeur IS NOT DISTINCT FROM v_quand)
                 OR (ev.champ = 'bon_a_savoir' AND ev.valeur IS NOT DISTINCT FROM v_bon);
      IF ev.champ = 'recit' THEN v_recit := COALESCE(ev.valeur, ''); END IF;
      IF ev.champ = 'acces' THEN v_acces := ev.valeur; END IF;
      IF ev.champ = 'quand' THEN v_quand := ev.valeur; END IF;
      IF ev.champ = 'bon_a_savoir' THEN v_bon := ev.valeur; END IF;
      INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                                 acces, quand, bon_a_savoir, bivouac_tolere)
      VALUES (l.id, ev.qui, greatest(ev.quand, l.created_at + interval '1 second'), etat.nom, etat.natures,
              etat.epoque, etat.annee, v_recit, v_acces, v_quand, v_bon, false);
    END LOOP;

    UPDATE places SET text = v_recit, acces = v_acces, quand = v_quand, bon_a_savoir = v_bon
    WHERE id = l.id;
  END LOOP;
END $m$;
```

Note : `UPDATE places` sans toucher `updated_at` : la reprise n'est pas une modification.

- [ ] **Étape 4 : le test (bilan)**

`scratchpad/test416.sql` = `BEGIN;` + la migration + :

```sql
DO $t$
DECLARE b text;
BEGIN
  SELECT 'versions=' || (SELECT count(*) FROM versions_lieu)
    || ' lieux=' || (SELECT count(DISTINCT place_id) FROM versions_lieu)
    || ' divergents=' || (SELECT count(*) FROM places p JOIN place_contributions c ON c.place_id = p.id
                          AND c.type = 'description' WHERE c.content IS DISTINCT FROM p.text)
    || ' chapelle=' || (SELECT left(text, 40) FROM places WHERE id = '1e45225b-d374-48fb-a93b-bf1344836043')
    || ' chapelle_versions=' || (SELECT count(*) FROM versions_lieu WHERE place_id = '1e45225b-d374-48fb-a93b-bf1344836043')
    || ' acces=' || (SELECT count(*) FROM places WHERE acces IS NOT NULL)
    || ' quand=' || (SELECT count(*) FROM places WHERE quand IS NOT NULL)
    || ' bon=' || (SELECT count(*) FROM places WHERE bon_a_savoir IS NOT NULL)
    || ' sans_histoire=' || (SELECT count(*) FROM places p WHERE NOT EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = p.id))
  INTO b;
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

Run : `pnpm dlx supabase db query --linked -f scratchpad/test416.sql`
Expected : `divergents=1` au plus (le lieu déjà en versions, s'il diverge) + les lieux gardés par Uriel ; `chapelle=` le début du texte de l'autrice ; `chapelle_versions` ≥ 2 ; `acces` ≈ 73, `quand` ≈ 63, `bon` ≈ 27 ; `sans_histoire` ≈ 60 (lieux sans aucune révision) ; `lieux` ≈ 3 437.

- [ ] **Étape 5 : Uriel applique, je vérifie en prod**

`pnpm dlx supabase db push --linked` (Uriel), puis relancer seulement le bloc de bilan (sans la migration, sans BEGIN/ROLLBACK : `SELECT` simple). Mêmes valeurs.

- [ ] **Étape 6 : commit**

```bash
git add supabase/migrations/416_enrichir_histoire_v1.sql
git commit -m "feat(db): enrichir un lieu — l'histoire de la V1 devient des versions, la fiche prend le recit le plus recent (mig 416)"
```

---

### Tâche 4 : la fiche — rubriques, bivouac, « Récit partagé de… », « Enrichir la fiche »

**Files :**
- Modify : `apps/web-v2/src/features/lieu/api/lireLieu.ts`, `lireLieu.test.ts`
- Modify : `apps/web-v2/src/features/lieu/lib/faits.ts`, `faits.test.ts` (s'il existe ; sinon le créer)
- Create : `apps/web-v2/src/features/lieu/lib/credit.ts`, `credit.test.ts`
- Modify : `apps/web-v2/src/features/lieu/components/FicheLieu.tsx`, `FicheLieu.module.css`, `FicheLieu.test.tsx`
- Create : `apps/web-v2/src/assets/ui/acces.svg`, `quand.svg`, `bon-a-savoir.svg`, `bivouac.svg` ; Modify : `assets/ui/README.md`
- Modify : `apps/web-v2/src/app/routes/lieu.tsx`

**Interfaces :**
- Consumes : `fiche_lieu` de la Tâche 2.
- Produces : `FicheLieu` (type) : `faits: {epoque: string | null; annee: number | null}`, `rubriques: {acces: string | null; quand: string | null; bonASavoir: string | null}`, `bivouacTolere: boolean`, `recitPar: Personne[]` ; plus de `enrichiPar`. `phraseDuRecit(noms: string[]): string | null`. Composant `FicheLieu` reçoit `onEnrichir: () => void`.

- [ ] **Étape 1 : tests qui échouent**

`features/lieu/lib/credit.test.ts` :

```ts
/**
 * QUOI     — la phrase de crédit du récit.
 */
import { expect, test } from 'vitest'
import { phraseDuRecit } from './credit'

test('un auteur, deux, trois ; personne', () => {
  expect(phraseDuRecit(['Luna'])).toBe('Récit de Luna')
  expect(phraseDuRecit(['Luna', 'Mathéo'])).toBe('Récit partagé de Luna et Mathéo')
  expect(phraseDuRecit(['Luna', 'Mathéo', 'Aelis'])).toBe('Récit partagé de Luna, Mathéo et Aelis')
  expect(phraseDuRecit([])).toBeNull()
})
```

Dans `lireLieu.test.ts`, remplacer `enrichiPar: null` du JSON d'exemple par :

```ts
  rubriques: { acces: 'Par le sentier', quand: null, bonASavoir: null },
  bivouacTolere: true,
  recitPar: [{ id: 'u1', nom: 'Luna', avatar: null }],
```

et `faits` par `{ epoque: 'Médiéval', annee: 1150 }`, puis ajouter :

```ts
test('la fiche lit ses rubriques, son bivouac et qui a écrit le récit', () => {
  const f = lireFiche(FICHE)
  expect(f?.rubriques).toEqual({ acces: 'Par le sentier', quand: null, bonASavoir: null })
  expect(f?.bivouacTolere).toBe(true)
  expect(f?.recitPar.map((p) => p.nom)).toEqual(['Luna'])
})
```

(`FICHE` = le nom de l'objet d'exemple déjà présent dans le fichier ; garder son nom réel.)

Dans `FicheLieu.test.tsx`, adapter l'objet de fiche (mêmes trois champs, `enrichiPar` retiré, `faits` réduit) et ajouter :

```tsx
test('les rubriques remplies et le bivouac s’affichent, une rubrique vide non', async () => {
  rendre({ ...FICHE, rubriques: { acces: 'Par le sentier', quand: null, bonASavoir: 'Pas de feu' }, bivouacTolere: true })
  expect(await screen.findByText('Par le sentier')).toBeInTheDocument()
  expect(screen.getByText('Pas de feu')).toBeInTheDocument()
  expect(screen.queryByText('Quand y aller')).not.toBeInTheDocument()
  expect(screen.getByText('Bivouac toléré')).toBeInTheDocument()
})

test('le récit est crédité, et « Enrichir la fiche » appelle onEnrichir', async () => {
  const onEnrichir = vi.fn()
  rendre({ ...FICHE, recitPar: [{ id: 'a', nom: 'Luna', avatar: null }, { id: 'b', nom: 'Mathéo', avatar: null }] }, { onEnrichir })
  expect(await screen.findByText(/Récit partagé de/)).toHaveTextContent('Récit partagé de Luna et Mathéo')
  await userEvent.click(screen.getByRole('button', { name: 'Enrichir la fiche' }))
  expect(onEnrichir).toHaveBeenCalled()
  expect(screen.queryByText(/Enrichi par/)).not.toBeInTheDocument()
})
```

(`rendre` / `FICHE` : reprendre les aides de rendu déjà présentes dans `FicheLieu.test.tsx` ; leur ajouter le paramètre `onEnrichir` avec `vi.fn()` par défaut.)

Run : `pnpm --filter web-v2 exec vitest run src/features/lieu` → FAIL (`phraseDuRecit` introuvable, champs absents).

- [ ] **Étape 2 : `lib/credit.ts`**

```ts
/**
 * QUOI     — la phrase de crédit sous le récit : « Récit de Luna », « Récit partagé de Luna, Mathéo et
 *            Aelis ».
 * POURQUOI — tous à égalité, par ordre d'arrivée (Uriel, 05/10 : « parfois l'auteur de base met 3
 *            lignes, et les suivants font tout le boulot »).
 */
export function phraseDuRecit(noms: string[]): string | null {
  if (noms.length === 0) return null
  if (noms.length === 1) return `Récit de ${noms[0] ?? ''}`
  return `Récit partagé de ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1] ?? ''}`
}
```

Le rendu met les noms en valeur : `FicheLieu` n'utilise pas la chaîne brute mais découpe pareil (étape 4).

- [ ] **Étape 3 : `lireLieu.ts` et `faits.ts`**

Dans le type `FicheLieu` : `faits: { epoque: string | null; annee: number | null }` ; ajouter `rubriques: { acces: string | null; quand: string | null; bonASavoir: string | null }`, `bivouacTolere: boolean`, `recitPar: Personne[]` ; retirer `enrichiPar` et `lireEnrichi`. Dans `lireFiche` :

```ts
    faits: { epoque: ouNull(chaine)(faits.epoque), annee: ouNull(nombre)(faits.annee) },
    rubriques: {
      acces: ouNull(chaine)(rubriques.acces),
      quand: ouNull(chaine)(rubriques.quand),
      bonASavoir: ouNull(chaine)(rubriques.bonASavoir),
    },
    bivouacTolere: booleen(f.bivouacTolere),
    recitPar: liste(lirePersonne)(f.recitPar),
```

avec `const rubriques = objet(f.rubriques)` en tête. Dans `lib/faits.ts`, retirer `ACCES`, `SAISONS` et les trois morceaux ; l'en-tête dit « époque, siècle ». Mettre à jour le test de `ligneDeFaits` s'il cite la saison ou l'accès.

- [ ] **Étape 4 : les icônes et `FicheLieu.tsx`**

Icônes Lucide (trait 1.75, encre `#857575`, 18 × 18) dans `assets/ui/` :

`acces.svg` :
```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857575" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>
```
`quand.svg` :
```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857575" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>
```
`bon-a-savoir.svg` :
```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857575" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
```
`bivouac.svg` :
```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857575" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></svg>
```

Ligne au README des assets : `| acces.svg, quand.svg, bon-a-savoir.svg, bivouac.svg | 18 × 18 | Fiche et « Modifier » : les rubriques pratiques et le bivouac (Lucide route, calendar-days, lightbulb, tent ; maquette 379:237) |`.

Dans `FicheLieu.tsx` : la prop `onEnrichir: () => void` ; la section du récit devient :

```tsx
        {fiche.recit && (
          <section className={styles.recit} aria-label="Le récit">
            <h3 className={styles.rubrique}>Le récit</h3>
            <p className={styles.texte}>{fiche.recit}</p>
            {fiche.recitPar.length > 0 && (
              <p className={styles.recitPar}>
                <span className={styles.portraits}>
                  {fiche.recitPar.slice(0, 3).map((p) => (
                    <Avatar key={p.id} url={p.avatar} nom={p.nom} taille="mini" />
                  ))}
                </span>
                <span>{creditEnValeur(fiche.recitPar.map((p) => p.nom))}</span>
              </p>
            )}
          </section>
        )}

        <InfosEnPlus rubriques={fiche.rubriques} bivouac={fiche.bivouacTolere} />

        <div className={styles.enrichir}>
          <Button kind="contour" onClick={onEnrichir}>
            Enrichir la fiche
          </Button>
        </div>
```

(`kind` : prendre la variante de bordure existante de `shared/ui/Button` — lire ses `kind` avant ; s'il n'y en a pas, `kind="doux"`.) Au bas du fichier :

```tsx
// La phrase de crédit, les noms en valeur (la même découpe que phraseDuRecit).
function creditEnValeur(noms: string[]) {
  const phrase = phraseDuRecit(noms)
  if (phrase === null) return null
  const debut = noms.length === 1 ? 'Récit de ' : 'Récit partagé de '
  return (
    <>
      {debut}
      {noms.map((n, i) => (
        <Fragment key={n + String(i)}>
          {i > 0 && (i === noms.length - 1 ? ' et ' : ', ')}
          <strong className={styles.nomCredit}>{n}</strong>
        </Fragment>
      ))}
    </>
  )
}

const RUBRIQUES = [
  { cle: 'acces', titre: 'Accès', icone: acces },
  { cle: 'quand', titre: 'Quand y aller', icone: quand },
  { cle: 'bonASavoir', titre: 'Bon à savoir', icone: bonASavoir },
] as const

// Les infos en plus : plus discrètes que le récit (Uriel, 05/10) ; une rubrique vide ne s'affiche pas.
function InfosEnPlus({ rubriques, bivouac }: { rubriques: Fiche['rubriques']; bivouac: boolean }) {
  const remplies = RUBRIQUES.filter((r) => rubriques[r.cle] !== null)
  if (remplies.length === 0 && !bivouac) return null
  return (
    <section className={styles.infos} aria-label="Infos en plus">
      {remplies.map((r) => (
        <div key={r.cle} className={styles.info}>
          <img className={styles.iconeInfo} src={r.icone} alt="" />
          <div>
            <h4 className={styles.titreInfo}>{r.titre}</h4>
            <p className={styles.texteInfo}>{rubriques[r.cle]}</p>
          </div>
        </div>
      ))}
      {bivouac && (
        <p className={styles.info}>
          <img className={styles.iconeInfo} src={bivouacIcone} alt="" />
          <span className={styles.titreInfo}>Bivouac toléré</span>
        </p>
      )}
    </section>
  )
}
```

Imports : `Fragment` de react, `acces`, `quand`, `bonASavoir`, `bivouacIcone` depuis `@/assets/ui/…`, `phraseDuRecit` de `../lib/credit`. Retirer le bloc `fiche.enrichiPar` du pied ; `CoeursDesAuteurs` reçoit `auteurs={fiche.recitPar.map((p) => p.nom)}` (avec l'auteur en premier s'il n'y est pas : `[...new Set([fiche.auteur?.nom, ...fiche.recitPar.map((p) => p.nom)].filter((n) => n !== undefined))]`). Mettre à jour l'en-tête du fichier (« récit et son crédit, infos en plus, Enrichir la fiche, crédits »).

CSS (`FicheLieu.module.css`), jetons seulement :

```css
/* « Récit partagé de… » : les portraits qui se chevauchent, puis les noms en or. */
.recitPar {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-3) 0 0;
  color: var(--color-texte);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.portraits {
  display: inline-flex;
}

.portraits > * + * {
  margin-left: -6px;
}

/* Les infos en plus : sous un filet, plus petites et plus pâles que le récit. */
.infos {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-sable);
}

.info {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  margin: 0;
}

.iconeInfo {
  width: 18px;
  height: 18px;
}

.titreInfo {
  margin: 0;
  color: var(--color-texte);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  font-weight: var(--weight-semi);
}

.texteInfo {
  margin: 2px 0 0;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--flux-size);
  line-height: var(--dense-leading);
  white-space: pre-line;
}

.enrichir {
  margin-top: var(--space-4);
}
```

(Vérifier dans `shared/styles/tokens.css` les noms exacts `--legende-size`, `--flux-size`, `--weight-semi`, `--dense-leading` ; prendre ceux qui existent, jamais une valeur en dur.)

- [ ] **Étape 5 : la route passe `onEnrichir`**

Dans `app/routes/lieu.tsx`, `Lieu` : `const navigate = useNavigate()` (import de `react-router`) et sur `<FicheLieu … onEnrichir={() => { void navigate('modifier', { relative: 'path' }) }} />` — le même chemin que « Modifier » dans `FeuilleOptions`.

- [ ] **Étape 6 : tests verts, lint, commit**

Run : `pnpm --filter web-v2 exec vitest run src/features/lieu && pnpm --filter web-v2 lint && pnpm --filter web-v2 typecheck`
Expected : PASS, 0 avertissement.

```bash
git add apps/web-v2/src/features/lieu apps/web-v2/src/assets/ui apps/web-v2/src/app/routes/lieu.tsx
git commit -m "feat(v2): la fiche montre le recit partage, les infos en plus et « Enrichir la fiche »"
```

---

### Tâche 5 : l'histoire et « Une version » (ajouté souligné, retiré barré)

**Files :**
- Modify : `apps/web-v2/package.json` (dépendance `diff`)
- Modify : `features/lieu/lib/versions.ts`, `versions.test.ts`
- Create : `features/lieu/lib/ecart.ts`, `ecart.test.ts`
- Modify : `features/lieu/api/lireLieu.ts` (+ `lireVersionDetail`), `features/lieu/api/lieu.ts` (+ `fetchVersion`)
- Create : `features/lieu/hooks/useVersion.ts`
- Create : `features/lieu/components/FeuilleVersion.tsx`, `FeuilleVersion.module.css`, `FeuilleVersion.test.tsx`
- Modify : `features/lieu/components/FeuilleHistoire.tsx`

**Interfaces :**
- Consumes : `version_du_lieu`, `histoire_du_lieu` (Tâche 2).
- Produces : `type Morceau = { texte: string; genre: 'pareil' | 'ajoute' | 'retire' }` ; `ecart(avant: string, apres: string): Morceau[]` ; `type VersionDetail = { id: number; quand: string; note: string | null; qui: Personne | null; champs: { champ: 'recit' | 'acces' | 'quand' | 'bon_a_savoir'; avant: string; apres: string }[] }` ; `fetchVersion(id: number): Promise<VersionDetail | null>` ; `useVersion(id: number | null)`.

- [ ] **Étape 1 : installer `diff`**

Run : `pnpm --filter web-v2 add diff` (jsdiff ; vérifier avec Context7 que la version installée exporte `diffWords` et ses types ; si les types manquent, `pnpm --filter web-v2 add -D @types/diff`).
Expected : `"diff"` dans `dependencies`.

- [ ] **Étape 2 : tests qui échouent**

`lib/ecart.test.ts` :

```ts
/**
 * QUOI     — l'écart entre deux textes, en morceaux pareils / ajoutés / retirés.
 */
import { expect, test } from 'vitest'
import { ecart } from './ecart'

test('un ajout, un retrait, et ce qui ne change pas', () => {
  expect(ecart('Il reste presque rien.', 'Il reste une tour.')).toEqual([
    { texte: 'Il reste ', genre: 'pareil' },
    { texte: 'presque rien', genre: 'retire' },
    { texte: 'une tour', genre: 'ajoute' },
    { texte: '.', genre: 'pareil' },
  ])
})

test('une rubrique qui apparaît, une qui disparaît', () => {
  expect(ecart('', 'Par le sentier')).toEqual([{ texte: 'Par le sentier', genre: 'ajoute' }])
  expect(ecart('Pas de feu', '')).toEqual([{ texte: 'Pas de feu', genre: 'retire' }])
})
```

Dans `versions.test.ts`, ajouter :

```ts
test('les rubriques et le bivouac se disent aussi', () => {
  expect(ceQuiAChange(v(['acces']))).toBe('a enrichi l’accès')
  expect(ceQuiAChange(v(['bon_a_savoir']))).toBe('a enrichi « Bon à savoir »')
  expect(ceQuiAChange(v(['quand', 'recit']))).toBe('a enrichi « Quand y aller » et le récit')
  expect(ceQuiAChange(v(['bivouac']))).toBe('a changé le bivouac')
  expect(ceQuiAChange(v(['nom', 'acces']))).toBe('a changé le nom et l’accès')
})
```

`components/FeuilleVersion.test.tsx` :

```tsx
/**
 * QUOI     — la feuille « Une version » : qui, quand, le mot ; l'ajouté souligné, le retiré barré.
 */
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FeuilleVersionContenu } from './FeuilleVersion'

test('ce que la version a ajouté et retiré, champ par champ', () => {
  render(
    <FeuilleVersionContenu
      version={{
        id: 7,
        quand: '2026-09-23T10:00:00Z',
        note: 'la porte',
        qui: { id: 'm', nom: 'Mathéo', avatar: null },
        champs: [
          { champ: 'recit', avant: 'Il reste presque rien.', apres: 'Il reste une tour.' },
          { champ: 'acces', avant: '', apres: 'Par le sentier' },
        ],
      }}
      actuelle={false}
      enCours={false}
      onRevenir={vi.fn()}
    />,
  )
  expect(screen.getByText('Mathéo')).toBeInTheDocument()
  expect(screen.getByText(/la porte/)).toBeInTheDocument()
  expect(screen.getByText('une tour').tagName).toBe('INS')
  expect(screen.getByText('presque rien').tagName).toBe('DEL')
  expect(screen.getByRole('heading', { name: 'Accès' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revenir à cette version' })).toBeEnabled()
})

test('la version actuelle ne propose pas d’y revenir', () => {
  render(
    <FeuilleVersionContenu
      version={{ id: 8, quand: '2026-09-23T10:00:00Z', note: null, qui: null, champs: [] }}
      actuelle
      enCours={false}
      onRevenir={vi.fn()}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Revenir à cette version' })).not.toBeInTheDocument()
})
```

Run : `pnpm --filter web-v2 exec vitest run src/features/lieu` → FAIL.

- [ ] **Étape 3 : `lib/ecart.ts`**

```ts
/**
 * QUOI     — l'écart entre deux textes, mot à mot : ce qui reste, ce qui est ajouté, ce qui est retiré.
 * POURQUOI — l'histoire montre « ce que chacun a ajouté » (Uriel, 05/10) ; la comparaison est celle de
 *            jsdiff (`diffWords`), l'outil standard, pas un algorithme maison.
 */
import { diffWords } from 'diff'

export type Morceau = { texte: string; genre: 'pareil' | 'ajoute' | 'retire' }

export function ecart(avant: string, apres: string): Morceau[] {
  return diffWords(avant, apres).map((p) => ({
    texte: p.value,
    genre: p.added ? 'ajoute' : p.removed ? 'retire' : 'pareil',
  }))
}
```

Si le premier test échoue seulement sur la découpe des espaces (jsdiff rattache l'espace au mot), ajuster **le test** à la découpe réelle de `diffWords` (c'est son comportement documenté), pas le code.

- [ ] **Étape 4 : `versions.ts`**

```ts
const MOTS: Record<string, string> = {
  nom: 'le nom',
  natures: 'la nature',
  epoque: 'l’époque',
  recit: 'le récit',
  acces: 'l’accès',
  quand: '« Quand y aller »',
  bon_a_savoir: '« Bon à savoir »',
  bivouac: 'le bivouac',
}
// Le récit et les rubriques s'enrichissent ; le reste se change.
const ENRICHIS = new Set(['recit', 'acces', 'quand', 'bon_a_savoir'])

function enListe(mots: string[]) {
  return mots.length === 1
    ? (mots[0] ?? '')
    : `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1] ?? ''}`
}

export function ceQuiAChange(v: Version): string {
  if (v.origine) return 'a ajouté le lieu'
  const connus = v.champs.filter((c) => MOTS[c] !== undefined)
  if (connus.length === 0) return 'a modifié la fiche'
  const mots = connus.map((c) => MOTS[c] ?? '')
  return `${connus.every((c) => ENRICHIS.has(c)) ? 'a enrichi' : 'a changé'} ${enListe(mots)}`
}
```

Vérifier que les tests existants passent toujours (`'a enrichi le récit'`, `'a changé la nature et l’époque'`, `'a changé le nom, la nature et le récit'`). L'en-tête du fichier cite « a enrichi l'accès ».

- [ ] **Étape 5 : lecture et appel**

`lireLieu.ts` :

```ts
export type ChampEcrit = 'recit' | 'acces' | 'quand' | 'bon_a_savoir'
export type VersionDetail = {
  id: number
  quand: string
  note: string | null
  qui: Personne | null
  champs: { champ: ChampEcrit; avant: string; apres: string }[]
}
const CHAMPS_ECRITS: readonly ChampEcrit[] = ['recit', 'acces', 'quand', 'bon_a_savoir']

// Une version et ce qu'elle a changé (mig 415) ; null : introuvable ou invisible.
export function lireVersionDetail(json: unknown): VersionDetail | null {
  if (json === null) return null
  const v = objet(json)
  return {
    id: nombre(v.id),
    quand: chaine(v.quand),
    note: ouNull(chaine)(v.note),
    qui: ouNull(lirePersonne)(v.qui),
    champs: liste((c) => {
      const o = objet(c)
      const champ = CHAMPS_ECRITS.find((x) => x === o.champ)
      if (champ === undefined) throw new Error(`champ inconnu : ${String(o.champ)}`)
      return { champ, avant: chaine(o.avant), apres: chaine(o.apres) }
    })(v.champs),
  }
}
```

(Si `shared/lib/lire` a déjà un lecteur d'énumération, l'utiliser à la place du `find`.) `lieu.ts` :

```ts
// Une version de la fiche, avant et après (mig 415).
export async function fetchVersion(id: number) {
  const { data, error } = await supabase.rpc('version_du_lieu', { p_version: id })
  if (error) throw error
  return lireVersionDetail(data)
}
```

`hooks/useVersion.ts` :

```ts
/**
 * QUOI     — une version de la fiche (mig 415), lue quand on la touche dans l'histoire.
 * POURQUOI — une version ne change jamais : elle se garde en cache sans se relire.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchVersion } from '../api/lieu'

export function useVersion(id: number) {
  const version = useQuery({
    queryKey: ['version', id],
    queryFn: () => fetchVersion(id),
    staleTime: Infinity,
  })
  return { version: version.data, erreur: version.isError }
}
```

- [ ] **Étape 6 : `FeuilleVersion.tsx` et l'histoire**

```tsx
/**
 * QUOI     — « Une version » (maquette 379:417) : qui, quand, son mot ; pour chaque texte changé (récit,
 *            rubriques), l'ajouté souligné et le retiré barré ; « Revenir à cette version ».
 * POURQUOI — voir ce que chacun a ajouté (Uriel, 05/10). Revenir crée une version de plus : rien ne se
 *            perd. La feuille vit dans celle de l'histoire : un moment, pas une adresse.
 */
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import type { ChampEcrit, VersionDetail } from '../api/lireLieu'
import { ecart } from '../lib/ecart'
import styles from './FeuilleVersion.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const TITRES: Record<ChampEcrit, string> = {
  recit: 'Le récit',
  acces: 'Accès',
  quand: 'Quand y aller',
  bon_a_savoir: 'Bon à savoir',
}

export function FeuilleVersionContenu({
  version,
  actuelle,
  enCours,
  onRevenir,
}: {
  version: VersionDetail
  actuelle: boolean
  enCours: boolean
  onRevenir: () => void
}) {
  return (
    <div className={styles.version}>
      <p className={styles.qui}>
        <Avatar url={version.qui?.avatar ?? null} nom={version.qui?.nom ?? '?'} taille="petit" />
        <span>
          <strong>{version.qui?.nom ?? 'Quelqu’un'}</strong>
          <span className={styles.quand}>
            {[LE.format(new Date(version.quand)), version.note && `« ${version.note} »`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </p>
      {version.champs.map((c) => (
        <section key={c.champ} className={styles.champ}>
          <h3 className={styles.titre}>{TITRES[c.champ]}</h3>
          <p className={styles.texte}>
            {ecart(c.avant, c.apres).map((m, i) =>
              m.genre === 'ajoute' ? (
                <ins key={i}>{m.texte}</ins>
              ) : m.genre === 'retire' ? (
                <del key={i}>{m.texte}</del>
              ) : (
                <span key={i}>{m.texte}</span>
              ),
            )}
          </p>
        </section>
      ))}
      {version.champs.length > 0 && (
        <p className={styles.legende}>
          <ins>Souligné</ins> : ce qui a été ajouté. <del>Barré</del> : ce qui a été retiré.
        </p>
      )}
      {!actuelle && (
        <>
          <Button kind="doux" disabled={enCours} onClick={onRevenir}>
            Revenir à cette version
          </Button>
          <p className={styles.legende}>Revenir crée une nouvelle version : rien ne se perd.</p>
        </>
      )}
    </div>
  )
}
```

`FeuilleVersion.module.css` :

```css
/*
 * QUOI     — « Une version » (maquette 379:417) : l'ajouté souligné vert, le retiré barré pâle.
 */
.version {
  display: grid;
  gap: var(--space-4);
}

.qui {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin: 0;
  color: var(--color-encre);
  font-family: var(--font-corps);
}

.quand {
  display: block;
  color: var(--color-texte-doux);
  font-size: var(--legende-size);
}

.titre {
  margin: 0 0 var(--space-2);
  color: var(--color-encre);
  font-family: var(--font-titre);
  font-size: var(--rubrique-size);
  font-weight: normal;
}

.texte {
  margin: 0;
  color: var(--color-texte);
  font-family: var(--font-corps);
  font-size: var(--corps-size);
  line-height: var(--dense-leading);
  white-space: pre-line;
}

.version ins {
  color: var(--color-ajoute);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.version del {
  color: var(--color-retire);
}

.legende {
  margin: 0;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  font-style: italic;
}
```

Ajouter deux jetons à `shared/styles/tokens.css` (et à `app/da/daTokens.ts`, pour `/v2/da`) : `--color-ajoute: #38733f; /* ce qu'une version ajoute (05/10) */` et `--color-retire: #b8736b;`.

Dans `FeuilleHistoire.tsx` : un état `const [choisie, setChoisie] = useState<number | null>(null)`. Chaque ligne avec `v.id !== null` devient un bouton qui fait `setChoisie(v.id)` ; à droite « Actuelle » (i = 0) ou « Voir › » ; le bouton « Revenir » de la ligne disparaît (il vit dans la version). Quand `choisie !== null`, la feuille montre :

```tsx
<VersionChoisie
  id={choisie}
  actuelle={choisie === versions?.[0]?.id}
  enCours={enCours}
  onRevenir={() => {
    revenir(choisie)
    setChoisie(null)
  }}
  onRetour={() => {
    setChoisie(null)
  }}
/>
```

avec, dans `FeuilleVersion.tsx` :

```tsx
// La version touchée dans l'histoire : chargée, puis montrée ; « ‹ L'histoire » ramène à la liste.
export function VersionChoisie({
  id,
  actuelle,
  enCours,
  onRevenir,
  onRetour,
}: {
  id: number
  actuelle: boolean
  enCours: boolean
  onRevenir: () => void
  onRetour: () => void
}) {
  const { version, erreur } = useVersion(id)
  return (
    <>
      <button type="button" className={styles.retour} onClick={onRetour}>
        ‹ L’histoire
      </button>
      {erreur || version === null ? (
        <p className={styles.legende}>Cette version n’existe plus.</p>
      ) : version === undefined ? (
        <div aria-busy="true" />
      ) : (
        <FeuilleVersionContenu version={version} actuelle={actuelle} enCours={enCours} onRevenir={onRevenir} />
      )}
    </>
  )
}
```

(`.retour` : un lien texte, `color: var(--color-accent)`, `font-weight: var(--weight-gras)`, `background: none; border: none; padding: 0; justify-self: start; cursor: pointer`.) Le pied de l'histoire dit : « Toucher une version montre ce qu’elle a ajouté et retiré. Chaque version est gardée : rien ne se perd. » Mettre à jour les tests existants de la feuille d'histoire (`Feuilles.test.tsx`) qui cliquaient « Revenir » dans la liste : ils touchent la ligne, puis « Revenir à cette version ».

- [ ] **Étape 7 : tests verts, lint, commit**

Run : `pnpm --filter web-v2 exec vitest run src/features/lieu && pnpm --filter web-v2 lint && pnpm --filter web-v2 typecheck` → PASS.

```bash
git add apps/web-v2/package.json pnpm-lock.yaml apps/web-v2/src
git commit -m "feat(v2): l'histoire de la fiche montre ce que chaque version a ajoute et retire"
```

---

### Tâche 6 : « Modifier » — deux onglets, les infos en plus, le bivouac, le mot

**Files :**
- Modify : `features/ajout/api/lireAjout.ts` (type `Fiche` + `lireFicheAModifier`), `lireAjout.test.ts`
- Modify : `features/ajout/api/ajout.ts` (`modifierLieu`)
- Modify : `features/ajout/components/ModifierFiche.tsx`, `ModifierFiche.module.css`, `ModifierFiche.test.tsx`

**Interfaces :**
- Consumes : `lieu_a_modifier` / `modifier_lieu` (Tâche 1) ; icônes `assets/ui/acces.svg`… (Tâche 4) ; `Segments` (`shared/ui/Segments`).
- Produces : `Fiche` gagne `acces: string; quand: string; bonASavoir: string; bivouacTolere: boolean` (chaînes vides si rien) ; `modifierLieu(id, f: Champs & { recit: string; acces: string; quand: string; bonASavoir: string; bivouacTolere: boolean }, note: string)`.

- [ ] **Étape 1 : tests qui échouent** (`ModifierFiche.test.tsx`, avec les aides déjà présentes — la fiche d'exemple gagne `acces: 'Par le sentier', quand: '', bonASavoir: '', bivouacTolere: false`) :

```tsx
test('deux onglets : le récit, puis les infos en plus ; la saisie reste en passant de l’un à l’autre', async () => {
  rendre()
  const recit = await screen.findByLabelText('Le récit')
  await userEvent.type(recit, ' Encore.')
  await userEvent.click(screen.getByRole('radio', { name: 'Infos en plus' }))
  expect(screen.getByLabelText('Accès')).toHaveValue('Par le sentier')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Bivouac toléré' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Le récit' }))
  expect(screen.getByLabelText('Le récit')).toHaveValue(expect.stringContaining('Encore.'))
})

test('un seul enregistrement envoie le récit, les rubriques, le bivouac et le mot', async () => {
  rendre()
  await userEvent.click(await screen.findByRole('radio', { name: 'Infos en plus' }))
  await userEvent.type(screen.getByLabelText('Bon à savoir'), 'Pas de feu')
  await userEvent.type(screen.getByLabelText('Un mot sur ta modification (facultatif)'), 'conseil')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les changements' }))
  await waitFor(() => {
    expect(modifierLieu).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ acces: 'Par le sentier', bonASavoir: 'Pas de feu', bivouacTolere: false }),
      'conseil',
    )
  })
})
```

(`modifierLieu` : le mock de `../api/ajout` déjà en place dans ce fichier ; sinon `vi.mock('../api/ajout', …)` comme les autres tests du dossier.)

Run : `pnpm --filter web-v2 exec vitest run src/features/ajout` → FAIL.

- [ ] **Étape 2 : lecture et envoi**

`lireAjout.ts`, type `Fiche` : ajouter `acces: string; quand: string; bonASavoir: string; bivouacTolere: boolean`. `lireFicheAModifier` :

```ts
    acces: ouNull(chaine)(f.acces) ?? '',
    quand: ouNull(chaine)(f.quand) ?? '',
    bonASavoir: ouNull(chaine)(f.bonASavoir) ?? '',
    bivouacTolere: booleen(f.bivouacTolere),
```

`ajout.ts`, `modifierLieu` : le type du deuxième paramètre devient `Champs & { recit: string; acces: string; quand: string; bonASavoir: string; bivouacTolere: boolean }` et l'appel ajoute (toujours envoyés : `''` vide la rubrique, mig 414) :

```ts
    p_acces: f.acces,
    p_quand: f.quand,
    p_bon_a_savoir: f.bonASavoir,
    p_bivouac_tolere: f.bivouacTolere,
```

- [ ] **Étape 3 : `ModifierFiche.tsx`**

- `champsChanges` compare aussi `valeur.acces.trim() !== depart.acces`, idem `quand`, `bonASavoir`, et `valeur.bivouacTolere !== depart.bivouacTolere`.
- L'envoi passe `acces: valeur.acces.trim()`, etc.
- État `const [onglet, setOnglet] = useState<'recit' | 'infos'>('recit')`.
- À la place du titre « Son récit » et de son carnet :

```tsx
        <Segments
          libelle="Le récit ou les infos en plus"
          options={ONGLETS}
          valeur={onglet}
          onChange={setOnglet}
        />
        {/* Les deux onglets restent montés : la saisie de l'un survit quand on passe à l'autre. */}
        <div hidden={onglet !== 'recit'} className={recit.carnet}>
          <textarea
            className={recit.texte}
            aria-label="Le récit"
            maxLength={5000}
            value={valeur.recit}
            onChange={(e) => {
              setValeur((avant) => ({ ...avant, recit: e.target.value }))
            }}
          />
          <span className={recit.compte}>{valeur.recit.length} signes</span>
        </div>
        <div hidden={onglet !== 'infos'} className={styles.infos}>
          {RUBRIQUES.map((r) => (
            <label key={r.cle} className={styles.rubrique}>
              <span className={nom.etiquette}>
                <img src={r.icone} alt="" className={styles.icone} />
                {r.titre}
              </span>
              <textarea
                className={styles.champ}
                maxLength={1000}
                rows={2}
                placeholder={r.exemple}
                value={valeur[r.cle]}
                onChange={(e) => {
                  setValeur((avant) => ({ ...avant, [r.cle]: e.target.value }))
                }}
              />
            </label>
          ))}
          <label className={styles.case}>
            <input
              type="checkbox"
              checked={valeur.bivouacTolere}
              onChange={(e) => {
                setValeur((avant) => ({ ...avant, bivouacTolere: e.target.checked }))
              }}
            />
            <img src={bivouac} alt="" className={styles.icone} />
            Bivouac toléré
          </label>
        </div>
```

avec en tête de fichier :

```tsx
const ONGLETS = [
  { id: 'recit', libelle: 'Le récit' },
  { id: 'infos', libelle: 'Infos en plus' },
] as const

const RUBRIQUES = [
  { cle: 'acces', titre: 'Accès', icone: acces, exemple: 'Comment y aller : « vingt minutes à pied depuis le hameau »' },
  { cle: 'quand', titre: 'Quand y aller', icone: quand, exemple: 'La saison, le moment : « au printemps, tôt le matin »' },
  { cle: 'bonASavoir', titre: 'Bon à savoir', icone: bonASavoir, exemple: 'Un conseil, une précaution : « la visite coûte 5 € », « attention au bétail »…' },
] as const
```

L'étiquette d'un `<label>` contenant un `<span>` + `<textarea>` donne le nom accessible « Accès » au champ (le test le cherche ainsi) ; si jsdom ne le calcule pas, ajouter `aria-label={r.titre}` au `textarea`.

- Le pied : remplacer l'`input` de la note par

```tsx
        <label className={styles.mot}>
          <span className={styles.motTitre}>
            Un mot sur ta modification <span className={styles.facultatif}>(facultatif)</span>
          </span>
          <input
            className={styles.note}
            placeholder={onglet === 'recit' ? 'Ex. : « ajouté l’histoire de la porte »' : 'Ex. : « précisé l’accès depuis le hameau »'}
            maxLength={140}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
            }}
          />
          <span className={styles.aide}>Il s’affiche dans l’histoire de la fiche, à côté de ton nom.</span>
        </label>
```

(Nom accessible attendu par le test : « Un mot sur ta modification (facultatif) ».)
- Ajouter à `messageDeRefus` : `if (code === '22023')` → `'Un champ est trop long : 1 000 signes au plus par rubrique.'` (lire `code` comme `hint`).
- Mettre à jour l'en-tête (« le récit et les infos en plus en deux onglets `Segments` (Uriel, 05/10) »).

CSS (`ModifierFiche.module.css`, jetons seulement) : `.infos { display: grid; gap: var(--space-4); }`, `.rubrique { display: grid; gap: var(--space-2); }`, `.icone { width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; }`, `.champ` = la même apparence que le champ de note existant (`.note`) avec `resize: vertical; min-height: 64px; font-family: var(--font-corps); font-size: var(--corps-size)`, `.case { display: flex; gap: var(--space-2); align-items: center; font-family: var(--font-corps); color: var(--color-texte); }` et `.case input { accent-color: var(--color-accent); width: 20px; height: 20px; }`, `.mot { display: grid; gap: 6px; }`, `.motTitre { font-family: var(--font-corps); font-weight: var(--weight-semi); color: var(--color-texte); font-size: var(--legende-size); }`, `.facultatif { font-weight: normal; color: var(--color-texte-doux); }`, `.aide { font-style: italic; color: var(--color-texte-doux); font-size: var(--legende-size); }`. Un `[hidden]` reste caché : `.infos[hidden] { display: none; }` (le `display: grid` l'écraserait sinon).

- [ ] **Étape 4 : tests verts, lint, commit**

Run : `pnpm --filter web-v2 exec vitest run src/features/ajout && pnpm --filter web-v2 lint && pnpm --filter web-v2 typecheck` → PASS.

```bash
git add apps/web-v2/src/features/ajout
git commit -m "feat(v2): modifier la fiche en deux onglets, le recit et les infos en plus"
```

---

### Tâche 7 : « Sur les chemins » — « a modifié »

**Files :**
- Modify : `features/accueil/api/lireAccueil.ts`, `lireAccueil.test.ts`, `features/accueil/components/SurLesChemins.tsx`
- Modify : `features/notifications/lib/phrase.ts`, `phrase.test.ts`

**Interfaces :** Consumes : type `modifie` de `sur_les_chemins` (Tâche 2).

- [ ] **Étape 1 : tests qui échouent**

`lireAccueil.test.ts`, à côté du test des types :

```ts
test('une modification est une ligne des chemins', () => {
  const lignes = lireChemins([{ ...CHEMIN, id: 'modifie:l1:u1:1', type: 'modifie' }])
  expect(lignes.map((l) => l.type)).toEqual(['modifie'])
})
```

(`lireChemins` / `CHEMIN` : les noms réels du fichier.) `phrase.test.ts` :

```ts
test('un salut sur une modification', () => {
  expect(texte({ ...base, type: 'salut', evenement: 'modifie', lieu: null })).toBe('Luna a salué ta modification')
})
```

(`base` et le nom attendu : reprendre le test « enrichi » voisin et copier sa forme exacte.)

Run : `pnpm --filter web-v2 exec vitest run src/features/accueil src/features/notifications` → FAIL.

- [ ] **Étape 2 : code**

`lireAccueil.ts` : `TypeDeChemin` et `TYPES` gagnent `'modifie'`. `SurLesChemins.tsx` : `ICONES.modifie = plume`, `VERBES.modifie = 'a modifié'`. `phrase.ts`, à côté de la ligne `enrichi` : `if (n.evenement === 'modifie') return [qui, t(' a salué ta modification')]`.

- [ ] **Étape 3 : tests verts, commit**

Run : `pnpm --filter web-v2 exec vitest run src/features/accueil src/features/notifications` → PASS.

```bash
git add apps/web-v2/src/features/accueil apps/web-v2/src/features/notifications
git commit -m "feat(v2): « a modifie » dans Sur les chemins"
```

---

### Tâche 8 : la V1 en lecture seule

**Files :**
- Modify : `apps/explore-web/src/components/places/details/PlaceDescription.tsx`
- Modify : `apps/explore-web/src/components/places/views/PlaceInfos.tsx`
- Modify : `apps/explore-web/src/components/places/views/PlacePanel.tsx` (retrait de `DescriptionEditModal` et de son état)
- Delete (avec l'accord d'Uriel, demandé dans le résumé de fin) : `apps/explore-web/src/components/places/modals/DescriptionEditModal.tsx` — sinon le laisser, non importé.

- [ ] **Étape 1 : le lien**

Dans `PlaceDescription.tsx`, les deux boutons `place-descr-contribute` (« ✎ Décrire ce lieu », « ✎ Contribuer ») deviennent :

```tsx
<a className="place-descr-contribute" href={`/v2/carte/lieu/${placeId}/modifier`}>
  ✎ Enrichir dans la nouvelle appli
</a>
```

(ajouter `placeId: string` aux props et le passer depuis `PlacePanel`). Retirer `onEdit` des props et `showEditDescr` / `<DescriptionEditModal>` de `PlacePanel.tsx`.

Dans `PlaceInfos.tsx`, `InfoRow` reçoit `canEdit={false}` pour les trois rubriques (accès, saison, attention) ; sous la liste, une seule ligne :

```tsx
<a className="info-empty-action" href={`/v2/carte/lieu/${placeId}/modifier`}>
  ✎ Enrichir dans la nouvelle appli
</a>
```

L'époque (`saveEra`) ne change pas.

- [ ] **Étape 2 : vérifier**

Run : `pnpm --filter explore-web build` → OK. `pnpm dev` (V1, port 3000) : ouvrir un lieu, les boutons de modification du récit et des rubriques sont remplacés par le lien ; le lien ouvre `/v2/carte/lieu/<id>/modifier`.

- [ ] **Étape 3 : commit**

```bash
git add apps/explore-web/src/components/places
git commit -m "feat(v1): le recit et les rubriques s'enrichissent dans la nouvelle appli"
```

---

### Tâche 9 : vérifier, livrer, noter

- [ ] **Étape 1 : toute la suite**

Run : `pnpm --filter web-v2 test && pnpm --filter web-v2 lint && pnpm --filter web-v2 build`
Expected : tout passe.

- [ ] **Étape 2 : le parcours dans le navigateur** (V2 en dev, port 5174, onglet visible, 390 px puis PC)

1. La Chapelle de la Madeleine (`/v2/carte/lieu/1e45225b-d374-48fb-a93b-bf1344836043`) : le texte de l'autrice, « Récit de… » ou « Récit partagé de… » avec son nom, ses rubriques V1 (accès, saison, attention → Bon à savoir).
2. « L'histoire de la fiche » : les versions V1 avec leurs auteurs ; toucher une version → l'ajouté souligné vert, le retiré barré.
3. « Enrichir la fiche » → « Modifier », onglet « Infos en plus », remplir « Accès », cocher « Bivouac toléré », un mot → enregistrer. La fiche montre l'accès et le bivouac ; l'histoire « a enrichi l'accès » ; l'Accueil « a enrichi [lieu] ».
4. Vider la rubrique → elle disparaît de la fiche.
5. Comparer la fiche et les deux onglets aux maquettes Figma (379:237, 379:523, 381:236) à 390 px ; reprendre chaque écart.
6. Console du navigateur : aucune erreur.

- [ ] **Étape 3 : version, commit, déploiement**

`apps/web-v2/package.json` : version suivante (1.0.40). Commit `feat(v2): enrichir un lieu (Pytheas 1.0.40)`. Déployer en suivant `.claude/rules/deploiement.md` (V2 : `npx netlify-cli deploy --prod --no-build --dir=…/apps/web-v2/dist --site=64c61b33-40c1-4505-966a-d0b136cac69b` ; V1 : son propre site, voir la règle). Vérifier « Pythéas 1.0.40 » dans le bundle en ligne, et la console en prod (rechargée deux fois).

- [ ] **Étape 4 : noter et pousser**

`_État.md` du vault : « Enrichir un lieu » passe de Tranché à livré (Où on en est). Un piège rencontré → `.claude/rules/`. `git push`.
