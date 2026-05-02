-- 057_v07_users_notes_realtime.sql
-- WHY: Filet de sécurité pour la propagation des notes entre comptes.
--      Le canal Supabase Presence broadcast déjà la note via le payload (cf. usePresence),
--      mais on a observé des cas où la modif d'une note d'un compte A n'arrivait pas en
--      temps réel sur compte B. Pour éviter de dépendre uniquement de presence, on ajoute
--      `public.users` à la publication realtime — UNIQUEMENT sur les colonnes liées aux
--      notes (id, note_text, note_posted_at) — pour broadcast les changements via
--      postgres_changes. Volume négligeable (1 event par set_note / clear_note).
--
-- Postgres 15+ requis (column-level publication filtering). Vérifié : 17.6.

ALTER PUBLICATION supabase_realtime ADD TABLE public.users (id, note_text, note_posted_at);
