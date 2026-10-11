-- WHY: Uriel, 11/10 : plus de quatre énigmes par jour sur la carte, on avait dit une par jour. Le réveil
--      en posait une par culture (cinq chaque matin, jusqu'à 35 en attente). Désormais trois par jour,
--      chaque culture à son tour (celles réveillées le moins récemment d'abord), et 7 en attente au plus,
--      toutes cultures confondues : au-delà, la plus ancienne s'efface (le surplus du jour part au
--      prochain réveil).
-- BASE: _eveiller_enigmes — définition de la migration 445 (seule redéfinition depuis 440). Changent :
--      la boucle (trois cultures au lieu de toutes) et le plafond (global au lieu de par culture).
-- SCHEMA CHECKED (2026-10-11) : enigma_themes(id, cercles, active), enigmes_eveillees(id, enigma_id,
--   theme, lat, lng, eveillee_le, effacee_le), enigma_responses(enigma_id, user_id, correct).

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
            LIMIT 3 LOOP
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
