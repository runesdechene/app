-- WHY: Uriel, 11/10 : deux énigmes par jour plutôt que trois — elles s'accumulent (7 en attente au plus).
-- BASE: _eveiller_enigmes — définition de la migration 482 (vérifiée en live le 11/10), seul le LIMIT change.
-- SCHEMA CHECKED (2026-10-11) : ceux de la 482, inchangés.
CREATE OR REPLACE FUNCTION public._eveiller_enigmes()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t         record;
  v_enigme  integer;
  p         record;
  v_eveils  int := 0;
BEGIN
  FOR t IN SELECT c.id, c.cercles FROM enigma_themes c
            WHERE c.active AND jsonb_array_length(c.cercles) > 0
            ORDER BY (SELECT max(w.eveillee_le) FROM enigmes_eveillees w WHERE w.theme = c.id) ASC NULLS FIRST,
                     c.id
            LIMIT 2 LOOP
    SELECT e.id INTO v_enigme FROM public._enigmes_du_jeu(t.id) e
     WHERE NOT EXISTS (SELECT 1 FROM enigmes_eveillees w WHERE w.enigma_id = e.id AND w.effacee_le IS NULL)
     ORDER BY (SELECT count(DISTINCT r.user_id) FROM enigma_responses r WHERE r.enigma_id = e.id AND r.correct) ASC,
              (SELECT max(w.eveillee_le) FROM enigmes_eveillees w WHERE w.enigma_id = e.id) ASC NULLS FIRST,
              random()
     LIMIT 1;
    CONTINUE WHEN v_enigme IS NULL;
    SELECT * INTO p FROM public._point_dans_les_cercles(t.cercles);
    INSERT INTO enigmes_eveillees (enigma_id, theme, lat, lng) VALUES (v_enigme, t.id, p.lat, p.lng);
    v_eveils := v_eveils + 1;
  END LOOP;
  UPDATE enigmes_eveillees SET effacee_le = now()
   WHERE id IN (SELECT id FROM enigmes_eveillees WHERE effacee_le IS NULL
                 ORDER BY eveillee_le DESC, id DESC OFFSET 7);
  RETURN v_eveils;
END $$;
