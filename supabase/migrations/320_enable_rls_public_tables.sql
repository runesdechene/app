-- 320_enable_rls_public_tables.sql
-- WHY : FAILLE CRITIQUE (advisor sécurité Supabase, mails « rls_disabled_in_public »).
-- 34 tables de `public` avaient RLS DÉSACTIVÉ + tous les droits (SELECT/INSERT/UPDATE/
-- DELETE/TRUNCATE) accordés à anon ET authenticated → la clé anon étant publique
-- (embarquée dans le bundle JS), n'importe qui pouvait lire/modifier/vider ces tables
-- via l'API REST sans compte. Pire : password_resets (jetons de reset → prise de compte)
-- et refresh_tokens (jetons de session → hijack), en clair.
--
-- L'app accède à ces tables quasi exclusivement via des RPC SECURITY DEFINER (qui
-- bypassent RLS) → activer RLS ferme le trou SANS rien casser. Vérifié par grep des
-- 3 apps + thème Shopify : seules 4 tables sont touchées en direct (.from) ou en
-- Realtime et reçoivent une policy SELECT ; les 30 autres = RPC-only → ENABLE RLS seul
-- (deny-all à anon/authenticated, definer bypasse).
--
--   enigma_themes    : .from() lecture (explore-web + hub) — référence publique
--   voyage_messages  : .from() + Realtime (chat expédition)
--   mission_messages : Realtime (salon mission)
--   place_court_score : Realtime (carte — tension des lieux)
--
-- Les policies SELECT reproduisent le comportement ACTUEL (lecture par les rôles qui
-- lisaient déjà) en retirant anon là où ça doit l'être. Le durcissement (scoper le chat
-- aux participants, REVOKE des grants superflus) est traité dans une passe ultérieure.
-- ADDITIF / réversible.

BEGIN;

-- ── 1. ENABLE RLS sur les 34 tables ──────────────────────────────────────────
ALTER TABLE public.crown_harvest                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enigma_themes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_emojis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_flags                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_report_medias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_quest_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupe_seasons                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_message_reads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_quests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_court_action           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defis                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defi_claims                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedition_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_templates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_court_score            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_veille                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_tags_revisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mikro_orm_migrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_gauge_mapping            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veille_history               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_participants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_participants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expeditions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyages                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_message_reads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_crowns                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_banner_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_gold_log             ENABLE ROW LEVEL SECURITY;

-- ── 2. Policies SELECT pour les 4 tables lues en direct / Realtime ───────────
-- enigma_themes : référentiel public (id, label, couleur, icône) — non sensible.
DROP POLICY IF EXISTS enigma_themes_select_public ON public.enigma_themes;
CREATE POLICY enigma_themes_select_public ON public.enigma_themes
  FOR SELECT TO anon, authenticated USING (true);

-- voyage_messages : chat d'expédition. Lecture par utilisateurs connectés (retire anon).
-- (Scoping aux participants = durcissement ultérieur, après confirmation du modèle
-- spectateurs.) L'envoi passe par RPC send_voyage_message (definer).
DROP POLICY IF EXISTS voyage_messages_select_auth ON public.voyage_messages;
CREATE POLICY voyage_messages_select_auth ON public.voyage_messages
  FOR SELECT TO authenticated USING (true);

-- mission_messages : salon de mission. Idem (retire anon).
DROP POLICY IF EXISTS mission_messages_select_auth ON public.mission_messages;
CREATE POLICY mission_messages_select_auth ON public.mission_messages
  FOR SELECT TO authenticated USING (true);

-- place_court_score : état de Cour d'un lieu (game-state public, lu en Realtime par
-- la carte pour rafraîchir la tension). Non sensible.
DROP POLICY IF EXISTS place_court_score_select_auth ON public.place_court_score;
CREATE POLICY place_court_score_select_auth ON public.place_court_score
  FOR SELECT TO authenticated USING (true);

COMMIT;
