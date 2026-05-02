-- 063_v07_note_reactors.sql
-- WHY: get_note_reactions (mig 055) ne retourne que les counts par emoji.
--      Pour afficher dans le profil des autres voyageurs QUI a réagi avec
--      quel emoji (avatar + nom), on a besoin de la liste détaillée.
--      Décision Uriel 2026-05-02 : "voir comment ils réagirent et qui a réagi".
--
-- get_note_reactions reste utilisé pour la NoteReactionsRow de la carte
-- (counts agrégés rapides). get_note_reactors apporte le détail pour le profil.

CREATE OR REPLACE FUNCTION public.get_note_reactors(p_note_user_id text)
  RETURNS TABLE(
    emoji text,
    reactor_user_id text,
    reactor_name text,
    reactor_avatar_url text,
    reacted_at timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    nr.emoji,
    nr.reactor_user_id,
    COALESCE(NULLIF(TRIM(u.display_name), ''), u.first_name) AS reactor_name,
    u.avatar_url AS reactor_avatar_url,
    nr.created_at AS reacted_at
  FROM public.note_reactions nr
  JOIN public.users u ON u.id = nr.reactor_user_id
  JOIN public.users author ON author.id = nr.note_user_id
  WHERE nr.note_user_id = p_note_user_id
    AND author.note_posted_at IS NOT NULL
    AND author.note_posted_at >= NOW() - INTERVAL '24 hours'
  ORDER BY nr.emoji, nr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_note_reactors(text) TO authenticated;
