-- WHY: flyer_signup_log existe en prod sans migration (créée à la main pour le frein du flyer) ; le dépôt
--      la déclare telle quelle (spec Hub V2 §13.1, même démarche que account_source). Aucune donnée ne change.
-- SCHEMA CHECKED (15/10/2026, live) : information_schema.columns, pg_indexes, pg_constraint, pg_policies
--      (aucune politique : RLS activée, seul service_role lit et écrit), role_table_grants et
--      column_privileges. Les droits sont ceux de la mig 337 : SELECT retiré à anon/authenticated sur la
--      table, rendu colonne par colonne sans `email`.

CREATE TABLE IF NOT EXISTS public.flyer_signup_log (
  id         bigserial PRIMARY KEY,
  ip         text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flyer_signup_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS flyer_signup_log_ip_created_idx
  ON public.flyer_signup_log USING btree (ip, created_at);

-- Droits tels qu'en prod : ni SELECT ni TRUNCATE sur la table pour anon/authenticated,
-- SELECT limité à id, ip, created_at (l'e-mail reste réservé à l'équipe, mig 337).
REVOKE ALL ON public.flyer_signup_log FROM anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, UPDATE ON public.flyer_signup_log TO anon, authenticated;
GRANT SELECT (id, ip, created_at) ON public.flyer_signup_log TO anon, authenticated;
