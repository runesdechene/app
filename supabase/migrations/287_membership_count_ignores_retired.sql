-- 287_membership_count_ignores_retired.sql
-- WHY : le contrôle « max 2 Compagnies » comptait TOUTES les lignes faction_members,
-- y compris celles vers des factions RETIRÉES (vestiges des héritages imposés). Un joueur
-- avec une adhésion legacy à une faction retirée (ex. Uriel → faction-nordique retirée)
-- se voyait refuser la création/adhésion avec « too_many » alors qu'il n'a qu'1 Compagnie
-- active. On filtre retired = false dans les deux compteurs (create_faction + join_faction).
-- Cohérent avec get_my_factions (qui filtre déjà retired). ADDITIF.

CREATE OR REPLACE FUNCTION public.create_faction(
  p_user_id text, p_name text, p_color text, p_description text, p_image_url text,
  p_tags text[] DEFAULT '{}', p_emblem_icon text DEFAULT NULL, p_emblem_mono text DEFAULT 'none'
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cost int; v_balance int; v_max int; v_count int;
  v_name text; v_id text; v_order int; v_try int := 0; v_tags text[]; v_mono text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  v_name := btrim(coalesce(p_name,''));
  IF v_name = ''            THEN RETURN json_build_object('error','name_required');  END IF;
  IF length(v_name) > 40    THEN RETURN json_build_object('error','name_too_long');  END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE lower(title) = lower(v_name) AND retired = false)
                            THEN RETURN json_build_object('error','name_taken');     END IF;

  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count
  FROM faction_members m JOIN factions f2 ON f2.id = m.faction_id
  WHERE m.user_id = p_user_id AND f2.retired = false;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  v_cost := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_founding_cost'), 200);
  SELECT balance INTO v_balance FROM user_crowns WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_balance,0) < v_cost THEN
    RETURN json_build_object('error','insufficient_crowns','cost',v_cost,'balance',COALESCE(v_balance,0));
  END IF;

  v_tags := COALESCE((SELECT array_agg(x) FROM (
    SELECT btrim(t) AS x FROM unnest(p_tags) t WHERE btrim(t) <> '' AND length(btrim(t)) <= 24 LIMIT 6
  ) s), '{}');
  v_mono := CASE WHEN p_emblem_mono IN ('none','white','black') THEN p_emblem_mono ELSE 'none' END;

  LOOP
    v_id := 'f-' || substr(md5(v_name || clock_timestamp()::text || v_try::text), 1, 12);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM factions WHERE id = v_id);
    v_try := v_try + 1;
  END LOOP;

  UPDATE user_crowns SET balance = balance - v_cost, updated_at = now() WHERE user_id = p_user_id;
  SELECT COALESCE(max("order"),0) + 1 INTO v_order FROM factions;

  INSERT INTO factions (id, title, color, description, image_url, "order", created_by, retired, tags,
                        emblem_icon, emblem_mono, created_at, updated_at,
                        bonus_energy, bonus_conquest, bonus_construction, bonus_regen,
                        bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction)
    VALUES (v_id, v_name,
            COALESCE(NULLIF(btrim(p_color),''), '#C19A6B'),
            NULLIF(btrim(p_description),''),
            NULLIF(btrim(p_image_url),''),
            v_order, p_user_id, false, v_tags,
            NULLIF(btrim(coalesce(p_emblem_icon,'')),''), v_mono, now(), now(),
            0,0,0,0,0,0,0);

  INSERT INTO faction_members (faction_id, user_id, is_founder, crowns_invested)
    VALUES (v_id, p_user_id, true, v_cost);
  UPDATE users SET faction_id = v_id WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'factionId', v_id, 'cost', v_cost);
END;$$;

CREATE OR REPLACE FUNCTION public.join_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int; v_active text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','already_member'); END IF;
  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count
  FROM faction_members m JOIN factions f2 ON f2.id = m.faction_id
  WHERE m.user_id = p_user_id AND f2.retired = false;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  INSERT INTO faction_members (faction_id, user_id) VALUES (p_faction_id, p_user_id);
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active IS NULL THEN
    UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id;
    v_active := p_faction_id;
  END IF;

  INSERT INTO activity_log (type, actor_id, faction_id, data)
  SELECT 'faction_join', p_user_id, p_faction_id,
         jsonb_build_object(
           'actorName',      COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
           'factionTitle',   f.title,
           'factionColor',   f.color,
           'factionPattern', f.pattern
         )
  FROM users u, factions f WHERE u.id = p_user_id AND f.id = p_faction_id;

  RETURN json_build_object('success', true, 'activeFactionId', v_active);
END;$$;