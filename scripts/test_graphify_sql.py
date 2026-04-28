#!/usr/bin/env python3
"""Mini test pour scripts/graphify-sql.py.

Couvre les fonctions pures (slug, extract_header_comment, parse_migration)
et les invariants critiques :
- nodes typés correctement (file_type="document", category="sql")
- edges defines / uses
- filtrage des variables PL/pgSQL
- filtrage des builtins postgres
- skip CREATE INDEX / TRIGGER (trop bruyant)

Pas de framework de test — assertions plain + exit code.

Lance via :
    python3 scripts/test_graphify_sql.py
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "graphify-sql.py"

if not SCRIPT.exists():
    print(f"FAIL: {SCRIPT} introuvable", file=sys.stderr)
    sys.exit(1)

# Import du module (nom de fichier avec tiret → importlib direct)
spec = importlib.util.spec_from_file_location("graphify_sql", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def assert_eq(actual, expected, msg: str) -> None:
    if actual != expected:
        raise AssertionError(f"{msg}\n  expected: {expected!r}\n  actual:   {actual!r}")


def assert_in(item, container, msg: str) -> None:
    if item not in container:
        raise AssertionError(f"{msg}\n  not found: {item!r}\n  in:        {container!r}")


def assert_not_in(item, container, msg: str) -> None:
    if item in container:
        raise AssertionError(f"{msg}\n  found (should not be): {item!r}\n  in:                    {container!r}")


# -- Test slug --------------------------------------------------------------

def test_slug() -> None:
    assert_eq(mod.slug("simple"), "simple", "slug simple")
    assert_eq(mod.slug("with-dash"), "with_dash", "slug with dash")
    assert_eq(mod.slug("with space"), "with_space", "slug with space")
    assert_eq(mod.slug("Mixed-Case_123"), "mixed_case_123", "slug mixed case")
    assert_eq(mod.slug("__leading"), "leading", "slug strip leading underscore")
    print("  slug: OK")


# -- Test extract_header_comment --------------------------------------------

def test_extract_header_comment() -> None:
    text = "-- WHY : test\n-- détail\n\nSELECT 1;\n"
    result = mod.extract_header_comment(text)
    assert_eq(result, "WHY : test\ndétail", "header simple")

    # Header avec ligne vide au milieu — préservée
    text = "-- bloc 1\n--\n-- bloc 2\n\nCREATE TABLE x();"
    result = mod.extract_header_comment(text)
    assert_eq(result, "bloc 1\n\nbloc 2", "header avec ligne vide")

    # Pas de header (commence direct par du SQL)
    text = "CREATE TABLE x();"
    result = mod.extract_header_comment(text)
    assert_eq(result, "", "pas de header")
    print("  extract_header_comment: OK")


# -- Test parse_migration ---------------------------------------------------

def test_parse_migration() -> None:
    sql = """-- WHY : test fixture pour le parser SQL
-- Cas couverts : CREATE TABLE, CREATE FUNCTION, FROM, JOIN, variables PL/pgSQL, builtins.

CREATE TABLE public.fixture_table (
  id uuid PRIMARY KEY,
  author_id varchar REFERENCES public.users(id)
);

CREATE OR REPLACE FUNCTION public.fixture_rpc(p_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
  v_result json;
BEGIN
  SELECT count(*) INTO v_count FROM public.places WHERE author_id = p_user_id;
  SELECT json_build_object('count', v_count) INTO v_result FROM jsonb_each_text('{}'::jsonb);
  -- Référence cross-migration explicite : voir 001_baseline_2026-04-22.sql
  RETURN v_result;
END;
$$;

CREATE INDEX idx_fixture_author ON public.fixture_table(author_id);
"""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        migrations_dir = tmp_path / "supabase" / "migrations"
        migrations_dir.mkdir(parents=True)
        fixture = migrations_dir / "099_fixture_test.sql"
        fixture.write_text(sql, encoding="utf-8")

        # Patch les paths globaux pour que parse_migration croie travailler dans tmp
        original_repo_root = mod.REPO_ROOT
        original_migrations_dir = mod.MIGRATIONS_DIR
        mod.REPO_ROOT = tmp_path
        mod.MIGRATIONS_DIR = migrations_dir
        try:
            result = mod.parse_migration(fixture)
        finally:
            mod.REPO_ROOT = original_repo_root
            mod.MIGRATIONS_DIR = original_migrations_dir

    nodes = result["nodes"]
    edges = result["edges"]
    defined_ids = result["defined_ids"]

    # 1. file_type / category sur tous les nodes (invariants critiques)
    for n in nodes:
        assert_eq(n.get("file_type"), "document", f"node {n['id']} file_type")
        assert_eq(n.get("category"), "sql", f"node {n['id']} category")

    # 2. Le node FILE existe avec un header non vide
    file_nodes = [n for n in nodes if n["id"].startswith("migration_")]
    assert_eq(len(file_nodes), 1, "1 node FILE attendu")
    assert_in("WHY : test fixture", file_nodes[0]["description"], "description du FILE")

    # 3. Les CREATE TABLE / FUNCTION sont définis
    assert_in("sql_fixture_table", defined_ids, "fixture_table doit être défini")
    assert_in("sql_fixture_rpc", defined_ids, "fixture_rpc doit être défini")

    # 4. CREATE INDEX skippé (anti-bruit)
    assert_not_in("sql_idx_fixture_author", defined_ids, "INDEX doit être skippé")

    # 5. Edges defines : FILE → fixture_table, FILE → fixture_rpc
    defines = [e for e in edges if e["relation"] == "defines"]
    define_targets = {e["target"] for e in defines}
    assert_in("sql_fixture_table", define_targets, "edge defines vers fixture_table")
    assert_in("sql_fixture_rpc", define_targets, "edge defines vers fixture_rpc")

    # 6. Edges uses : doit contenir places (REFERENCED via FROM ... places)
    uses = [e for e in edges if e["relation"] == "uses"]
    uses_targets = {e["target"] for e in uses}
    assert_in("sql_places", uses_targets, "edge uses vers places (FROM)")
    assert_in("sql_users", uses_targets, "edge uses vers users (REFERENCES)")

    # 7. Filtrage variables PL/pgSQL : v_count, v_result ne doivent PAS être dans uses
    assert_not_in("sql_v_count", uses_targets, "v_count (var PL/pgSQL) doit être filtré")
    assert_not_in("sql_v_result", uses_targets, "v_result (var PL/pgSQL) doit être filtré")

    # 8. Filtrage builtins postgres : jsonb_each_text ne doit pas être dans uses
    assert_not_in("sql_jsonb_each_text", uses_targets, "jsonb_each_text (builtin) doit être filtré")

    # 9. Edge "uses" : score de confiance plus bas que defines
    for e in uses:
        if "confidence_score" in e:
            assert e["confidence_score"] <= 0.9, f"uses confidence_score {e['confidence_score']} trop haut"

    # 10. Cross-migration ref dans le commentaire → edge follows
    follows = [e for e in edges if e["relation"] == "follows"]
    # Note : 001_baseline_* n'existe pas dans le tmp, donc l'edge ne sera PAS créée.
    # On vérifie juste que la regex MIGRATION_REF_RE ne fait pas crasher.
    # Pour un vrai test follows il faudrait ajouter un 001_xxx.sql dans le tmp.

    print(f"  parse_migration: OK ({len(nodes)} nodes, {len(edges)} edges)")


# -- Runner -----------------------------------------------------------------

def main() -> int:
    print("Tests graphify-sql.py")
    tests = [test_slug, test_extract_header_comment, test_parse_migration]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            print(f"  {t.__name__}: FAIL")
            print(f"    {e}")
            failed += 1
        except Exception as e:
            print(f"  {t.__name__}: ERROR — {type(e).__name__}: {e}")
            failed += 1

    if failed:
        print(f"\n{failed}/{len(tests)} test(s) failed")
        return 1
    print(f"\nAll {len(tests)} test(s) passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
