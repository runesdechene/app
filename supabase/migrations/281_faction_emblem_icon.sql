-- 281_faction_emblem_icon.sql
-- WHY : friction sur l'illustration des Compagnies (les joueurs peinent à trouver une
-- image). On ajoute un SET de glyphes historiques (Fleur de Lys, SPQR, temple grec,
-- triskèle…) rendus côté client. La bannière = couleur de fond + emblème, où l'emblème
-- est AU CHOIX : un glyphe (emblem_icon = slug) OU un PNG importé (image_url). Un filtre
-- monochrome (emblem_mono : none/white/black) permet de passer le PNG/glyphe en blanc ou
-- noir. ADDITIF.

ALTER TABLE public.factions
  ADD COLUMN IF NOT EXISTS emblem_icon text,
  ADD COLUMN IF NOT EXISTS emblem_mono text NOT NULL DEFAULT 'none';

-- ── create_faction (+ p_emblem_icon, p_emblem_mono) ──
DROP FUNCTION IF EXISTS public.create_faction(text,text,text,text,text,text[]);
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
  SELECT count(*) INTO v_count FROM faction_members WHERE user_id = p_user_id;
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
GRANT EXECUTE ON FUNCTION public.create_faction(text,text,text,text,text,text[],text,text) TO authenticated, service_role;

-- ── update_faction_identity (+ p_emblem_icon, p_emblem_mono) ──
DROP FUNCTION IF EXISTS public.update_faction_identity(text,text,text,text,text,text,text[]);
CREATE OR REPLACE FUNCTION public.update_faction_identity(
  p_user_id text, p_faction_id text, p_name text, p_color text, p_description text, p_image_url text,
  p_tags text[] DEFAULT '{}', p_emblem_icon text DEFAULT NULL, p_emblem_mono text DEFAULT 'none'
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_tags text[]; v_mono text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF public._faction_chef(p_faction_id) IS DISTINCT FROM p_user_id THEN RETURN json_build_object('error','not_chef'); END IF;
  v_name := btrim(coalesce(p_name,''));
  IF v_name = ''         THEN RETURN json_build_object('error','name_required'); END IF;
  IF length(v_name) > 40 THEN RETURN json_build_object('error','name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE lower(title) = lower(v_name) AND id <> p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','name_taken'); END IF;

  v_tags := COALESCE((SELECT array_agg(x) FROM (
    SELECT btrim(t) AS x FROM unnest(p_tags) t WHERE btrim(t) <> '' AND length(btrim(t)) <= 24 LIMIT 6
  ) s), '{}');
  v_mono := CASE WHEN p_emblem_mono IN ('none','white','black') THEN p_emblem_mono ELSE 'none' END;

  UPDATE factions SET
    title = v_name,
    color = COALESCE(NULLIF(btrim(p_color),''), color),
    description = NULLIF(btrim(p_description),''),
    image_url = NULLIF(btrim(p_image_url),''),
    tags = v_tags,
    emblem_icon = NULLIF(btrim(coalesce(p_emblem_icon,'')),''),
    emblem_mono = v_mono,
    updated_at = now()
  WHERE id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.update_faction_identity(text,text,text,text,text,text,text[],text,text) TO authenticated, service_role;

-- ── list_factions : + emblemIcon, emblemMono ──
CREATE OR REPLACE FUNCTION public.list_factions(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json; v_from timestamptz; v_to timestamptz;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           f.tags, f.emblem_icon AS "emblemIcon", f.emblem_mono AS "emblemMono",
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) AS "memberCount",
           (COALESCE((SELECT sum(public._user_coupe_score(u.id, v_from, v_to))
                      FROM users u
                      WHERE u.faction_id = f.id
                        AND EXISTS (SELECT 1 FROM faction_members m2
                                    WHERE m2.user_id = u.id AND m2.faction_id = f.id)), 0)
            + public._faction_gold_coupe(f.id, v_from, v_to))::int AS "score"
    FROM factions f
    WHERE f.retired = false AND (p_search IS NULL OR f.title ILIKE '%' || p_search || '%')
    ORDER BY "score" DESC, "memberCount" DESC, f."order" ASC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;

-- ── get_faction_detail : + emblemIcon, emblemMono ──
CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  WITH mem AS (
    SELECT m.user_id,
           COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
           u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested,
           ( (CASE WHEN u.faction_id = p_faction_id
                   THEN public._user_coupe_score(m.user_id, v_from, v_to) ELSE 0 END)
             + public._member_gold_coupe(m.user_id, p_faction_id, v_from, v_to) ) AS coupe
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder,
      'crownsInvested', crowns_invested, 'coupe', coupe
    ) ORDER BY (coupe + crowns_invested) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(coupe), 0)::int
  INTO v_members, v_total
  FROM mem;
  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;

-- ── get_my_factions : + emblemIcon, emblemMono ──
CREATE OR REPLACE FUNCTION public.get_my_factions(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active text; v_rows json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('activeFactionId', NULL, 'factions', '[]'::json);
  END IF;
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t."joinedAt"), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           f.emblem_icon AS "emblemIcon", f.emblem_mono AS "emblemMono",
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members mm WHERE mm.faction_id = f.id) AS "memberCount",
           (f.id = v_active) AS "isActive",
           m.is_founder AS "isFounder",
           m.joined_at AS "joinedAt"
    FROM faction_members m
    JOIN factions f ON f.id = m.faction_id
    WHERE m.user_id = p_user_id AND f.retired = false
  ) t;

  RETURN json_build_object('activeFactionId', v_active, 'factions', v_rows);
END;$$;
