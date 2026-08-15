-- 342 — Lecture des écoutes de Fragments audio, réservée au staff
--
-- WHY : la table de la mig 340 est fermée à tous les rôles. Le Hub a besoin de la
-- lire, mais `authenticated` c'est aussi n'importe lequel des ~4900 comptes joueur.
-- Même raisonnement que la vue users_admin (mig 337) : la garde est _is_staff(),
-- et le GRANT dit la même chose que le corps de la fonction — `anon` est explicitement
-- révoqué (mig 338) pour ne pas dépendre du seul WHERE si le corps change un jour.

CREATE OR REPLACE FUNCTION public.get_fragment_audio_stats()
RETURNS TABLE (
  illustration_handle text,
  ecoutes             bigint,
  completions         bigint,
  taux                numeric,
  ecoutes_motif       bigint,
  ecoutes_produit     bigint,
  derniere_ecoute     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.illustration_handle,
    count(*)                                            AS ecoutes,
    count(*) FILTER (WHERE p.completed)                 AS completions,
    round(100.0 * count(*) FILTER (WHERE p.completed) / nullif(count(*), 0), 1) AS taux,
    count(*) FILTER (WHERE p.source = 'motif')          AS ecoutes_motif,
    count(*) FILTER (WHERE p.source = 'produit')        AS ecoutes_produit,
    max(p.created_at)                                   AS derniere_ecoute
  FROM public.fragment_audio_plays p
  WHERE public._is_staff() OR (SELECT auth.role()) = 'service_role'
  GROUP BY p.illustration_handle
  ORDER BY taux DESC NULLS LAST, ecoutes DESC;
$$;

COMMENT ON FUNCTION public.get_fragment_audio_stats() IS
  'Agrégat des écoutes par Illustration, trié par taux de complétion — la colonne
   qui décide si la voix off reste au budget. Zéro ligne pour un non-staff.';

REVOKE EXECUTE ON FUNCTION public.get_fragment_audio_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_fragment_audio_stats() TO authenticated;
