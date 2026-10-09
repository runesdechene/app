-- WHY: l'énergie revient pour les lieux lointains (spec 2026-10-01-v2-energie, Uriel 01/10/2026,
--      premier retour des testeurs). Découvrir reste gratuit à moins de 100 km de sa position ;
--      au-delà 1 / 2 / 3 points (3 sans position). Jauge : 10 + 1 par Fragment, un point par heure ;
--      elle remplace tous les bonus d'énergie (Compagnie, Fragments spéciaux, outsider). La jauge est
--      partagée : get_user_energy (V1) prend le même maximum et la même recharge.
--   1. Les réglages (app_settings), lus par _reglage ; default_max_energy passe à 10.
--   2. _energie_max : le maximum, un seul calcul. _cout_decouverte : le prix depuis une position.
--   3. get_user_energy (copiée de sa définition live) : maximum et recharge sans bonus. Les
--      autres jauges (conquête, construction, vitalité) ne changent pas.
--   4. mon_energie() et cout_decouverte() : la jauge et le prix pour la V2.
--   5. decouvrir_lieu (copiée de sa définition live) : reçoit la position, fait payer, refuse
--      (RDC01) quand la jauge ne suffit pas. L'ancienne signature (text) tombe : seule la V2
--      l'appelait, et la nouvelle, avec ses valeurs par défaut, répond au même appel.
-- SCHEMA CHECKED (01/10/2026, information_schema et définitions live) : app_settings(key text
--      PRIMARY KEY, value text, updated_at) ; users(energy_points numeric, energy_reset_at
--      timestamptz, max_energy numeric) ; user_fragments(user_id varchar, fragment_id int) ;
--      haversine_km(numeric x4), places(latitude real, longitude real) ; _lieu_visible(text) ; get_user_energy(text) et
--      decouvrir_lieu(text) copiées de leur définition live.

INSERT INTO app_settings (key, value) VALUES
  ('decouverte_gratuite_km', '100'), ('decouverte_palier_1_km', '500'),
  ('decouverte_palier_2_km', '1500'), ('decouverte_cout_1', '1'),
  ('decouverte_cout_2', '2'), ('decouverte_cout_3', '3')
ON CONFLICT (key) DO NOTHING;
UPDATE app_settings SET value = '10' WHERE key = 'default_max_energy';

CREATE OR REPLACE FUNCTION public._reglage(p_cle text, p_defaut numeric)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT value::numeric FROM app_settings WHERE key = p_cle), p_defaut);
$$;

-- Le maximum de la jauge : un seul calcul, pour la V1 et la V2.
CREATE OR REPLACE FUNCTION public._energie_max(p_user text)
 RETURNS int
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT public._reglage('default_max_energy', 10)::int
       + (SELECT count(DISTINCT fragment_id)::int FROM user_fragments WHERE user_id = p_user);
$$;

-- Le prix d'une découverte depuis une position (sans position : le prix le plus haut).
CREATE OR REPLACE FUNCTION public._cout_decouverte(p_id text, p_lat numeric, p_lng numeric)
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  WITH d AS (
    SELECT CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
                ELSE public.haversine_km(p_lat, p_lng, l.latitude::numeric, l.longitude::numeric) END AS km
    FROM places l WHERE l.id = p_id)
  SELECT json_build_object(
    'distanceKm', round(d.km, 0),
    'cout', (CASE
      WHEN d.km IS NULL THEN public._reglage('decouverte_cout_3', 3)
      WHEN d.km < public._reglage('decouverte_gratuite_km', 100) THEN 0
      WHEN d.km < public._reglage('decouverte_palier_1_km', 500) THEN public._reglage('decouverte_cout_1', 1)
      WHEN d.km < public._reglage('decouverte_palier_2_km', 1500) THEN public._reglage('decouverte_cout_2', 2)
      ELSE public._reglage('decouverte_cout_3', 3) END)::int)
  FROM d;
$$;

REVOKE ALL ON FUNCTION public._reglage(text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._energie_max(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cout_decouverte(text, numeric, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  -- 399 : un seul maximum, pour la V1 et la V2 — 10 + 1 par Fragment, aucun autre bonus.
  v_max_energy := public._energie_max(p_user_id);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  -- 399 : un point par cycle de base, sans bonus.
  v_energy_cycle := GREATEST(600, v_base_energy_cycle);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy (FIX: avancer energy_reset_at même au max)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_ticks > 0 THEN
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_energy := LEAST(v_energy + v_add, v_max_energy);
    END IF;
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_ticks > 0 THEN
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    END IF;
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_ticks > 0 THEN
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_construction := LEAST(v_construction + v_add, v_max_construction);
    END IF;
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_ticks > 0 THEN
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    END IF;
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_max_energy - public._reglage('default_max_energy', 10),
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$function$;

-- La jauge pour la V2 : recharge comprise (get_user_energy l'écrit).
CREATE OR REPLACE FUNCTION public.mon_energie()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  v := public.get_user_energy((auth.uid())::text);
  RETURN json_build_object(
    'points', floor((v->>'energy')::numeric)::int,
    'max', (v->>'maxEnergy')::numeric::int,
    'prochainDans', CASE WHEN (v->>'energy')::numeric >= (v->>'maxEnergy')::numeric THEN NULL
                         ELSE (v->>'nextPointIn')::int END,
    'parPoint', (v->>'energyCycle')::int);
END;
$$;

-- Le prix avant le geste, avec la jauge : le voile dit « il t'en restera N ».
CREATE OR REPLACE FUNCTION public.cout_decouverte(p_id text, p_lat numeric, p_lng numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  c json;
  e json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  c := public._cout_decouverte(p_id, p_lat, p_lng);
  e := public.mon_energie();
  RETURN json_build_object(
    'cout', (c->>'cout')::int,
    'distanceKm', (c->>'distanceKm')::numeric,
    'points', (e->>'points')::int,
    'max', (e->>'max')::int,
    'prochainDans', (e->>'prochainDans')::int,
    'parPoint', (e->>'parPoint')::int);
END;
$$;

REVOKE ALL ON FUNCTION public.mon_energie() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_energie() TO authenticated;
REVOKE ALL ON FUNCTION public.cout_decouverte(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cout_decouverte(text, numeric, numeric) TO authenticated;

DROP FUNCTION public.decouvrir_lieu(text);

CREATE OR REPLACE FUNCTION public.decouvrir_lieu(p_id text, p_lat numeric DEFAULT NULL, p_lng numeric DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_xp_avant int;
  v_xp_apres int;
  v_niveau int;
  v_seuil int;
  v_suivant int;
  v_cout int;
  v_points numeric;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi;
  -- Un lieu qu'on a ajouté ou visité est déjà connu : pas de découverte à distance en plus.
  IF NOT EXISTS (SELECT 1 FROM places p WHERE p.id = p_id AND p.author_id = v_moi)
     AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p_id AND e.user_id = v_moi) THEN
    -- 399 : au-delà de 100 km, découvrir coûte de l'énergie ; une découverte faite ne se repaie pas.
    IF NOT EXISTS (SELECT 1 FROM places_discovered d WHERE d.user_id = v_moi AND d.place_id = p_id) THEN
      v_cout := (public._cout_decouverte(p_id, p_lat, p_lng)->>'cout')::int;
      IF v_cout > 0 THEN
        PERFORM public.get_user_energy(v_moi); -- la recharge d'abord
        SELECT energy_points INTO v_points FROM users WHERE id = v_moi FOR UPDATE;
        IF v_points < v_cout THEN
          RAISE EXCEPTION 'Pas assez d''énergie' USING ERRCODE = 'RDC01';
        END IF;
        UPDATE users SET energy_points = energy_points - v_cout WHERE id = v_moi;
      END IF;
    END IF;
    INSERT INTO places_discovered (user_id, place_id, method) VALUES (v_moi, p_id, 'remote')
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;

  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);
  RETURN json_build_object(
    'rang', (SELECT count(*) FROM places_discovered d WHERE d.user_id = v_moi),
    'gain', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro.
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3));
END;
$function$;

REVOKE ALL ON FUNCTION public.decouvrir_lieu(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decouvrir_lieu(text, numeric, numeric) TO authenticated;
