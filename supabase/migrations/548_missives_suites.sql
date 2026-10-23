-- WHY: Missives, lot 2, tâche 1 : les suites (Bienvenue, Bienvenue du stand, Après le premier achat).
--      Une étape de suite EST une Missive (statut 'automatique') : même éditeur, même rendu, même envoi,
--      et la clé (missive_id, user_id) de missive_envois empêche qu'une étape parte deux fois à quelqu'un.
--      suite_inscriptions porte où en est chaque personne : le dernier jour envoyé et quand part le suivant.
--      Les suites naissent en pause : personne n'y entre avant qu'Uriel ait écrit les textes et activé.
-- SCHEMA CHECKED (23/10/2026, live) : missives_statut_check = brouillon, programmee, en_cours, envoyee ;
--   users.id varchar, users.account_source ; purchase_log(user_id varchar, shopify_order_id varchar,
--   created_at timestamptz) ; aucune table suite*.

ALTER TABLE public.missives DROP CONSTRAINT missives_statut_check;
ALTER TABLE public.missives ADD CONSTRAINT missives_statut_check
  CHECK (statut IN ('brouillon', 'programmee', 'en_cours', 'envoyee', 'automatique'));

CREATE TABLE public.suites (
  cle          text PRIMARY KEY CHECK (cle IN ('bienvenue', 'stand', 'apres_achat')),
  nom          text NOT NULL,
  -- Bienvenue exige l'accord aux nouvelles ; les deux autres s'adressent à des clients (exception L34-5).
  exige_accord boolean NOT NULL,
  active       boolean NOT NULL DEFAULT false
);

INSERT INTO public.suites (cle, nom, exige_accord) VALUES
  ('bienvenue', 'Bienvenue', true),
  ('stand', 'Bienvenue du stand', false),
  ('apres_achat', 'Après le premier achat', false);

CREATE TABLE public.suite_etapes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  suite      text NOT NULL REFERENCES public.suites(cle),
  jour       integer NOT NULL CHECK (jour >= 0),
  missive_id bigint NOT NULL UNIQUE REFERENCES public.missives(id) ON DELETE CASCADE,
  UNIQUE (suite, jour)
);

CREATE TABLE public.suite_inscriptions (
  suite        text NOT NULL REFERENCES public.suites(cle),
  user_id      varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inscrit_le   timestamptz NOT NULL DEFAULT now(),
  jour_fait    integer,      -- le jour de la dernière étape envoyée ; NULL avant la première
  prochaine_le timestamptz,  -- quand part l'étape suivante ; NULL : la suite est finie
  arretee_le   timestamptz,  -- un achat arrête la Bienvenue
  PRIMARY KEY (suite, user_id)
);

CREATE INDEX suite_inscriptions_dues ON public.suite_inscriptions (prochaine_le)
  WHERE arretee_le IS NULL AND prochaine_le IS NOT NULL;

ALTER TABLE public.suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suites_equipe ON public.suites FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));
CREATE POLICY suite_etapes_equipe ON public.suite_etapes FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));
CREATE POLICY suite_inscriptions_equipe ON public.suite_inscriptions FOR ALL TO authenticated
  USING ((SELECT _is_admin())) WITH CHECK ((SELECT _is_admin()));

REVOKE ALL ON public.suites, public.suite_etapes, public.suite_inscriptions FROM anon;
