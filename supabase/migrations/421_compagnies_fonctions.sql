-- WHY: les gestes d'une Compagnie V2 (spec compagnies) : lire la liste et la fiche, fonder (Porteurs),
--      rejoindre (publique) ou demander (privée), répondre, quitter, nommer, passer la main, retirer ; les
--      deux notifications des demandes.
-- SCHEMA CHECKED (05/10/2026) : migration 420 ; notify(text, text, jsonb) ; users.title_gender ('m'|'f') ;
--      users.faction_id (la Compagnie active V1) ; définitions live de mes_notifications et _notification_v2.

CREATE FUNCTION public._refus(p_message text, p_hint text) RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION '%', p_message USING ERRCODE = 'P0001', HINT = p_hint;
END;
$function$;
REVOKE ALL ON FUNCTION public._refus(text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._verifier_fiche(p_nom text, p_devise text, p_mission text, p_couleur text)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_nom IS NOT NULL AND char_length(btrim(p_nom)) NOT BETWEEN 2 AND 40 THEN
    PERFORM public._refus('Un nom de 2 à 40 signes', 'nom');
  END IF;
  IF char_length(p_devise) > 80 THEN PERFORM public._refus('Une devise de 80 signes au plus', 'nom'); END IF;
  IF char_length(p_mission) > 500 THEN PERFORM public._refus('Une mission de 500 signes au plus', 'nom'); END IF;
  IF p_couleur IS NOT NULL AND p_couleur !~ '^#[0-9a-fA-F]{6}$' THEN PERFORM public._refus('Une couleur #rrggbb', 'nom'); END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._verifier_fiche(text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Une Compagnie dans une liste : ce qu'il faut pour la présenter, et ma place.
CREATE FUNCTION public._carte_compagnie(p_id text, p_moi text) RETURNS json LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT json_build_object('id', f.id, 'nom', f.title, 'devise', f.devise, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee,
    'membres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'role', public._role_compagnie(f.id, p_moi),
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = p_moi))
  FROM factions f WHERE f.id = p_id;
$function$;
REVOKE ALL ON FUNCTION public._carte_compagnie(text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.compagnies() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'porteur', public._est_porteur(moi.id),
    'miennes', COALESCE((SELECT json_agg(public._carte_compagnie(f.id, moi.id) ORDER BY f.title)
                         FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NOT NULL), '[]'::json),
    'autres', COALESCE((SELECT json_agg(public._carte_compagnie(f.id, moi.id)
                                        ORDER BY (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) DESC, f.title)
                        FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NULL), '[]'::json))
  FROM moi WHERE moi.id IS NOT NULL;
$function$;

CREATE FUNCTION public.compagnie(p_id text) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  r AS (SELECT public._role_compagnie(p_id, moi.id) AS role FROM moi)
  SELECT json_build_object(
    'id', f.id, 'nom', f.title, 'devise', f.devise, 'mission', f.description, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee, 'fondeeLe', f.created_at,
    'roles', json_build_object('chefM', f.chef_m, 'chefF', f.chef_f, 'officierM', f.officier_m, 'officierF', f.officier_f),
    'monRole', r.role,
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = moi.id),
    'membres', COALESCE((SELECT json_agg(json_build_object('id', u.id,
        'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url, 'role', m.role,
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END)
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at)
      FROM faction_members m JOIN users u ON u.id = m.user_id WHERE m.faction_id = f.id), '[]'::json),
    'lieux', COALESCE((SELECT json_agg(json_build_object('id', l.id, 'nom', l.title, 'par', l.par, 'quand', l.quand) ORDER BY l.quand DESC)
      FROM (SELECT DISTINCT ON (x.place_id) p.id, p.title, x.created_at AS quand,
              COALESCE(NULLIF(x.title, ''), (SELECT user_public_name(u.id, u.display_name, u.first_name)
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1)) AS par
            FROM expeditions x JOIN places p ON p.id = x.place_id
            WHERE x.pour_compagnie = f.id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
            ORDER BY x.place_id, x.created_at DESC) l), '[]'::json),
    'demandes', CASE WHEN r.role IN ('chef', 'officier') THEN COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url,
        'mot', d.mot, 'quand', d.cree_le) ORDER BY d.cree_le)
      FROM demandes_compagnie d JOIN users u ON u.id = d.user_id WHERE d.faction_id = f.id), '[]'::json) ELSE '[]'::json END)
  FROM factions f, moi, r
  WHERE f.id = p_id AND NOT f.retired AND moi.id IS NOT NULL;
$function$;

CREATE FUNCTION public.fonder_compagnie(p_nom text, p_devise text, p_mission text, p_couleur text, p_avatar text, p_privee boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_id text := 'f-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connexion requise', 'connexion'); END IF;
  IF NOT _est_porteur(v_moi) THEN PERFORM _refus('Fonder est réservé aux Porteurs', 'porteur'); END IF;
  PERFORM _verifier_fiche(COALESCE(p_nom, ''), p_devise, p_mission, COALESCE(p_couleur, '#5f6f86'));
  BEGIN
    INSERT INTO factions (id, title, devise, description, color, image_url, privee, created_by)
    VALUES (v_id, btrim(p_nom), NULLIF(btrim(p_devise), ''), NULLIF(btrim(p_mission), ''),
            COALESCE(p_couleur, '#5f6f86'), p_avatar, COALESCE(p_privee, false), v_moi);
  EXCEPTION WHEN unique_violation THEN PERFORM _refus('Ce nom est déjà pris', 'nom_pris');
  END;
  INSERT INTO faction_members (faction_id, user_id, joined_at, is_founder, role) VALUES (v_id, v_moi, now(), true, 'chef');
  UPDATE users SET faction_id = v_id WHERE id = v_moi AND faction_id IS NULL; -- la V1 : une Compagnie active
  INSERT INTO chat_messages (channel, user_id, user_name, content)
  SELECT v_id, v_moi, user_public_name(u.id, u.display_name, u.first_name), 'La Compagnie est fondée.'
  FROM users u WHERE u.id = v_moi;
  RETURN json_build_object('id', v_id);
END;
$function$;

CREATE FUNCTION public.modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text,
  p_avatar text, p_privee boolean, p_chef_m text, p_chef_f text, p_officier_m text, p_officier_f text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; v_role text := _role_compagnie(p_id, v_moi);
BEGIN
  IF v_role IS NULL OR v_role = 'membre' THEN PERFORM _refus('Réservé au Chef et aux Officiers', 'role'); END IF;
  IF v_role <> 'chef' AND COALESCE(p_chef_m, p_chef_f, p_officier_m, p_officier_f) IS NOT NULL THEN
    PERFORM _refus('Seul le Chef nomme les rôles', 'role');
  END IF;
  IF greatest(char_length(p_chef_m), char_length(p_chef_f), char_length(p_officier_m), char_length(p_officier_f)) > 30 THEN
    PERFORM _refus('Un nom de rôle de 30 signes au plus', 'nom');
  END IF;
  PERFORM _verifier_fiche(p_nom, p_devise, p_mission, p_couleur);
  BEGIN
    UPDATE factions SET
      title = COALESCE(NULLIF(btrim(p_nom), ''), title),
      devise = CASE WHEN p_devise IS NULL THEN devise ELSE NULLIF(btrim(p_devise), '') END,
      description = CASE WHEN p_mission IS NULL THEN description ELSE NULLIF(btrim(p_mission), '') END,
      color = COALESCE(p_couleur, color),
      image_url = COALESCE(p_avatar, image_url),
      privee = COALESCE(p_privee, privee),
      chef_m = COALESCE(NULLIF(btrim(p_chef_m), ''), chef_m),
      chef_f = COALESCE(NULLIF(btrim(p_chef_f), ''), chef_f),
      officier_m = COALESCE(NULLIF(btrim(p_officier_m), ''), officier_m),
      officier_f = COALESCE(NULLIF(btrim(p_officier_f), ''), officier_f),
      updated_at = now()
    WHERE id = p_id;
  EXCEPTION WHEN unique_violation THEN PERFORM _refus('Ce nom est déjà pris', 'nom_pris');
  END;
  -- Devenue publique : les demandes en attente deviennent des membres.
  IF p_privee IS FALSE THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role)
    SELECT faction_id, user_id, now(), 'membre' FROM demandes_compagnie WHERE faction_id = p_id
    ON CONFLICT DO NOTHING;
    DELETE FROM demandes_compagnie WHERE faction_id = p_id;
  END IF;
END;
$function$;

CREATE FUNCTION public.rejoindre_compagnie(p_id text, p_mot text DEFAULT NULL) RETURNS json LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; f factions; v_nom text; v_qui text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connexion requise', 'connexion'); END IF;
  SELECT * INTO f FROM factions WHERE id = p_id AND NOT retired;
  IF NOT FOUND THEN PERFORM _refus('Compagnie introuvable', 'introuvable'); END IF;
  IF _role_compagnie(p_id, v_moi) IS NOT NULL THEN PERFORM _refus('Déjà membre', 'deja'); END IF;
  IF NOT f.privee THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role) VALUES (p_id, v_moi, now(), 'membre');
    -- La V1 n'a qu'une Compagnie active : la première rejointe le devient si on n'en a pas.
    UPDATE users SET faction_id = p_id WHERE id = v_moi AND faction_id IS NULL;
    RETURN json_build_object('etat', 'membre');
  END IF;
  INSERT INTO demandes_compagnie (faction_id, user_id, mot) VALUES (p_id, v_moi, NULLIF(left(btrim(p_mot), 200), ''))
  ON CONFLICT (faction_id, user_id) DO UPDATE SET mot = EXCLUDED.mot, cree_le = now();
  BEGIN
    SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
    FOR v_qui IN SELECT user_id FROM faction_members WHERE faction_id = p_id AND role IN ('chef', 'officier') LOOP
      PERFORM notify(v_qui, 'demande_compagnie', jsonb_build_object('actorId', v_moi, 'actorName', v_nom,
        'compagnieId', p_id, 'compagnieNom', f.title));
    END LOOP;
  EXCEPTION WHEN others THEN RAISE WARNING 'rejoindre_compagnie : notification en échec (%)', SQLERRM;
  END;
  RETURN json_build_object('etat', 'demande');
END;
$function$;

CREATE FUNCTION public.repondre_demande(p_id text, p_user text, p_oui boolean) RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  IF COALESCE(_role_compagnie(p_id, v_moi), 'membre') = 'membre' THEN
    PERFORM _refus('Réservé au Chef et aux Officiers', 'role');
  END IF;
  DELETE FROM demandes_compagnie WHERE faction_id = p_id AND user_id = p_user;
  IF NOT FOUND THEN RETURN; END IF; -- déjà traitée par un autre officier
  IF p_oui THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role) VALUES (p_id, p_user, now(), 'membre')
    ON CONFLICT DO NOTHING;
    UPDATE users SET faction_id = p_id WHERE id = p_user AND faction_id IS NULL;
    BEGIN
      PERFORM notify(p_user, 'demande_acceptee', jsonb_build_object('actorId', v_moi,
        'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
        'compagnieId', p_id, 'compagnieNom', (SELECT title FROM factions WHERE id = p_id)));
    EXCEPTION WHEN others THEN RAISE WARNING 'repondre_demande : notification en échec (%)', SQLERRM;
    END;
  END IF;
END;
$function$;

-- Sans Chef : la main passe à l'officier le plus ancien, sinon au membre le plus ancien ; sans membre, la
-- Compagnie est retirée (jamais supprimée).
CREATE FUNCTION public._succession(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_id AND role = 'chef') THEN RETURN; END IF;
  UPDATE faction_members SET role = 'chef' WHERE (faction_id, user_id) = (
    SELECT faction_id, user_id FROM faction_members WHERE faction_id = p_id
    ORDER BY (role = 'officier') DESC, joined_at LIMIT 1);
  IF NOT FOUND THEN UPDATE factions SET retired = true WHERE id = p_id; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._succession(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.quitter_compagnie(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  DELETE FROM faction_members WHERE faction_id = p_id AND user_id = v_moi;
  DELETE FROM demandes_compagnie WHERE faction_id = p_id AND user_id = v_moi;
  UPDATE users SET faction_id = NULL WHERE id = v_moi AND faction_id = p_id; -- la V1 suit
  PERFORM _succession(p_id);
END;
$function$;

CREATE FUNCTION public.changer_role(p_id text, p_user text, p_role text) RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  IF _role_compagnie(p_id, v_moi) IS DISTINCT FROM 'chef' THEN PERFORM _refus('Réservé au Chef', 'role'); END IF;
  IF p_user = v_moi OR _role_compagnie(p_id, p_user) IS NULL OR p_role NOT IN ('chef', 'officier', 'membre') THEN
    PERFORM _refus('Rôle impossible', 'role');
  END IF;
  IF p_role = 'chef' THEN
    UPDATE faction_members SET role = 'officier' WHERE faction_id = p_id AND user_id = v_moi;
  END IF;
  UPDATE faction_members SET role = p_role WHERE faction_id = p_id AND user_id = p_user;
END;
$function$;

CREATE FUNCTION public.retirer_membre(p_id text, p_user text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; v_moi_role text := _role_compagnie(p_id, v_moi);
        v_role text := _role_compagnie(p_id, p_user);
BEGIN
  IF COALESCE(v_moi_role, 'membre') = 'membre' OR v_role IS NULL OR v_role = 'chef'
     OR (v_role = 'officier' AND v_moi_role <> 'chef') THEN
    PERFORM _refus('Retrait impossible', 'role');
  END IF;
  DELETE FROM faction_members WHERE faction_id = p_id AND user_id = p_user;
  UPDATE users SET faction_id = NULL WHERE id = p_user AND faction_id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.compagnies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnies() TO authenticated;
REVOKE ALL ON FUNCTION public.compagnie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnie(text) TO authenticated;
REVOKE ALL ON FUNCTION public.fonder_compagnie(text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fonder_compagnie(text, text, text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.modifier_compagnie(text, text, text, text, text, text, boolean, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_compagnie(text, text, text, text, text, text, boolean, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.rejoindre_compagnie(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rejoindre_compagnie(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.repondre_demande(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repondre_demande(text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.quitter_compagnie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quitter_compagnie(text) TO authenticated;
REVOKE ALL ON FUNCTION public.changer_role(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_role(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.retirer_membre(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_membre(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot', 'demande_compagnie', 'demande_acceptee']);
$function$;

CREATE OR REPLACE FUNCTION public.mes_notifications()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lignes AS (
    SELECT n.created_at AS quand, json_build_object(
      'id', n.id,
      'type', n.type,
      'quand', n.created_at,
      'lu', n.read,
      'qui', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
               'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
               'avatar', u.avatar_url) END,
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('id', p.id, 'nom', p.title) END,
      'nombre', COALESCE(n.data->>'viewCount', n.data->>'explorerCount', n.data->>'likeCount',
                         n.data->>'visitorsToday')::int,
      'extrait', n.data->>'extrait',
      'evenement', NULLIF(split_part(COALESCE(n.data->>'evenement', ''), ':', 1), ''),
      -- 421 : la Compagnie d'une demande.
      'compagnie', CASE WHEN n.data ? 'compagnieId' THEN
        json_build_object('id', n.data->>'compagnieId', 'nom', n.data->>'compagnieNom') END) AS ligne
    FROM (SELECT * FROM notifications
          WHERE recipient_id = (auth.uid())::text AND public._notification_v2(type)
          ORDER BY created_at DESC LIMIT 50) n
    LEFT JOIN users u ON u.id = n.data->>'actorId'
    LEFT JOIN places p ON p.id = n.data->>'placeId'
    UNION ALL
    -- Les mises à jour : le titre tient lieu d'extrait.
    SELECT m.publiee_le, json_build_object(
      'id', m.id,
      'type', 'mise_a_jour',
      'quand', m.publiee_le,
      'lu', COALESCE(m.publiee_le <= public._nouveautes_lues_jusqua(), true),
      'qui', NULL, 'lieu', NULL, 'nombre', NULL,
      'extrait', m.titre,
      'evenement', NULL,
      'compagnie', NULL)
    FROM mises_a_jour m
  )
  SELECT COALESCE(json_agg(l.ligne ORDER BY l.quand DESC), '[]'::json)
  FROM (SELECT * FROM lignes ORDER BY quand DESC LIMIT 50) l;
$function$;
