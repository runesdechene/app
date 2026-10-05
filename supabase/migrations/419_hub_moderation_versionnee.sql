-- WHY: la modération du Hub (mod_update_place, mig 329) changeait le nom et le récit d'un lieu sans
--      version ni place_contributions : l'histoire du lieu (V2) mentait, la V1 et les pages SEO
--      gardaient l'ancien récit. Un nom ou un récit changé devient une version au nom du modérateur
--      (note « Modération »), précédée de la version d'origine si le lieu n'en a pas ; le récit
--      rejoint place_contributions, comme dans modifier_lieu (414). Le reste est inchangé.
-- SCHEMA CHECKED (05/10/2026) : versions_lieu(id, place_id, auteur, cree_le, nom, natures, epoque,
--      annee, recit, note, acces, quand, bon_a_savoir, bivouac_tolere) ; place_contributions ;
--      définitions live (pg_get_functiondef) de mod_update_place(text,text,text,boolean),
--      modifier_lieu (414), _etat_du_lieu(text), _caller_user_id().

CREATE OR REPLACE FUNCTION public.mod_update_place(p_place_id text, p_title text, p_text text, p_sensible boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_caller text := public._caller_user_id();
  -- 419 : le lieu avant et après, pour versionner ce que la modération change.
  v_avant record;
  v_apres record;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  SELECT * INTO v_avant FROM public._etat_du_lieu(p_place_id);

  UPDATE public.places SET
    title    = COALESCE(NULLIF(TRIM(p_title), ''), title),
    text     = COALESCE(p_text, text),
    sensible = COALESCE(p_sensible, sensible),
    updated_at = NOW()
  WHERE id = p_place_id;

  -- 419 : un nom ou un récit changé devient une version, comme dans modifier_lieu.
  SELECT * INTO v_apres FROM public._etat_du_lieu(p_place_id);
  IF v_apres.nom IS DISTINCT FROM v_avant.nom OR v_apres.recit IS DISTINCT FROM v_avant.recit THEN
    -- La version d'origine, inscrite à la première modification.
    IF NOT EXISTS (SELECT 1 FROM public.versions_lieu WHERE place_id = p_place_id) THEN
      INSERT INTO public.versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                                        acces, quand, bon_a_savoir, bivouac_tolere)
      SELECT p_place_id, p.author_id, p.created_at, v_avant.nom, v_avant.natures, v_avant.epoque,
             v_avant.annee, v_avant.recit, v_avant.acces, v_avant.quand, v_avant.bon_a_savoir,
             v_avant.bivouac_tolere
      FROM public.places p WHERE p.id = p_place_id;
    END IF;
    INSERT INTO public.versions_lieu (place_id, auteur, nom, natures, epoque, annee, recit, note,
                                      acces, quand, bon_a_savoir, bivouac_tolere)
    VALUES (p_place_id, v_caller, v_apres.nom, v_apres.natures, v_apres.epoque, v_apres.annee,
            v_apres.recit, 'Modération', v_apres.acces, v_apres.quand, v_apres.bon_a_savoir,
            v_apres.bivouac_tolere);
  END IF;
  -- Le récit reste lisible par la V1 et les pages SEO.
  IF v_apres.recit IS DISTINCT FROM v_avant.recit THEN
    UPDATE public.place_contributions SET content = v_apres.recit, user_id = v_caller, updated_at = now()
    WHERE place_id = p_place_id AND type = 'description';
    IF NOT FOUND THEN
      INSERT INTO public.place_contributions (place_id, user_id, type, content, created_at, updated_at)
      VALUES (p_place_id, v_caller, 'description', v_apres.recit, now(), now());
    END IF;
  END IF;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'update',
          jsonb_build_object('title', p_title, 'sensible', p_sensible));

  RETURN json_build_object('success', true);
END; $function$;
