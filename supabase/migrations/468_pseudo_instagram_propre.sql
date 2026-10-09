-- 468 — Le pseudo Instagram s'enregistre sans « @ » ni adresse, quel que soit le chemin
--
-- WHY : Uriel, 08/10/2026 : le lien Instagram d'un profil gardait le « @ » tapé par erreur et
--   menait à une page introuvable. La V2 nettoyait déjà à l'enregistrement du profil, mais pas les
--   autres chemins (comptes de la V1, formulaires du Hub) : 3 pseudos sur 17 commençaient par « @ ».
--   La base nettoie désormais elle-même, à chaque écriture, comme l'app (features/compte/lib/
--   instagram.ts) : adresse collée → pseudo, « @ » retirés. Ce qui n'est pas un pseudo (un nom avec
--   des espaces) est gardé tel quel, sans les espaces autour : l'app n'en fait simplement pas un lien.
--
-- SCHEMA CHECKED (08/10/2026, live) : users.instagram_id character varying (17 non vides).

CREATE OR REPLACE FUNCTION public._pseudo_instagram(p_saisie text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN nullif(btrim(p_saisie), '') IS NULL THEN NULL
    WHEN propre ~ '^[A-Za-z0-9._]{1,30}$' THEN propre
    ELSE btrim(p_saisie)
  END
  FROM (SELECT regexp_replace(
                 regexp_replace(
                   regexp_replace(btrim(p_saisie), '^(https?://)?(www\.)?instagram\.com/', '', 'i'),
                 '[/?#].*$', ''),
               '^@+', '') AS propre) x;
$$;

CREATE OR REPLACE FUNCTION public._trg_pseudo_instagram()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.instagram_id := public._pseudo_instagram(NEW.instagram_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pseudo_instagram_propre ON public.users;
CREATE TRIGGER pseudo_instagram_propre
  BEFORE INSERT OR UPDATE OF instagram_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._trg_pseudo_instagram();

UPDATE public.users SET instagram_id = public._pseudo_instagram(instagram_id)
WHERE instagram_id IS DISTINCT FROM public._pseudo_instagram(instagram_id);
