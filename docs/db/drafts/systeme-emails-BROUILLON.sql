-- ⚠️ BROUILLON — JAMAIS APPLIQUÉ, NE PAS COPIER DANS supabase/migrations/ TEL QUEL
--
-- Origine : traînait dans le vault Obsidian (`📱 L'application (La Carte)/`), rapatrié
-- le 18/08/2026. Vérifié le même jour : aucune de ces tables n'existe en prod ni dans
-- le repo (0 occurrence dans supabase/, 0 node dans graphify-out/graph.json).
--
-- Avant d'en faire quoi que ce soit : lire docs/db/migrations-workflow.md. Le canal
-- unique est un fichier numéroté NNN_*.sql dans supabase/migrations/ + db push --linked.
-- Ce brouillon n'a ni RLS, ni GRANT, ni policy — en l'état il exposerait des emails,
-- ce qu'on a passé les migs 336-338 à fermer (voir docs/db/gotchas.md § Données personnelles).

-- 1. Tables principales pour le système d'emails

-- Table des abonnés (toutes sources confondues)
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  source TEXT NOT NULL, -- 'shopify_order', 'shopify_newsletter', 'app_signup'
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Index sur l'email pour des recherches rapides
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);

-- 2. Séquences d'emails en cours

CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE CASCADE,
  sequence_type TEXT NOT NULL, -- 'shopify_welcome', 'app_welcome', 'post_order'
  current_step TEXT NOT NULL, -- 'J1', 'J3', 'J7', 'J10'
  started_at TIMESTAMPTZ DEFAULT now(),
  next_send_at TIMESTAMPTZ NOT NULL,
  promo_code_used BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

-- Index pour le CRON (récupérer les emails à envoyer)
CREATE INDEX IF NOT EXISTS idx_email_sequences_next_send ON email_sequences(next_send_at) WHERE completed = false;

-- 3. Log des envois (Audit et Historique)

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL,
  template TEXT NOT NULL, -- 'J1_shopify_welcome', 'J3_conquete', etc.
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT
);

-- 4. Sécurité (RLS)
-- Par défaut, ces tables ne sont accessibles que par le service_role (Edge Functions)
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- 5. Helper pour marquer une séquence comme complétée lors d'un achat
-- Si un client achète, on veut souvent stopper ou modifier sa séquence newsletter
CREATE OR REPLACE FUNCTION handle_purchase_stop_sequences()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un utilisateur avec cet email existe, on marque ses séquences 'newsletter' comme complétées
  UPDATE email_sequences
  SET completed = true,
      metadata = metadata || jsonb_build_object('stopped_by_purchase', now())
  FROM email_subscribers
  WHERE email_sequences.subscriber_id = email_subscribers.id
    AND email_subscribers.email = NEW.email
    AND email_sequences.sequence_type = 'shopify_newsletter'
    AND email_sequences.completed = false;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
