-- WHY: Uriel, 24/10 : le sceau d'une énigme prend la couleur de sa culture sur la carte (vert pour les
--      Celtes, bleu pour les Nordiques…). La place trahit déjà la culture : la couleur ne révèle rien
--      de plus. `enigmes_en_attente` rend donc aussi `couleur` (enigma_themes.color). Une clé ajoutée :
--      l'appli déjà en ligne l'ignore.
-- SCHEMA CHECKED (24/10/2026, live) : enigma_themes.color text (déjà joint par `t`) ; définition
--      live de enigmes_en_attente copiée entière, seule la ligne json_build_object change.

CREATE OR REPLACE FUNCTION public.enigmes_en_attente()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object('id', w.id, 'lat', w.lat, 'lng', w.lng, 'couleur', t.color) ORDER BY w.lat, w.lng), '[]'::json)
    FROM enigmes_eveillees w JOIN enigma_themes t ON t.id = w.theme AND t.active
   WHERE w.effacee_le IS NULL
     AND NOT EXISTS (SELECT 1 FROM enigma_responses r
                      WHERE r.user_id = v_moi AND (r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.correct))));
END $function$;
