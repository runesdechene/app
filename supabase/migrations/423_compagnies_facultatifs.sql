-- WHY: l'avatar et les noms des rôles sont facultatifs (un officier enregistre la fiche sans toucher aux
--      rôles, que seul le Chef nomme) : ces paramètres prennent DEFAULT NULL, que le front peut omettre.
-- SCHEMA CHECKED (05/10/2026) : définitions live de fonder_compagnie et modifier_compagnie (mig 421).
-- DROP vérifié : ajouter des valeurs par défaut demande de recréer la fonction ; seules les deux
--      fonctions elles-mêmes, appelées par le front V2, sont touchées.

DROP FUNCTION public.fonder_compagnie(text, text, text, text, text, boolean);
DROP FUNCTION public.modifier_compagnie(text, text, text, text, text, text, boolean, text, text, text, text);
CREATE OR REPLACE FUNCTION public.fonder_compagnie(p_nom text, p_devise text, p_mission text, p_couleur text, p_avatar text DEFAULT NULL::text, p_privee boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text, p_avatar text DEFAULT NULL::text, p_privee boolean DEFAULT NULL::boolean, p_chef_m text DEFAULT NULL::text, p_chef_f text DEFAULT NULL::text, p_officier_m text DEFAULT NULL::text, p_officier_f text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

REVOKE ALL ON FUNCTION public.fonder_compagnie(text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fonder_compagnie(text, text, text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.modifier_compagnie(text, text, text, text, text, text, boolean, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_compagnie(text, text, text, text, text, text, boolean, text, text, text, text) TO authenticated;
