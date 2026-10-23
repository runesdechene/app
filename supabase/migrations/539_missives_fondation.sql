-- WHY: Missives, lot 1 (spec 2026-10-22-mailing-parcours-client-design, plan lot 1 tâche 1).
--      Le Hub écrit des Missives et les envoie par Resend à ceux qui ont accepté les nouvelles.
--      1. users : l'accord aux nouvelles, sa date et la porte par laquelle il est arrivé
--         (la dernière action gagne entre le Hub et Shopify, d'où la date).
--      2. ambassadeurs : les personnes qu'Uriel choisit lui-même (ambassadeurs, égéries).
--      3. missives et missive_envois : une Missive, puis une ligne par destinataire. La clé
--         (missive_id, user_id) empêche un double envoi si le réveil passe deux fois.
--      4. _liste_membres : la seule définition des cinq listes, lue par hub_listes (le Hub)
--         et par la préparation de l'envoi (mig 541), au moment de l'envoi.
-- SCHEMA CHECKED (23/10/2026, live) : users.id varchar (pas uuid), email_address, first_name,
--   supprime_le présents, aucune colonne accord_* ; user_fragments(user_id varchar, fragment_id) ;
--   ambassadeurs, missives, missive_envois absentes ; _is_admin() et _refus(text, text) existent.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accord_nouvelles boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accord_nouvelles_le timestamptz,
  ADD COLUMN IF NOT EXISTS accord_nouvelles_porte text
    CHECK (accord_nouvelles_porte IN ('stand', 'flyer', 'site', 'appli', 'shopify', 'hub', 'desabonnement', 'rebond'));

CREATE TABLE public.ambassadeurs (
  user_id  varchar PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role     text NOT NULL CHECK (role IN ('ambassadeur', 'egerie')),
  ajoute_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.missives (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modele        text NOT NULL CHECK (modele IN ('missive', 'fragment', 'carnet')),
  couleurs      jsonb NOT NULL,
  contenu       jsonb NOT NULL,
  objet         text NOT NULL,
  apercu        text,
  liste         text CHECK (liste IN ('tous', 'prospects', 'porteurs', 'meilleurs', 'ambassadeurs')),
  statut        text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'programmee', 'en_cours', 'envoyee')),
  programmee_le timestamptz,
  envoyee_le    timestamptz,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

-- Le réveil cherche les missives programmées arrivées à échéance.
CREATE INDEX missives_a_envoyer ON public.missives (programmee_le) WHERE statut = 'programmee';

CREATE TABLE public.missive_envois (
  missive_id bigint NOT NULL REFERENCES public.missives(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- en_route : pris par un réveil, en cours d'envoi (missives_prendre_lot, mig 541).
  statut     text NOT NULL DEFAULT 'a_envoyer' CHECK (statut IN ('a_envoyer', 'en_route', 'envoye', 'echec', 'rebond', 'plainte')),
  resend_id  text,
  erreur     text,
  envoye_le  timestamptz,
  ouvert_le  timestamptz,
  clique_le  timestamptz,
  PRIMARY KEY (missive_id, user_id)
);

CREATE INDEX missive_envois_user ON public.missive_envois (user_id);
-- Le webhook Resend retrouve l'envoi par l'identifiant que Resend lui renvoie.
CREATE INDEX missive_envois_resend ON public.missive_envois (resend_id) WHERE resend_id IS NOT NULL;

-- Lecture et écriture : l'équipe seule. Le service role passe outre la RLS.
ALTER TABLE public.ambassadeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missive_envois ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambassadeurs_equipe ON public.ambassadeurs FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));
CREATE POLICY missives_equipe ON public.missives FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));
CREATE POLICY missive_envois_equipe ON public.missive_envois FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));

REVOKE ALL ON public.ambassadeurs, public.missives, public.missive_envois FROM anon;

-- Les membres d'une liste : comptes non supprimés, accord ou non (le filtre d'accord est à l'appelant).
CREATE FUNCTION public._liste_membres(p_liste text)
 RETURNS TABLE(user_id varchar)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH frag AS (SELECT f.user_id, count(*) AS n FROM user_fragments f GROUP BY f.user_id)
  SELECT u.id
    FROM users u
    LEFT JOIN frag ON frag.user_id = u.id
   WHERE u.supprime_le IS NULL
     AND CASE p_liste
           WHEN 'tous' THEN true
           WHEN 'prospects' THEN frag.n IS NULL
           WHEN 'porteurs' THEN frag.n >= 1
           WHEN 'meilleurs' THEN frag.n >= 5
           WHEN 'ambassadeurs' THEN EXISTS (SELECT 1 FROM ambassadeurs a WHERE a.user_id = u.id)
           ELSE false
         END;
$function$;

REVOKE ALL ON FUNCTION public._liste_membres(text) FROM PUBLIC, anon, authenticated;

-- Le Hub : pour chaque liste, combien de personnes et combien ont accepté les nouvelles.
CREATE FUNCTION public.hub_listes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT jsonb_agg(jsonb_build_object('cle', l.cle, 'personnes', c.personnes, 'avec_accord', c.avec_accord)
                   ORDER BY l.ordre)
    INTO v_resultat
    FROM unnest(ARRAY['tous', 'prospects', 'porteurs', 'meilleurs', 'ambassadeurs']) WITH ORDINALITY AS l(cle, ordre)
    CROSS JOIN LATERAL (
      SELECT count(*) AS personnes, count(*) FILTER (WHERE u.accord_nouvelles) AS avec_accord
        FROM _liste_membres(l.cle) m JOIN users u ON u.id = m.user_id
    ) c;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_listes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_listes() TO authenticated;
