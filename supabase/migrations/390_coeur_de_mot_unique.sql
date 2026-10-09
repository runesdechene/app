-- WHY: Uriel, 30/09 : « sur les commentaires, le like doit être mono like ». Sur un lieu, les
--      cœurs à volonté fêtent ; sur un mot du Carnet, le cœur dit « c'est utile » — un par
--      personne, qu'on peut retirer, pour que le compteur reste un vote honnête.
--   1. coeurs_mot : un cœur par personne et par mot (les rafales déjà données reviennent à un).
--   2. basculer_coeur_mot(p_id) : allume ou éteint mon cœur sur un mot ; rend le total et si
--      j'aime. L'auteur du mot est prévenu une seule fois par personne, même si le cœur est
--      éteint puis rallumé.
--   3. aimer_mot (389, à volonté) disparaît : elle n'a servi qu'à la V2, depuis cet après-midi.
-- SCHEMA CHECKED (30/09/2026) : coeurs_mot(contribution_id, user_id, nombre, premier_le,
--      dernier_le) (389) ; place_contributions(id, user_id, place_id, type) ;
--      notifications(recipient_id, type, data) ; notify(text, text, jsonb) ; _lieu_visible(text).
-- DROP vérifié à la main le 30/09 : aimer_mot(integer) n'est appelée que par
--      apps/web-v2/src/features/lieu/api/lieu.ts (remplacée ici) ; ni la V1, ni le Hub, ni les
--      edge functions, ni le thème Shopify.

UPDATE public.coeurs_mot SET nombre = 1 WHERE nombre > 1;
ALTER TABLE public.coeurs_mot ADD CONSTRAINT coeurs_mot_un_seul CHECK (nombre = 1);

DROP FUNCTION public.aimer_mot(integer);

CREATE OR REPLACE FUNCTION public.basculer_coeur_mot(p_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_lieu text;
  v_aime boolean;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT user_id, place_id INTO v_auteur, v_lieu FROM place_contributions WHERE id = p_id AND type = 'comment';
  IF NOT FOUND OR NOT public._lieu_visible(v_lieu) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne s’envoie pas de cœurs' USING ERRCODE = '22023';
  END IF;

  DELETE FROM coeurs_mot WHERE contribution_id = p_id AND user_id = v_moi;
  v_aime := NOT FOUND;
  IF v_aime THEN
    INSERT INTO coeurs_mot (contribution_id, user_id) VALUES (p_id, v_moi);
    -- Prévenir une seule fois par personne : éteindre puis rallumer n'envoie rien de plus.
    IF NOT EXISTS (SELECT 1 FROM notifications
                   WHERE recipient_id = v_auteur AND type = 'coeur_mot'
                     AND data->>'actorId' = v_moi AND data->>'contributionId' = p_id::text) THEN
      BEGIN
        SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
        PERFORM notify(v_auteur, 'coeur_mot', jsonb_build_object(
          'actorName', v_nom, 'actorId', v_moi, 'placeId', v_lieu, 'contributionId', p_id));
      EXCEPTION WHEN others THEN
        RAISE WARNING 'basculer_coeur_mot : notification en échec (%)', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN json_build_object(
    'coeurs', (SELECT count(*) FROM coeurs_mot WHERE contribution_id = p_id),
    'aime', v_aime);
END;
$function$;
REVOKE ALL ON FUNCTION public.basculer_coeur_mot(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.basculer_coeur_mot(integer) TO authenticated;
