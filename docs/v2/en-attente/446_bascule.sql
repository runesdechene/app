-- WHY: la bascule (spec docs/superpowers/specs/2026-10-07-v2-bascule-design.md) — ce que la V2
--      doit savoir faire seule, sans la V1.
--   1. compagnie_par_lien : les liens d'invitation déjà partagés (`/?company=<clé>`) mènent à la
--      fiche de la Compagnie. La clé est le public_slug (migration 282) ou, pour les plus anciens
--      liens, l'identifiant lui-même (comme useCompanyInvite de la V1).
--   2. publier_mise_a_jour : une Nouveauté publiée envoie un push, comme les Annonces (migration
--      220) — une notification `mise_a_jour` par joueur qui a un abonnement et
--      push_important_enabled ; le déclencheur de la migration 142 envoie le push (send-push).
--      La cloche de la V2 ne la montre pas (_notification_v2 ne connaît pas ce type : la Nouveauté
--      y est déjà) ; send-email ignore ce type.
-- ATTENTION — À APPLIQUER LE JOUR DE LA BASCULE SEULEMENT : la cloche de la V1 lit toutes les
--      notifications, un type inconnu y ferait une ligne vide.
-- BASE: publier_mise_a_jour copiée de sa définition live (migration 436 ; la 437 ne la touche pas).
-- SCHEMA CHECKED (2026-10-07) : factions.public_slug / retired (282) ; push_subscriptions.user_id
--   (141) ; users.push_important_enabled / is_active (220) ; notifications(recipient_id, type, data).

CREATE FUNCTION public.compagnie_par_lien(p_cle text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT f.id FROM factions f
  WHERE (f.public_slug = p_cle OR f.id = p_cle) AND NOT f.retired
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.compagnie_par_lien(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnie_par_lien(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publier_mise_a_jour(p_titre text, p_texte text,
                                           p_image text DEFAULT NULL, p_version text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  INSERT INTO mises_a_jour (titre, texte, image, version, par)
  VALUES (btrim(p_titre), btrim(p_texte), NULLIF(btrim(p_image), ''), NULLIF(btrim(p_version), ''),
          (auth.uid())::text)
  RETURNING id INTO v_id;

  -- 446 : le push, à ceux qui en ont un et l'acceptent.
  INSERT INTO notifications (recipient_id, type, data)
  SELECT u.id, 'mise_a_jour', jsonb_build_object('id', v_id, 'titre', btrim(p_titre))
    FROM users u
   WHERE u.push_important_enabled AND u.is_active IS NOT FALSE
     AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id);

  RETURN json_build_object('id', v_id);
END;
$function$;
