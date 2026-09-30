-- WHY: les mises à jour de l'app dans la cloche de la V2 (maquettes « Notifications — une mise à
--      jour » et « Nouveautés — la mise à jour ouverte », validées par Uriel le 30/09/2026).
--      Écrites et publiées depuis le Hub, une seule ligne pour tout le monde : rien n'est recopié
--      dans `notifications`, que la V1 lit en entier (une sorte inconnue y ferait une ligne vide).
--   1. mises_a_jour : titre, texte, date de publication.
--   2. nouveautes_vues : jusqu'où chacun a lu. Sans ligne, la date d'inscription : un nouveau
--      venu ne trouve pas d'anciennes nouveautés en rouge.
--   3. mes_notifications / notifications_non_lues / marquer_notifications_lues : copiées de leur
--      définition live, les mises à jour mêlées aux notifications (sorte « mise_a_jour »).
--   4. mises_a_jour_publiees() : la page « Nouveautés » (et la liste du Hub).
--   5. publier_mise_a_jour / supprimer_mise_a_jour : le Hub, administrateurs seulement.
-- SCHEMA CHECKED (30/09/2026, information_schema et définitions live) : users(id text, role,
--      created_at timestamptz) ; _is_admin() ; mes_notifications(), notifications_non_lues(),
--      marquer_notifications_lues() telles que la migration 386 les a posées (inchangées depuis).

CREATE TABLE public.mises_a_jour (
  id bigserial PRIMARY KEY,
  titre text NOT NULL CHECK (char_length(btrim(titre)) BETWEEN 1 AND 80),
  texte text NOT NULL CHECK (char_length(btrim(texte)) BETWEEN 1 AND 3000),
  publiee_le timestamptz NOT NULL DEFAULT now(),
  par text REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE public.nouveautes_vues (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  vue_le timestamptz NOT NULL
);

-- On n'y touche que par les fonctions ci-dessous.
ALTER TABLE public.mises_a_jour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nouveautes_vues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mises_a_jour, public.nouveautes_vues FROM anon, authenticated;

-- Depuis quand les nouveautés de la personne connectée sont lues.
CREATE OR REPLACE FUNCTION public._nouveautes_lues_jusqua()
 RETURNS timestamptz
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT vue_le FROM nouveautes_vues WHERE user_id = (auth.uid())::text),
    (SELECT created_at FROM users WHERE id = (auth.uid())::text));
$function$;

REVOKE ALL ON FUNCTION public._nouveautes_lues_jusqua() FROM PUBLIC, anon, authenticated;

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
      'evenement', NULLIF(split_part(COALESCE(n.data->>'evenement', ''), ':', 1), '')) AS ligne
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
      'evenement', NULL)
    FROM mises_a_jour m
  )
  SELECT COALESCE(json_agg(l.ligne ORDER BY l.quand DESC), '[]'::json)
  FROM (SELECT * FROM lignes ORDER BY quand DESC LIMIT 50) l;
$function$;

CREATE OR REPLACE FUNCTION public.notifications_non_lues()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (SELECT count(*)::int FROM notifications
          WHERE recipient_id = (auth.uid())::text AND NOT read AND public._notification_v2(type))
       + (SELECT count(*)::int FROM mises_a_jour
          WHERE publiee_le > public._nouveautes_lues_jusqua());
$function$;

CREATE OR REPLACE FUNCTION public.marquer_notifications_lues()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE notifications SET read = true
  WHERE recipient_id = (auth.uid())::text AND NOT read;
  GET DIAGNOSTICS v_nombre = ROW_COUNT;
  INSERT INTO nouveautes_vues (user_id, vue_le) VALUES ((auth.uid())::text, now())
  ON CONFLICT (user_id) DO UPDATE SET vue_le = now();
  RETURN v_nombre;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mises_a_jour_publiees()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', id, 'titre', titre, 'texte', texte, 'quand', publiee_le)
    ORDER BY publiee_le DESC), '[]'::json)
  FROM mises_a_jour;
$function$;

REVOKE ALL ON FUNCTION public.mises_a_jour_publiees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mises_a_jour_publiees() TO authenticated;

CREATE OR REPLACE FUNCTION public.publier_mise_a_jour(p_titre text, p_texte text)
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
  INSERT INTO mises_a_jour (titre, texte, par)
  VALUES (btrim(p_titre), btrim(p_texte), (auth.uid())::text)
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.publier_mise_a_jour(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mise_a_jour(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.supprimer_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  DELETE FROM mises_a_jour WHERE id = p_id;
  RETURN json_build_object('ok', FOUND);
END;
$function$;

REVOKE ALL ON FUNCTION public.supprimer_mise_a_jour(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_mise_a_jour(bigint) TO authenticated;
