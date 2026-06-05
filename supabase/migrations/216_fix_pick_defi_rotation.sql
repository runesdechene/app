-- 216_fix_pick_defi_rotation.sql
-- FIX : la quête du jour ne tournait plus (toujours château/cathédrale) et la
-- quête de la semaine était figée (indiv = "Visite un château", collec =
-- "veille sur 7 arbres maîtres"). Les joueurs qui plantaient un étendard GPS
-- (action 'veilleur') n'avaient donc AUCUN défi individuel qui les créditait
-- → pas de validation, pas de reward modal.
--
-- Cause racine : le tri déterministe de _pick_defi (mig 192) était
--   ORDER BY ((display_order * 2654435761) # v_seed)
-- où v_seed = md5(period_key)::bit(32)::bigint (donc 0..2^32-1).
-- Mais display_order * 2654435761 déborde au-delà du bit 32 : pour
-- display_order=10 → 26 544 357 610 > 2^32. Le XOR avec un seed sur 32 bits ne
-- peut JAMAIS toucher ces bits hauts. Résultat : l'ordre est dominé par les bits
-- hauts (fixes par ligne, ≈ display_order × nombre d'or), le seed ne brasse que
-- les bits bas — qui ne départagent que les 1-2 lignes partageant le plus petit
-- "bucket" de bits hauts. Chaque vivier était donc figé sur 1-2 candidats, quelle
-- que soit la période. (Vérifié sur prod : daily ∈ {château, cathédrale} ;
-- weekly indiv ≡ w_visit_chateau ; weekly collec ≡ c_veille_arbre.)
--
-- Fix : trier par md5(id || '|' || period_key). id est la PK (texte, unique) →
-- distribution uniforme sur TOUTES les lignes du vivier, déterministe par période,
-- stable dans la période, vraie rotation d'une période à l'autre. Aucun débordement,
-- aucune dépendance à la valeur de display_order. Les défis 'veilleur' redeviennent
-- sélectionnables.

CREATE OR REPLACE FUNCTION public._pick_defi(p_cadence text, p_scope text) RETURNS public.defis
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.defis; v_pk text;
BEGIN
  v_pk := public._defi_period_key(p_cadence);
  SELECT * INTO v FROM public.defis
   WHERE active AND cadence = p_cadence AND scope = p_scope
   ORDER BY md5(id || '|' || v_pk)
   LIMIT 1;
  RETURN v;
END; $$;
