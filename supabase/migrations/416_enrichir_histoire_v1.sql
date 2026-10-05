-- WHY: l'histoire de la V1 entre dans versions_lieu (spec enrichir, « voir les ajouts de chacun ») : chaque
--      révision de récit (place_description_revisions) et chaque rubrique V1 (place_contributions
--      accessibility / season / warning) devient une version, avec son auteur et sa date. L'état final
--      devient la fiche : les 238 lieux où la V2 lisait un autre récit que la V1 prennent le plus récent,
--      et le texte V2 qu'aucune révision ne contenait devient la version d'origine (rien ne se perd).
--      Le nom, les natures et l'époque des versions reprises sont ceux d'aujourd'hui (la V1 ne les
--      historisait pas).
--      Exceptions relues par Uriel (05/10) : la mig 197 a fait d'un carnet (une note) la description V1 de
--      certains lieux. « fusionner » : le récit de la fiche, puis la note en paragraphe ajouté ; « garder » :
--      le récit de la fiche, la note n'est pas reprise.
-- SCHEMA CHECKED (05/10/2026) : place_description_revisions(place_id, content, edited_by, created_at) ;
--      place_contributions(place_id, user_id, type, content, created_at, updated_at), une ligne par lieu
--      et par type ; versions_lieu et _etat_du_lieu (mig 414).
DO $m$
DECLARE
  fusionner text[] := ARRAY(SELECT id FROM places WHERE title IN (
    'Château de la Tour d''Aigues', 'Château de Val Joanis', 'Cité de Carcassonne', 'Tour de l''horloge'));
  garder text[] := ARRAY(SELECT id FROM places WHERE title IN ('Abbaye de Fontaine-Guérard'));
  l record;
  ev record;
  etat record;
  v_valeur text;
  v_recit text;
  v_acces text;
  v_quand text;
  v_bon text;
BEGIN
  FOR l IN
    SELECT p.* FROM places p
    WHERE NOT EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = p.id)
      AND (EXISTS (SELECT 1 FROM place_description_revisions d WHERE d.place_id = p.id)
           OR EXISTS (SELECT 1 FROM place_contributions c WHERE c.place_id = p.id
                      AND c.type IN ('accessibility', 'season', 'warning') AND NULLIF(btrim(c.content), '') IS NOT NULL))
  LOOP
    SELECT * INTO etat FROM public._etat_du_lieu(l.id);
    -- L'origine : le récit de la fiche pour les exceptions ; sinon la révision posée à l'ajout ; sinon
    -- le texte de la fiche s'il n'est dans aucune révision (écrit avant l'historique) ; sinon la
    -- première révision.
    v_recit := CASE WHEN l.id = ANY (fusionner || garder) THEN COALESCE(l.text, '') ELSE COALESCE(
      (SELECT d.content FROM place_description_revisions d
       WHERE d.place_id = l.id AND d.created_at < l.created_at + interval '10 minutes'
       ORDER BY d.created_at LIMIT 1),
      (SELECT l.text WHERE NULLIF(btrim(l.text), '') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM place_description_revisions d WHERE d.place_id = l.id AND d.content = l.text)),
      (SELECT d.content FROM place_description_revisions d WHERE d.place_id = l.id ORDER BY d.created_at LIMIT 1),
      '') END;
    v_acces := NULL; v_quand := NULL; v_bon := NULL;
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere)
    VALUES (l.id, l.author_id, l.created_at, etat.nom, etat.natures, etat.epoque, etat.annee, v_recit,
            NULL, NULL, NULL, false);

    FOR ev IN
      SELECT d.created_at AS quand, d.edited_by AS qui, 'recit' AS champ, d.content AS valeur
      FROM place_description_revisions d WHERE d.place_id = l.id
      UNION ALL
      SELECT COALESCE(c.updated_at, c.created_at), c.user_id,
             CASE c.type WHEN 'accessibility' THEN 'acces' WHEN 'season' THEN 'quand' ELSE 'bon_a_savoir' END,
             NULLIF(btrim(c.content), '')
      FROM place_contributions c WHERE c.place_id = l.id AND c.type IN ('accessibility', 'season', 'warning')
      ORDER BY 1
    LOOP
      CONTINUE WHEN ev.champ = 'recit' AND l.id = ANY (garder);
      v_valeur := CASE WHEN ev.champ = 'recit' AND l.id = ANY (fusionner)
                       THEN l.text || E'\n\n' || ev.valeur ELSE ev.valeur END;
      -- Ce qui ne change rien (la révision-graine, déjà l'origine) ne fait pas de version.
      CONTINUE WHEN (ev.champ = 'recit' AND v_valeur IS NOT DISTINCT FROM v_recit)
                 OR (ev.champ = 'acces' AND v_valeur IS NOT DISTINCT FROM v_acces)
                 OR (ev.champ = 'quand' AND v_valeur IS NOT DISTINCT FROM v_quand)
                 OR (ev.champ = 'bon_a_savoir' AND v_valeur IS NOT DISTINCT FROM v_bon);
      IF ev.champ = 'recit' THEN v_recit := COALESCE(v_valeur, ''); END IF;
      IF ev.champ = 'acces' THEN v_acces := v_valeur; END IF;
      IF ev.champ = 'quand' THEN v_quand := v_valeur; END IF;
      IF ev.champ = 'bon_a_savoir' THEN v_bon := v_valeur; END IF;
      INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                                 acces, quand, bon_a_savoir, bivouac_tolere)
      VALUES (l.id, ev.qui, greatest(ev.quand, l.created_at + interval '1 second'), etat.nom, etat.natures,
              etat.epoque, etat.annee, v_recit, v_acces, v_quand, v_bon, false);
    END LOOP;

    -- La reprise n'est pas une modification : updated_at ne bouge pas.
    UPDATE places SET text = v_recit, acces = v_acces, quand = v_quand, bon_a_savoir = v_bon
    WHERE id = l.id;
    -- La V1 et les pages SEO lisent la même chose que la fiche.
    UPDATE place_contributions SET content = v_recit
    WHERE place_id = l.id AND type = 'description' AND content IS DISTINCT FROM v_recit;
  END LOOP;
END $m$;
