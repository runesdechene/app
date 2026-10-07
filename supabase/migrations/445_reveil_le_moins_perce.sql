-- WHY: Uriel, 07/10 : un ancien de la V1 avait déjà percé 13 des 15 énigmes éveillées — sa carte était
--      presque vide. Le réveil choisit d'abord l'énigme que le moins de joueurs ont percée (V1 comprise),
--      puis la plus ancienne du cycle : le neuf passe avant le connu, et une énigme ratée revient toujours.
-- BASE: _eveiller_enigmes — définition de la migration 440 (identique en live), seul l'ORDER BY change.
-- SCHEMA CHECKED (2026-10-07) : enigma_responses(enigma_id, user_id, correct), enigmes_eveillees(enigma_id, eveillee_le).

-- Le choix compte les joueurs distincts qui l'ont percée : un index rend ce compte immédiat.
CREATE INDEX IF NOT EXISTS enigma_responses_justes_par_enigme
  ON public.enigma_responses (enigma_id) WHERE correct;

CREATE OR REPLACE FUNCTION public._eveiller_enigmes()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t         record;
  v_enigme  integer;
  p         record;
  v_eveils  int := 0;
BEGIN
  FOR t IN SELECT id, cercles FROM enigma_themes WHERE active AND jsonb_array_length(cercles) > 0 LOOP
    SELECT e.id INTO v_enigme FROM public._enigmes_du_jeu(t.id) e
     WHERE NOT EXISTS (SELECT 1 FROM enigmes_eveillees w WHERE w.enigma_id = e.id AND w.effacee_le IS NULL)
     ORDER BY (SELECT count(DISTINCT r.user_id) FROM enigma_responses r WHERE r.enigma_id = e.id AND r.correct) ASC,
              (SELECT max(w.eveillee_le) FROM enigmes_eveillees w WHERE w.enigma_id = e.id) ASC NULLS FIRST,
              random()
     LIMIT 1;
    CONTINUE WHEN v_enigme IS NULL;
    SELECT * INTO p FROM public._point_dans_les_cercles(t.cercles);
    INSERT INTO enigmes_eveillees (enigma_id, theme, lat, lng) VALUES (v_enigme, t.id, p.lat, p.lng);
    UPDATE enigmes_eveillees SET effacee_le = now()
     WHERE id IN (SELECT id FROM enigmes_eveillees WHERE theme = t.id AND effacee_le IS NULL
                   ORDER BY eveillee_le DESC, id DESC OFFSET 7);
    v_eveils := v_eveils + 1;
  END LOOP;
  RETURN v_eveils;
END $$;
