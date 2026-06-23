-- 270_flyer_account_source_and_rate_limit.sql
-- WHY : feature « Flyer QR → cadeau » (2026-06-23). 4ème voie d'inscription, née
-- d'un QR code sur les flyers papier, distincte de 'app' / 'shopify' / 'stand'.
-- Permet de segmenter le funnel flyer → vente (tag Shopify source:flyer en miroir).
-- Ajoute aussi une table de rate-limit par IP, car l'endpoint est PUBLIC (pas admin).

-- 1. Élargit la CHECK constraint pour accepter 'flyer'.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_source_check;

ALTER TABLE public.users ADD CONSTRAINT users_account_source_check
  CHECK ((account_source)::text = ANY (ARRAY['app'::varchar, 'shopify'::varchar, 'stand'::varchar, 'flyer'::varchar]::text[]));

-- 2. Journal des tentatives flyer, pour rate-limiter par IP.
CREATE TABLE IF NOT EXISTS public.flyer_signup_log (
  id         bigserial PRIMARY KEY,
  ip         text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flyer_signup_log_ip_created_idx
  ON public.flyer_signup_log (ip, created_at);

-- Pas de policy : seul le service role (Netlify function) y accède. RLS activé,
-- aucune policy = anon/authenticated n'y touchent pas.
ALTER TABLE public.flyer_signup_log ENABLE ROW LEVEL SECURITY;
