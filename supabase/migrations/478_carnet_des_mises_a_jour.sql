-- WHY: le carnet des mises à jour (spec docs/superpowers/specs/2026-10-11-carnet-des-mises-a-jour-design.md).
--      Uriel, 11/10 : « même fil de commentaires que sur un lieu, exactement le même, et les cœurs à
--      volonté aussi. Tout pareil. » Chaque note de « Nouveautés » reçoit donc les cœurs à volonté
--      d'un lieu (384) et, dessous, le Carnet de passage (389-390) : des mots, un niveau de réponses,
--      quatre photos au plus, un cœur par personne sur un mot. Trois tables de même forme que celles
--      du lieu, sans les mêler à place_contributions (qui exige un lieu).
--   1. mots_mise_a_jour, coeurs_mot_mise_a_jour, coeurs_mise_a_jour : RLS active, aucune policy —
--      tout passe par les RPC ci-dessous.
--   2. _mot_mise_a_jour(id) : un mot, comme _mot (389) ; « venu » vaut toujours faux (pas de lieu).
--   3. carnet_de_mise_a_jour / ecrire_sous_mise_a_jour / basculer_coeur_mot_mise_a_jour /
--      effacer_mot_mise_a_jour / aimer_mise_a_jour / coeurs_de_mise_a_jour : copiées des définitions
--      live de carnet_du_lieu, ecrire_au_carnet, basculer_coeur_mot, effacer_mot, aimer_lieu,
--      coeurs_du_lieu (lues le 11/10), le lieu remplacé par la note. Retiré : la visibilité du lieu,
--      la condition « a découvert le lieu » (tout membre écrit sous une note), l'activity_log du lieu,
--      les contributeurs de la description.
--   4. Les notifications : quatre types propres aux notes, la cloche ne pouvant mener à une note par
--      placeId — mot_mise_a_jour (chaque mot prévient tous les admins sauf l'auteur et sauf l'admin
--      déjà prévenu de la réponse ; Uriel, 11/10 : cloche et push), reponse_mise_a_jour (à qui l'on
--      répond), coeur_mot_mise_a_jour (l'auteur du mot, une fois par personne),
--      coeur_mise_a_jour (l'auteur de la note, au premier cœur d'une personne).
--   5. mises_a_jour_publiees (live copiée entière) : en plus coeurs, miens, mots, aMoi.
--   6. _notification_v2 (live copiée entière) : la cloche de la V2 montre les quatre types.
--   7. mes_notifications (live copiée entière) : pour ces quatre types, l'extrait est le titre de la note.
-- SCHEMA CHECKED (11/10/2026, information_schema et définitions live) :
--   mises_a_jour(id bigint, titre text, texte text, publiee_le timestamptz, par text, image text,
--     version text) ; coeurs_mot(contribution_id int, user_id varchar, nombre int, premier_le,
--     dernier_le timestamptz) ; coeurs_lieu(place_id varchar, user_id varchar, nombre int, premier_le,
--     dernier_le timestamptz) ; notifications(id int, recipient_id text, type text, data jsonb, read
--     boolean, created_at timestamptz) ; users(id varchar, role, display_name, first_name, avatar_url) ;
--   storage.objects(bucket_id, name) ; places(id, title) ; _nouveautes_lues_jusqua() ;
--   notify(text, text, jsonb) ; _is_staff() ;
--   user_public_name(text, text, text).

CREATE TABLE public.mots_mise_a_jour (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mise_a_jour_id bigint NOT NULL REFERENCES public.mises_a_jour(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  texte text NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_id bigint REFERENCES public.mots_mise_a_jour(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mots_mise_a_jour_note ON public.mots_mise_a_jour (mise_a_jour_id, created_at);
CREATE INDEX mots_mise_a_jour_parent ON public.mots_mise_a_jour (parent_id);
CREATE INDEX mots_mise_a_jour_auteur ON public.mots_mise_a_jour (user_id, created_at);

CREATE TABLE public.coeurs_mot_mise_a_jour (
  mot_id bigint NOT NULL REFERENCES public.mots_mise_a_jour(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre int NOT NULL DEFAULT 1 CHECK (nombre > 0),
  premier_le timestamptz NOT NULL DEFAULT now(),
  dernier_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mot_id, user_id)
);

CREATE TABLE public.coeurs_mise_a_jour (
  mise_a_jour_id bigint NOT NULL REFERENCES public.mises_a_jour(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre int NOT NULL DEFAULT 1 CHECK (nombre > 0),
  premier_le timestamptz NOT NULL DEFAULT now(),
  dernier_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mise_a_jour_id, user_id)
);

ALTER TABLE public.mots_mise_a_jour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coeurs_mot_mise_a_jour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coeurs_mise_a_jour ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mots_mise_a_jour, public.coeurs_mot_mise_a_jour, public.coeurs_mise_a_jour
  FROM PUBLIC, anon, authenticated;

-- 2. Un mot (copie de _mot, 389).
CREATE OR REPLACE FUNCTION public._mot_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', c.id,
    'quand', c.created_at,
    'texte', c.texte,
    'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                             'avatar', u.avatar_url),
    'venu', false,
    'photos', COALESCE((SELECT json_agg(COALESCE(i->>'url', i #>> '{}'))
                        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.images) = 'array'
                                                       THEN c.images ELSE '[]'::jsonb END) i), '[]'::json),
    'coeurs', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot_mise_a_jour WHERE mot_id = c.id),
    'miens', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot_mise_a_jour
              WHERE mot_id = c.id AND user_id = (auth.uid())::text),
    'aMoi', c.user_id = (auth.uid())::text)
  FROM mots_mise_a_jour c JOIN users u ON u.id = c.user_id
  WHERE c.id = p_id;
$function$;

-- 3a. Le carnet d'une note (copie de carnet_du_lieu).
CREATE OR REPLACE FUNCTION public.carnet_de_mise_a_jour(p_id bigint, p_limite integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM mises_a_jour WHERE id = p_id) THEN NULL ELSE json_build_object(
    'total', (SELECT count(*) FROM mots_mise_a_jour WHERE mise_a_jour_id = p_id),
    'mots', COALESCE((
      SELECT json_agg(m.mot ORDER BY m.created_at DESC)
      FROM (
        SELECT c.created_at,
               (public._mot_mise_a_jour(c.id)::jsonb || jsonb_build_object('reponses', COALESCE((
                  SELECT jsonb_agg(public._mot_mise_a_jour(r.id)::jsonb ORDER BY r.created_at)
                  FROM mots_mise_a_jour r WHERE r.parent_id = c.id), '[]'::jsonb)))::json AS mot
        FROM mots_mise_a_jour c
        WHERE c.mise_a_jour_id = p_id AND c.parent_id IS NULL
        ORDER BY c.created_at DESC
        LIMIT least(COALESCE(p_limite, 100), 100)
      ) m), '[]'::json)
  ) END;
$function$;

-- 3b. Écrire sous une note (copie de ecrire_au_carnet).
CREATE OR REPLACE FUNCTION public.ecrire_sous_mise_a_jour(p_id bigint, p_texte text, p_images jsonb DEFAULT '[]'::jsonb, p_parent bigint DEFAULT NULL::bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_texte text := btrim(p_texte);
  v_images jsonb := COALESCE(p_images, '[]'::jsonb);
  v_titre text;
  v_parent bigint := p_parent;
  v_parent_de_parent bigint;
  v_auteur_parent text;
  v_dossier text;
  v_fichier text;
  v_image jsonb;
  v_adresses jsonb := '[]'::jsonb;
  v_id bigint;
  v_nom text;
  v_admin text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT titre INTO v_titre FROM mises_a_jour WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Un mot de 1 à 2000 signes' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_images) <> 'array' OR jsonb_array_length(v_images) > 4 THEN
    RAISE EXCEPTION 'Quatre photos au plus' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM mots_mise_a_jour
      WHERE user_id = v_moi AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Trente mots aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  -- Une réponse à une réponse va sous le mot d'origine : un seul niveau.
  IF v_parent IS NOT NULL THEN
    SELECT parent_id, user_id INTO v_parent_de_parent, v_auteur_parent FROM mots_mise_a_jour
    WHERE id = v_parent AND mise_a_jour_id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ce mot n’existe plus' USING ERRCODE = 'P0002';
    END IF;
    IF v_parent_de_parent IS NOT NULL THEN
      v_parent := v_parent_de_parent;
    END IF;
  END IF;

  -- Les photos : les mêmes contrôles qu'à l'ajout d'un lieu (381), dans le même dossier.
  v_dossier := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/'
               || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(v_images) LOOP
    v_fichier := substr(coalesce(v_image->>'url', ''), length(v_dossier) + 1);
    IF left(coalesce(v_image->>'url', ''), length(v_dossier)) <> v_dossier
       OR v_fichier !~ '^[A-Za-z0-9-]+\.webp$' THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o
                   WHERE o.bucket_id = 'place-images' AND o.name = 'places/' || v_moi || '/' || v_fichier) THEN
      RAISE EXCEPTION 'Photo introuvable' USING ERRCODE = '22023';
    END IF;
    v_adresses := v_adresses || to_jsonb(v_dossier || v_fichier);
  END LOOP;

  INSERT INTO mots_mise_a_jour (mise_a_jour_id, user_id, texte, images, parent_id)
  VALUES (p_id, v_moi, v_texte, v_adresses, v_parent)
  RETURNING id INTO v_id;

  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;

  -- Celui à qui l'on répond, puis les admins ; un échec ici n'empêche pas le mot de partir.
  BEGIN
    IF v_auteur_parent IS NOT NULL AND v_auteur_parent <> v_moi THEN
      PERFORM notify(v_auteur_parent, 'reponse_mise_a_jour', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'titre', v_titre, 'miseAJourId', p_id, 'motId', v_id));
    END IF;
    FOR v_admin IN
      SELECT u.id FROM users u
      WHERE u.role::text = 'admin' AND u.id <> v_moi AND u.id IS DISTINCT FROM v_auteur_parent
    LOOP
      PERFORM notify(v_admin, 'mot_mise_a_jour', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'titre', v_titre, 'miseAJourId', p_id, 'motId', v_id,
        'extrait', left(v_texte, 120)));
    END LOOP;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'ecrire_sous_mise_a_jour : notification en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('id', v_id);
END;
$function$;

-- 3c. Un cœur par personne sur un mot (copie de basculer_coeur_mot, 390).
CREATE OR REPLACE FUNCTION public.basculer_coeur_mot_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_note bigint;
  v_aime boolean;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT user_id, mise_a_jour_id INTO v_auteur, v_note FROM mots_mise_a_jour WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne s’envoie pas de cœurs' USING ERRCODE = '22023';
  END IF;

  DELETE FROM coeurs_mot_mise_a_jour WHERE mot_id = p_id AND user_id = v_moi;
  v_aime := NOT FOUND;
  IF v_aime THEN
    INSERT INTO coeurs_mot_mise_a_jour (mot_id, user_id) VALUES (p_id, v_moi);
    -- Prévenir une seule fois par personne : éteindre puis rallumer n'envoie rien de plus.
    IF NOT EXISTS (SELECT 1 FROM notifications
                   WHERE recipient_id = v_auteur AND type = 'coeur_mot_mise_a_jour'
                     AND data->>'actorId' = v_moi AND data->>'motId' = p_id::text) THEN
      BEGIN
        SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
        PERFORM notify(v_auteur, 'coeur_mot_mise_a_jour', jsonb_build_object(
          'actorName', v_nom, 'actorId', v_moi, 'miseAJourId', v_note, 'motId', p_id,
          'titre', (SELECT titre FROM mises_a_jour WHERE id = v_note)));
      EXCEPTION WHEN others THEN
        RAISE WARNING 'basculer_coeur_mot_mise_a_jour : notification en échec (%)', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN json_build_object(
    'coeurs', (SELECT count(*) FROM coeurs_mot_mise_a_jour WHERE mot_id = p_id),
    'aime', v_aime);
END;
$function$;

-- 3d. Effacer un mot (copie de effacer_mot) : son auteur ou l'équipe ; ses réponses partent avec lui.
CREATE OR REPLACE FUNCTION public.effacer_mot_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT user_id INTO v_auteur FROM mots_mise_a_jour WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur <> v_moi AND NOT public._is_staff() THEN
    RAISE EXCEPTION 'Seul son auteur peut effacer ce mot' USING ERRCODE = '42501';
  END IF;
  DELETE FROM mots_mise_a_jour WHERE id = p_id;
  RETURN json_build_object('ok', true);
END;
$function$;

-- 3e. Des cœurs à volonté sur une note (copie de aimer_lieu).
CREATE OR REPLACE FUNCTION public.aimer_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_titre text;
  v_nombre int;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT par, titre INTO v_auteur, v_titre FROM mises_a_jour WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne s’envoie pas de cœurs' USING ERRCODE = '22023';
  END IF;

  INSERT INTO coeurs_mise_a_jour (mise_a_jour_id, user_id) VALUES (p_id, v_moi)
  ON CONFLICT (mise_a_jour_id, user_id)
    DO UPDATE SET nombre = coeurs_mise_a_jour.nombre + 1, dernier_le = now()
  RETURNING nombre INTO v_nombre;

  -- Le premier cœur de quelqu'un prévient l'auteur de la note ; les suivants, non.
  IF v_nombre = 1 AND v_auteur IS NOT NULL THEN
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      PERFORM notify(v_auteur, 'coeur_mise_a_jour', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'titre', v_titre, 'miseAJourId', p_id));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'aimer_mise_a_jour : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object(
    'total', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mise_a_jour WHERE mise_a_jour_id = p_id),
    'miens', v_nombre);
END;
$function$;

-- 3f. Les cœurs d'une note, et qui (copie de coeurs_du_lieu).
CREATE OR REPLACE FUNCTION public.coeurs_de_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM mises_a_jour WHERE id = p_id) THEN NULL ELSE json_build_object(
    'total', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mise_a_jour WHERE mise_a_jour_id = p_id),
    'miens', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mise_a_jour
              WHERE mise_a_jour_id = p_id AND user_id = (auth.uid())::text),
    'gens', (SELECT COALESCE(json_agg(json_build_object(
                'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                'avatar', u.avatar_url, 'nombre', c.nombre)
              ORDER BY c.nombre DESC, c.dernier_le DESC), '[]'::json)
             FROM (SELECT * FROM coeurs_mise_a_jour WHERE mise_a_jour_id = p_id
                   ORDER BY nombre DESC, dernier_le DESC LIMIT 100) c
             JOIN users u ON u.id = c.user_id)
  ) END;
$function$;

-- 5. La liste des notes (live copiée entière) : en plus ses cœurs, les miens, ses mots, si elle est à moi.
CREATE OR REPLACE FUNCTION public.mises_a_jour_publiees()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', id, 'titre', titre, 'texte', texte, 'quand', publiee_le,
      'image', image, 'version', version,
      'coeurs', (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_mise_a_jour c WHERE c.mise_a_jour_id = m.id),
      'miens', (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_mise_a_jour c
                WHERE c.mise_a_jour_id = m.id AND c.user_id = (auth.uid())::text),
      'mots', (SELECT count(*) FROM mots_mise_a_jour w WHERE w.mise_a_jour_id = m.id),
      'aMoi', m.par IS NOT DISTINCT FROM (auth.uid())::text)
    ORDER BY publiee_le DESC), '[]'::json)
  FROM mises_a_jour m;
$function$;

-- 6. La cloche de la V2 (live copiée entière) : les quatre types des notes.
CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot', 'demande_compagnie', 'demande_acceptee',
    'visite', 'revendication_reprise', 'nouveau_membre', 'enigme_acceptee',
    'mot_mise_a_jour', 'reponse_mise_a_jour', 'coeur_mot_mise_a_jour', 'coeur_mise_a_jour']);
$function$;

-- 7. La cloche (live copiée entière) : sous une mise à jour, le titre de la note tient lieu d'extrait.
CREATE OR REPLACE FUNCTION public.mes_notifications()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lignes AS (
    SELECT n.created_at AS quand, json_build_object(
      'id', n.id,
      'type', n.type,
      'quand', n.created_at,
      'lu', n.read,
      'qui', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
               'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
               'avatar', u.avatar_url) END,
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('id', p.id, 'nom', p.title) END,
      'nombre', COALESCE(n.data->>'viewCount', n.data->>'explorerCount', n.data->>'likeCount',
                         n.data->>'visitorsToday')::int,
      -- 478 : sous une mise à jour, son titre tient lieu d'extrait.
      'extrait', CASE WHEN n.type LIKE '%mise_a_jour' THEN n.data->>'titre' ELSE n.data->>'extrait' END,
      'evenement', NULLIF(split_part(COALESCE(n.data->>'evenement', ''), ':', 1), ''),
      -- 421 : la Compagnie d'une demande.
      'compagnie', CASE WHEN n.data ? 'compagnieId' THEN
        json_build_object('id', n.data->>'compagnieId', 'nom', n.data->>'compagnieNom') END) AS ligne
    FROM (SELECT * FROM notifications
          WHERE recipient_id = (auth.uid())::text AND public._notification_v2(type)
          ORDER BY created_at DESC LIMIT 50) n
    LEFT JOIN users u ON u.id = n.data->>'actorId'
    LEFT JOIN places p ON p.id = n.data->>'placeId'
    UNION ALL
    -- Les mises à jour : le titre tient lieu d'extrait.
    SELECT m.publiee_le, json_build_object(
      'id', m.id,
      'type', 'mise_a_jour',
      'quand', m.publiee_le,
      'lu', COALESCE(m.publiee_le <= public._nouveautes_lues_jusqua(), true),
      'qui', NULL, 'lieu', NULL, 'nombre', NULL,
      'extrait', m.titre,
      'evenement', NULL,
      'compagnie', NULL)
    FROM mises_a_jour m
  )
  SELECT COALESCE(json_agg(l.ligne ORDER BY l.quand DESC), '[]'::json)
  FROM (SELECT * FROM lignes ORDER BY quand DESC LIMIT 50) l;
$function$;

REVOKE ALL ON FUNCTION public._mot_mise_a_jour(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.carnet_de_mise_a_jour(bigint, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ecrire_sous_mise_a_jour(bigint, text, jsonb, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.basculer_coeur_mot_mise_a_jour(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effacer_mot_mise_a_jour(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aimer_mise_a_jour(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coeurs_de_mise_a_jour(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carnet_de_mise_a_jour(bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ecrire_sous_mise_a_jour(bigint, text, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.basculer_coeur_mot_mise_a_jour(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effacer_mot_mise_a_jour(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aimer_mise_a_jour(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coeurs_de_mise_a_jour(bigint) TO authenticated;
