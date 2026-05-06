-- 104_v07_expeditions_schema.sql
-- WHY : sous-système "Expéditions" joueur-joueur (spec 2026-05-06).
-- Bannière temporaire sur la carte, chef d'expédition unique, inscription
-- manuelle ou libre, chat privé, comptes rendus avec galerie, archives.
--
-- ⚠️ NAMING : côté SQL, les tables sont préfixées `voyage_*` pour éviter
-- toute collision avec la table `expeditions` du système Plantage/Veille
-- (mig 015, qui représente un "groupe de plantage"). Côté TypeScript /
-- frontend / UI, on garde le mot "Expédition" partout. La couche
-- expeditionsApi.ts fait le mapping. Voir `docs/db/tech-debt.md` D1
-- pour le plan de cleanup futur (renommer la table Plantage en
-- `plantage_groups` quand on aura un slot dédié).
--
-- 7 tables (voyages, voyage_participants, voyage_messages,
-- voyage_message_reads, voyage_reports, voyage_report_medias,
-- voyage_flags) + trigger XP +10 au premier compte rendu + Realtime
-- sur voyage_messages et voyage_participants.

-- ============================================================
-- TABLE : voyages (== "expeditions" côté UI)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voyages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chief_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  rdv_at timestamptz NOT NULL,
  rdv_lat double precision NOT NULL,
  rdv_lng double precision NOT NULL,
  rdv_label text CHECK (rdv_label IS NULL OR length(rdv_label) <= 120),
  call_text text CHECK (call_text IS NULL OR length(call_text) <= 200),
  call_author_id text REFERENCES public.users(id) ON DELETE SET NULL,
  call_updated_at timestamptz,
  slots_max integer CHECK (slots_max IS NULL OR slots_max BETWEEN 2 AND 50),
  slots_open boolean NOT NULL DEFAULT false,
  validation_mode text NOT NULL CHECK (validation_mode IN ('manual','free')),
  status text NOT NULL CHECK (status IN ('published','passed','archived','cancelled')) DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT slots_consistency CHECK (
    (slots_open = true  AND slots_max IS NULL)
    OR (slots_open = false AND slots_max IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_voyages_status_rdv ON public.voyages(status, rdv_at);
CREATE INDEX IF NOT EXISTS idx_voyages_chief     ON public.voyages(chief_user_id);

-- ============================================================
-- TABLE : voyage_participants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voyage_participants (
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','validated','rejected','withdrawn')),
  request_message text CHECK (request_message IS NULL OR length(request_message) <= 280),
  joined_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  PRIMARY KEY (voyage_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_voyage_participants_user ON public.voyage_participants(user_id, status);

-- ============================================================
-- TABLE : voyage_messages (chat privé)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voyage_messages (
  id bigserial PRIMARY KEY,
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voyage_messages_voyage ON public.voyage_messages(voyage_id, created_at);

CREATE TABLE IF NOT EXISTS public.voyage_message_reads (
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (voyage_id, user_id)
);

-- ============================================================
-- TABLE : voyage_reports (1 par participant après date passée)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voyage_reports (
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text_content text CHECK (text_content IS NULL OR length(text_content) <= 1000),
  is_public boolean NOT NULL DEFAULT false,
  cover_media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (voyage_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.voyage_report_medias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video')),
  size_bytes integer,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (voyage_id, user_id)
    REFERENCES public.voyage_reports(voyage_id, user_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_voyage_medias_gallery
  ON public.voyage_report_medias(voyage_id, created_at);

-- ============================================================
-- TABLE : voyage_flags (signalements)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voyage_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id uuid NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','inappropriate','other')),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  resolved_at timestamptz,
  resolved_by text REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voyage_flags_unresolved
  ON public.voyage_flags(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- TRIGGER XP : +10 XP au PREMIER compte rendu posté (par participant)
-- Pattern aligné sur les triggers _trg_xp_* existants (cf. mig 042).
-- BEFORE INSERT pour pouvoir muter NEW.xp_awarded.
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_voyage_report_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NEW.created_at, now()) >= public._xp_epoch() AND NEW.xp_awarded = false THEN
    UPDATE public.users SET xp_total = xp_total + 10 WHERE id = NEW.user_id;
    NEW.xp_awarded := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_voyage_report_ins ON public.voyage_reports;
CREATE TRIGGER trg_xp_voyage_report_ins
  BEFORE INSERT ON public.voyage_reports
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_voyage_report_insert();

-- ============================================================
-- REALTIME : chat live + notifs de validation participants
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voyage_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voyage_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voyage_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voyage_participants;
  END IF;
END $$;
