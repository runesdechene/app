-- 474 — Le scan d'un Fragment : les empreintes de référence et les scans
--
-- WHY : Uriel, 09/10/2026 : on passe le téléphone devant un t-shirt et ça « bipe » comme un QR code,
--   sans QR code. Un modèle de vision tourne sur le téléphone et compare le viseur à des empreintes
--   de référence : les illustrations (calculées par le Hub) et des vues du vrai t-shirt (apprises par
--   les admins depuis le scanner). Les scans sont comptés : un des quatre chiffres de la marque.
--   Spec docs/superpowers/specs/2026-10-09-v2-scan-design.md.
--   Les vecteurs arrivent en jsonb (un tableau de nombres) : PostgREST passe mal les real[][].
--
-- SCHEMA CHECKED (09/10/2026, live) : title_fragments(id integer, name, visible, illustration_url) ;
--   users(id varchar, role varchar, display_name text) ; _is_admin() (mig 219).

CREATE TABLE IF NOT EXISTS public.scan_empreintes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fragment_id integer NOT NULL REFERENCES public.title_fragments(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('illustration', 'vue')),
  vecteur real[] NOT NULL,
  modele text NOT NULL,
  ajoutee_par varchar REFERENCES public.users(id) ON DELETE SET NULL,
  ajoutee_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scan_empreintes_fragment ON public.scan_empreintes (fragment_id, modele);
-- Aucune policy : tout passe par les RPC ci-dessous.
ALTER TABLE public.scan_empreintes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.scans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fragment_id integer NOT NULL REFERENCES public.title_fragments(id) ON DELETE CASCADE,
  user_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  quand timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scans_fragment_quand ON public.scans (fragment_id, quand);
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Un tableau jsonb de nombres → real[] ; refuse tout ce qui n'a pas 1 024 nombres.
CREATE OR REPLACE FUNCTION public._vecteur_du_scan(p jsonb)
RETURNS real[] LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE v real[];
BEGIN
  SELECT array_agg(x::real ORDER BY i) INTO v
  FROM jsonb_array_elements_text(p) WITH ORDINALITY AS t(x, i);
  IF coalesce(array_length(v, 1), 0) <> 1024 THEN
    RAISE EXCEPTION 'Empreinte invalide : 1 024 nombres attendus' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;
REVOKE EXECUTE ON FUNCTION public._vecteur_du_scan(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.empreintes_du_scan(p_modele text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nom', f.name, 'illustration', f.illustration_url,
      'empreintes', (SELECT jsonb_agg(jsonb_build_object('id', e.id, 'source', e.source, 'vecteur', to_jsonb(e.vecteur)) ORDER BY e.id)
                     FROM scan_empreintes e WHERE e.fragment_id = f.id AND e.modele = p_modele)
    ) ORDER BY f.name), '[]'::jsonb)
  FROM title_fragments f
  WHERE f.visible
    AND EXISTS (SELECT 1 FROM scan_empreintes e WHERE e.fragment_id = f.id AND e.modele = p_modele);
$$;
GRANT EXECUTE ON FUNCTION public.empreintes_du_scan(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ajouter_vue(p_fragment integer, p_vecteur jsonb, p_modele text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT _is_admin() THEN RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501'; END IF;
  INSERT INTO scan_empreintes (fragment_id, source, vecteur, modele, ajoutee_par)
  VALUES (p_fragment, 'vue', _vecteur_du_scan(p_vecteur), p_modele, auth.uid()::text)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ajouter_vue(integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_vue(integer, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirer_empreinte(p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501'; END IF;
  DELETE FROM scan_empreintes WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.retirer_empreinte(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_empreinte(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.remplacer_empreintes_illustration(p_fragment integer, p_vecteurs jsonb, p_modele text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n integer;
BEGIN
  IF NOT _is_admin() THEN RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501'; END IF;
  DELETE FROM scan_empreintes WHERE fragment_id = p_fragment AND source = 'illustration';
  INSERT INTO scan_empreintes (fragment_id, source, vecteur, modele, ajoutee_par)
  SELECT p_fragment, 'illustration', _vecteur_du_scan(v), p_modele, auth.uid()::text
  FROM jsonb_array_elements(p_vecteurs) AS t(v);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.remplacer_empreintes_illustration(integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remplacer_empreintes_illustration(integer, jsonb, text) TO authenticated;

-- Un bip = une ligne ; l'Explorateur s'il est connecté (et qu'il a sa ligne users), sinon personne.
CREATE OR REPLACE FUNCTION public.noter_scan(p_fragment integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO scans (fragment_id, user_id)
  SELECT f.id, (SELECT u.id FROM users u WHERE u.id = auth.uid()::text)
  FROM title_fragments f WHERE f.id = p_fragment AND f.visible;
$$;
GRANT EXECUTE ON FUNCTION public.noter_scan(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.scan_du_hub(p_modele text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'illustrations', (SELECT count(*) FROM scan_empreintes e
                        WHERE e.fragment_id = f.id AND e.source = 'illustration' AND e.modele = p_modele),
      'vues', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'le', e.ajoutee_le, 'par', u.display_name) ORDER BY e.id DESC)
                        FROM scan_empreintes e LEFT JOIN users u ON u.id = e.ajoutee_par
                        WHERE e.fragment_id = f.id AND e.source = 'vue' AND e.modele = p_modele), '[]'::jsonb),
      'scans7', (SELECT count(*) FROM scans s WHERE s.fragment_id = f.id AND s.quand > now() - interval '7 days'),
      'scans30', (SELECT count(*) FROM scans s WHERE s.fragment_id = f.id AND s.quand > now() - interval '30 days')
    ) ORDER BY f.id), '[]'::jsonb)
    FROM title_fragments f);
END $$;
REVOKE ALL ON FUNCTION public.scan_du_hub(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_du_hub(text) TO authenticated;
