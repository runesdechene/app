-- Élargit la CHECK constraint users.account_source pour accepter 'stand'.
-- Pourquoi : nouvelle 3ème voie d'inscription créée en festival/stand par un admin Hub
-- (page AssignFragments), distincte de 'app' (auto-inscription) et 'shopify' (sync e-commerce).
-- Permet de tracer/segmenter les comptes nés sur le stand pour mesurer le funnel festival → app.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_source_check;

ALTER TABLE public.users ADD CONSTRAINT users_account_source_check
  CHECK ((account_source)::text = ANY (ARRAY['app'::varchar, 'shopify'::varchar, 'stand'::varchar]::text[]));
