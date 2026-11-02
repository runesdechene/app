-- 582 — Le Codex après sa relecture : la synchro, le tirage, la numérotation, l'ordre des collections
--
-- WHY : relecture finale du Codex (02/11/2026).
--   - synchroniser_fragments : `edition` est un texte libre dans Shopify, la colonne a une contrainte
--     (577) ; une seule valeur hors liste faisait échouer toute la synchro (bouton du Hub, et la
--     resynchro après « Enregistrer dans Shopify »). Une valeur inconnue devient vide.
--   - tirer_anecdote : le verrou du joueur se prend avant le tirage, plus seulement pour creuser :
--     deux appels parallèles gagnaient chacun une gratuite, ou finissaient en erreur 23505 / NOT NULL.
--   - _numeroter_porteur : FOR NO KEY UPDATE suffit à sérialiser max+1, sans bloquer les FK.
--   - mon_codex : « Hors collection » (héritage vide) sortait en premier, et en double avec un
--     héritage NULL.
--   Chaque fonction repart de sa définition live du 02/11, copiée entière.
--
-- SCHEMA CHECKED (02/11/2026, live) : title_fragments(heritage, edition CHECK limitee|retire|exclusif) ;
--   users(id, energy_points).

CREATE OR REPLACE FUNCTION public.synchroniser_fragments(p_illustrations jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ill jsonb;
  v_n integer;
  v_total integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  FOR v_ill IN SELECT * FROM jsonb_array_elements(p_illustrations) LOOP
    UPDATE title_fragments f SET
      shopify_handle = v_ill->>'handle',
      shopify_collection = v_ill->>'collection',
      name = coalesce(nullif(v_ill->>'nom', ''), f.name),
      resume = v_ill->>'resume',
      histoire = v_ill->>'histoire',
      illustration_url = v_ill->>'illustration_url',
      illustration_sombre_url = v_ill->>'illustration_sombre_url',
      fond_url = v_ill->>'fond_url',
      audio_url = v_ill->>'audio_url',
      artiste = v_ill->>'artiste',
      narrateur = v_ill->>'narrateur',
      heritage = v_ill->>'heritage',
      artiste_photo_url = nullif(v_ill->>'artiste_photo_url', ''),
      mot_artiste = nullif(v_ill->>'mot_artiste', ''),
      -- 582 : le champ Shopify est libre ; une valeur inconnue (« Limitée ») passe à vide au lieu
      -- de faire échouer toute la synchro sur la contrainte.
      edition = CASE WHEN v_ill->>'edition' IN ('limitee', 'retire', 'exclusif') THEN v_ill->>'edition' END,
      edition_precision = nullif(v_ill->>'edition_precision', ''),
      synchronise_le = now()
    WHERE f.shopify_handle = v_ill->>'handle'
       OR (f.shopify_handle IS NULL AND v_ill->>'collection' <> ''
           AND lower(f.link_url) LIKE '%/collections/' || lower(v_ill->>'collection'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END $function$;

CREATE OR REPLACE FUNCTION public.tirer_anecdote(p_fragment integer, p_creuser boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
  v_aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_premiere boolean;
  v_rarete text;
  v_id bigint;
  v_texte text;
  v_raison text;
  v_points numeric;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour garder tes anecdotes', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment AND visible) THEN
    PERFORM _refus('Fragment introuvable', 'fragment');
  END IF;

  -- 582 : un tirage à la fois par joueur. Deux appels rapprochés ne gagnent pas deux gratuites du
  -- jour, ni la même dernière anecdote d'une rareté. NO KEY : l'énergie n'est pas une clé.
  PERFORM 1 FROM users WHERE id = v_moi FOR NO KEY UPDATE;

  -- Le premier scan de ce motif par moi : l'appli joue la découverte.
  v_premiere := (SELECT count(*) FROM scans WHERE user_id = v_moi AND fragment_id = p_fragment) <= 1;

  -- La rareté d'abord, pondérée parmi celles qui restent ; puis une anecdote de cette rareté.
  SELECT r.rarete INTO v_rarete
  FROM (
    SELECT DISTINCT a.rarete,
           CASE a.rarete WHEN 'commune' THEN 60 WHEN 'peu_commune' THEN 30 ELSE 10 END AS poids
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
  ) r
  ORDER BY -ln(1 - random()) / r.poids  -- tirage pondéré (méthode exponentielle)
  LIMIT 1;

  IF v_rarete IS NULL THEN
    v_raison := 'toutes_trouvees';
  ELSIF NOT p_creuser THEN
    IF EXISTS (
      SELECT 1 FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_fragment
        AND (t.quand AT TIME ZONE 'Europe/Paris')::date = v_aujourdhui
    ) THEN
      v_raison := 'deja_aujourdhui';
    ELSE
      v_raison := 'gratuite';
    END IF;
  ELSE
    PERFORM public.get_user_energy(v_moi); -- la recharge d'abord
    SELECT energy_points INTO v_points FROM users WHERE id = v_moi;
    IF v_points < 2 THEN
      RAISE EXCEPTION 'Pas assez d''énergie' USING ERRCODE = 'RDC01';
    END IF;
    UPDATE users SET energy_points = energy_points - 2 WHERE id = v_moi;
    v_raison := 'creusee';
  END IF;

  IF v_raison IN ('gratuite', 'creusee') THEN
    SELECT a.id, a.texte INTO v_id, v_texte
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = v_rarete
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
    ORDER BY random()
    LIMIT 1;
    INSERT INTO anecdotes_trouvees (user_id, anecdote_id) VALUES (v_moi, v_id);
  END IF;

  RETURN jsonb_build_object(
    'anecdote', CASE WHEN v_id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', v_id, 'texte', v_texte, 'rarete', v_rarete) END,
    'raison', v_raison,
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'premiereDecouverte', v_premiere,
    -- 581 : « 2 sur 5 de La Garde d'Acier » — les Fragments de sa collection que je connais.
    'collection', (SELECT CASE WHEN nullif(f.heritage, '') IS NULL THEN NULL ELSE jsonb_build_object(
        'nom', f.heritage,
        'connus', (SELECT count(*) FROM title_fragments g WHERE g.visible AND g.heritage = f.heritage
                     AND (EXISTS (SELECT 1 FROM scans s WHERE s.user_id = v_moi AND s.fragment_id = g.id)
                          OR EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = v_moi AND uf.fragment_id = g.id))),
        'total', (SELECT count(*) FROM title_fragments g WHERE g.visible AND g.heritage = f.heritage)) END
      FROM title_fragments f WHERE f.id = p_fragment)
  );
END $function$;

CREATE OR REPLACE FUNCTION public._numeroter_porteur()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 582 : NO KEY UPDATE sérialise les numéros sans bloquer les clés étrangères vers le motif
  -- (un scan noté pendant la liaison d'un achat).
  PERFORM 1 FROM title_fragments WHERE id = NEW.fragment_id FOR NO KEY UPDATE;
  SELECT coalesce(max(numero), 0) + 1 INTO NEW.numero
  FROM user_fragments WHERE fragment_id = NEW.fragment_id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.mon_codex()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
  v_resultat jsonb;
  v_genre text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;
  SELECT COALESCE(title_gender, 'm') INTO v_genre FROM users WHERE id = v_moi;

  WITH etats AS (
    -- 582 : un héritage vide est « hors collection », comme un héritage absent : un seul groupe, en dernier.
    SELECT f.id, f.name, f.illustration_url, nullif(f.heritage, '') AS heritage, f.edition, f.edition_precision,
           f.created_at > now() - interval '60 days' AS nouveau,
           uf.numero,
           coalesce(s.scans, 0) AS scans,
           CASE WHEN uf.user_id IS NOT NULL THEN 'porte'
                WHEN s.scans IS NOT NULL THEN 'scanne'
                ELSE 'inconnu' END AS etat
    FROM title_fragments f
    LEFT JOIN user_fragments uf ON uf.fragment_id = f.id AND uf.user_id = v_moi
    LEFT JOIN _mes_scans(v_moi) s ON s.fragment_id = f.id
    WHERE f.visible
  ),
  collections AS (
    SELECT e.heritage,
           count(*) FILTER (WHERE e.etat = 'porte') AS portes,
           count(*) AS total,
           jsonb_agg(jsonb_build_object(
             'id', e.id, 'nom', e.name, 'illustration', e.illustration_url, 'etat', e.etat,
             'scans', e.scans, 'numero', e.numero, 'nouveau', e.nouveau,
             'edition', e.edition, 'editionPrecision', e.edition_precision
           ) ORDER BY e.name) AS fragments
    FROM etats e
    GROUP BY e.heritage
  )
  SELECT jsonb_build_object(
    'totaux', (SELECT jsonb_build_object(
                 'portes', count(*) FILTER (WHERE etat = 'porte'),
                 'scannes', count(*) FILTER (WHERE etat = 'scanne'),
                 'inconnus', count(*) FILTER (WHERE etat = 'inconnu'),
                 'total', count(*)) FROM etats),
    'collections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'heritage', c.heritage, 'couleur', cc.couleur, 'icone', cc.icone_url,
               'titre', (SELECT _nom_titre(t, v_genre) FROM titles t
                         WHERE t.condition->>'stat' = 'collection' AND t.condition->>'heritage' = c.heritage
                         LIMIT 1),
               'portes', c.portes, 'total', c.total, 'fragments', c.fragments
             ) ORDER BY c.heritage NULLS LAST)
      FROM collections c LEFT JOIN codex_collections cc ON cc.heritage = c.heritage), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END $function$;
