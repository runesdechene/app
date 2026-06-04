-- 208_get_mission_participants.sql
-- WHY : créer de la VIE sur les missions. La fiche n'affichait qu'un compteur
-- muet (« · N engagés ») : on ne voyait pas QUI s'était engagé, rien de cliquable.
-- Cette RPC ramène prénom + avatar des engagés pour une rangée d'avatars cliquables
-- (→ profil), dans les deux états de la modale (avant/après le pacte).
--
-- Calquée sur get_defi_participants (mig 205), mais source directe : la table
-- mission_participants (mig 184) jointe à users. Tri joined_at DESC (derniers
-- engagés en tête → sensation « ça bouge »). Anon autorisé : avatars publics,
-- cohérent avec get_mission_state (mig 184) lui aussi grant anon.

CREATE OR REPLACE FUNCTION public.get_mission_participants(p_slug text, p_limit int DEFAULT 12)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'total', (SELECT count(*) FROM public.mission_participants WHERE mission_slug = p_slug),
    'participants', COALESCE((
      SELECT json_agg(json_build_object(
               'userId',   t.user_id,
               'name',     u.first_name,
               'avatar',   u.avatar_url,
               'joinedAt', t.joined_at
             ) ORDER BY t.joined_at DESC, t.user_id)
        FROM (
          SELECT user_id, joined_at
            FROM public.mission_participants
           WHERE mission_slug = p_slug
           ORDER BY joined_at DESC, user_id
           LIMIT p_limit
        ) t
        JOIN public.users u ON u.id = t.user_id
    ), '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_participants(text, int) TO authenticated, anon;
