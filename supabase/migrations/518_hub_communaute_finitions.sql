-- WHY: Hub V2, plan 2 — finitions de la revue finale.
--   1. hub_ouverture : la pastille « lieux » compte exactement hub_lieux('a_moderer') — elle
--      ignorait le masquage et prenait minuit UTC au lieu de minuit à Paris pour la bascule.
--   2. changer_role(text, text) (mig 499, pas la surcharge à trois arguments des Compagnies) :
--      un admin ne change pas son propre rôle (il pourrait s'ôter l'accès au Hub).
--   3. hub_lieux : la limite est bornée comme dans hub_comptes (1 à 10 000), le décalage >= 0.
--   Chaque corps est la définition live (pg_get_functiondef), copiée entière ; seul le delta change.
-- SCHEMA CHECKED (14/10/2026, live) : pg_get_functiondef de hub_ouverture(text),
--   changer_role(text,text), hub_lieux(text,text,text,integer,integer) ; places.masked,
--   places.verified_at, places.created_at déjà lus par hub_lieux (mig 517).

CREATE OR REPLACE FUNCTION public.hub_ouverture(p_periode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
  v_local timestamp := now() AT TIME ZONE 'Europe/Paris';
  v_unite text;
  v_recul interval;
  v_debut timestamptz;
  v_avant_debut timestamptz;
  v_avant_fin timestamptz;
  v_avant jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_periode IS NULL OR p_periode NOT IN ('jour', 'semaine', 'mois', 'toujours') THEN
    PERFORM _refus('Période inconnue', 'periode');
  END IF;

  IF p_periode = 'toujours' THEN
    v_debut := '-infinity';
  ELSE
    v_unite := CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END;
    v_recul := CASE p_periode WHEN 'jour' THEN interval '1 day' WHEN 'semaine' THEN interval '7 days' ELSE interval '1 month' END;
    v_debut := date_trunc(v_unite, v_local) AT TIME ZONE 'Europe/Paris';
    v_avant_debut := date_trunc(v_unite, v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant_fin := (v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant := _hub_pouls(v_avant_debut, v_avant_fin);
  END IF;

  RETURN jsonb_build_object(
    'pouls', _hub_pouls(v_debut, v_fin)
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= v_debut)),
    'avant', v_avant,
    'attente', jsonb_build_object(
      'photos', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'photos_depuis', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending'),
      'lieux', (SELECT count(*) FROM places
                 WHERE masked = false AND verified_at IS NULL AND created_at >= '2026-10-07 00:00:00+02'::timestamptz),
      'signalements_lieu', (SELECT count(*) FROM signalements_lieu WHERE traite_le IS NULL),
      'signalements_enigme', (SELECT count(*) FROM signalements_enigme WHERE traite_le IS NULL),
      'achats', (SELECT count(*) FROM purchase_log WHERE status IN ('pending', 'no_match'))
    ),
    'sante', jsonb_build_object(
      'derniere_commande', (SELECT max(created_at) FROM purchase_log),
      'notifications', (SELECT count(*) FROM notifications WHERE created_at >= v_debut),
      'notifications_lues', (SELECT count(*) FROM notifications WHERE created_at >= v_debut AND read)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_ouverture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.changer_role(p_user text, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_user = auth.uid()::text THEN PERFORM _refus('Tu ne peux pas changer ton propre rôle', 'role'); END IF;
  IF p_role NOT IN ('user', 'ambassador', 'moderator', 'admin') THEN
    PERFORM _refus('Rôle inconnu', 'role');
  END IF;
  UPDATE users SET role = p_role WHERE id = p_user;
  IF NOT FOUND THEN PERFORM _refus('Compte introuvable', 'compte'); END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.changer_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_role(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_lieux(p_filtre text DEFAULT 'a_moderer'::text, p_recherche text DEFAULT NULL::text, p_nature text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total  int;
  v_rows   json;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_filtre NOT IN ('a_moderer','verifies','masques','tous') THEN PERFORM _refus('Filtre inconnu', 'filtre'); END IF;

  SELECT count(*) INTO v_total
    FROM public.places p
   WHERE (NULLIF(lower(btrim(p_recherche)),'') IS NULL OR position(lower(btrim(p_recherche)) IN lower(p.title)) > 0)
     AND (p_filtre <> 'a_moderer' OR (p.masked = false AND p.verified_at IS NULL AND p.created_at >= '2026-10-07 00:00:00+02'::timestamptz))
     AND (p_filtre <> 'verifies'  OR (p.masked = false AND p.verified_at IS NOT NULL))
     AND (p_filtre <> 'masques'   OR p.masked = true)
     AND (p_nature IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt
            WHERE pt.place_id = p.id AND pt.tag_id = p_nature));

  SELECT json_agg(row_to_json(r)) INTO v_rows FROM (
    SELECT
      p.id, p.title, p.address, p.latitude, p.longitude,
      p.masked, p.sensible, p.created_at, p.verified_at, p.author_id,
      COALESCE(au.display_name, au.first_name) AS author_name,
      vu.display_name AS verified_by_name,
      CASE WHEN jsonb_typeof(p.images) = 'array'
           THEN jsonb_array_length(p.images) ELSE 0 END AS photo_count,
      CASE WHEN jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0
           THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
           ELSE NULL END AS thumb_url,
      (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id) AS visit_count,
      COALESCE((
        SELECT json_agg(json_build_object(
                 'id', t.id, 'title', t.title, 'color', t.color,
                 'background', t.background, 'is_primary', pt.is_primary)
                 ORDER BY pt.is_primary DESC)
          FROM public.place_tags pt JOIN public.tags t ON t.id = pt.tag_id
         WHERE pt.place_id = p.id), '[]'::json) AS tags
    FROM public.places p
    LEFT JOIN public.users au ON au.id = p.author_id
    LEFT JOIN public.users vu ON vu.id = p.verified_by
    WHERE (NULLIF(lower(btrim(p_recherche)),'') IS NULL OR position(lower(btrim(p_recherche)) IN lower(p.title)) > 0)
      AND (p_filtre <> 'a_moderer' OR (p.masked = false AND p.verified_at IS NULL AND p.created_at >= '2026-10-07 00:00:00+02'::timestamptz))
      AND (p_filtre <> 'verifies'  OR (p.masked = false AND p.verified_at IS NOT NULL))
      AND (p_filtre <> 'masques'   OR p.masked = true)
      AND (p_nature IS NULL OR EXISTS (
            SELECT 1 FROM public.place_tags pt
             WHERE pt.place_id = p.id AND pt.tag_id = p_nature))
    ORDER BY (p.verified_at IS NOT NULL), p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 10000) OFFSET GREATEST(COALESCE(p_decalage, 0), 0)
  ) r;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END; $function$;

REVOKE ALL ON FUNCTION public.hub_lieux(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_lieux(text, text, text, integer, integer) TO authenticated;
