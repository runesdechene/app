-- 282_faction_public_slug.sql
-- WHY : le lien de partage utilisait l'id (PK) de la Compagnie. Pour les héritages
-- legacy l'id est lisible (« faction-byzantine ») → fuite du nom d'origine, non
-- modifiable (PK référencée par des FK). On découple : un public_slug ALÉATOIRE et
-- STABLE, utilisé uniquement pour le lien d'invitation. ADDITIF.

ALTER TABLE public.factions ADD COLUMN IF NOT EXISTS public_slug text;

-- Slug aléatoire 10 hex, auto-généré pour toute nouvelle Compagnie (create_faction
-- n'a pas à le gérer : le DEFAULT s'en charge).
ALTER TABLE public.factions
  ALTER COLUMN public_slug SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 10);

-- Backfill des Compagnies existantes (dont les héritages legacy).
UPDATE public.factions
SET public_slug = substr(md5(random()::text || id || clock_timestamp()::text), 1, 10)
WHERE public_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS factions_public_slug_key ON public.factions(public_slug);

-- get_faction_detail : + publicSlug (pour construire le lien d'invitation).
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
    'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
