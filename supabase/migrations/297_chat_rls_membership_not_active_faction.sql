-- 297_chat_rls_membership_not_active_faction.sql
-- WHY : le chat d'une Compagnie a `channel = faction_id`. Les policies RLS faction
-- (chat_insert_faction / chat_read_faction) gataient sur `users.faction_id = channel`,
-- donc UNIQUEMENT la Compagnie PRINCIPALE → un membre ALLIÉ (channel = sa Compagnie
-- alliée ≠ sa principale) se prenait « new row violates row-level security policy ».
-- Modèle correct : accès chat = ADHÉSION (faction_members), pas bannière active.
-- ADDITIF (réécriture de 2 policies, gating élargi à la bonne source).

DROP POLICY IF EXISTS chat_insert_faction ON public.chat_messages;
CREATE POLICY chat_insert_faction ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    (channel)::text <> ALL (ARRAY['general'::text, 'bugs'::text])
    AND (auth.uid())::text = (user_id)::text
    AND EXISTS (
      SELECT 1 FROM public.faction_members fm
      WHERE fm.user_id = (auth.uid())::text
        AND (fm.faction_id)::text = (chat_messages.channel)::text
    )
  );

DROP POLICY IF EXISTS chat_read_faction ON public.chat_messages;
CREATE POLICY chat_read_faction ON public.chat_messages
  FOR SELECT
  USING (
    (channel)::text <> ALL (ARRAY['general'::text, 'bugs'::text])
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.faction_members fm
      WHERE fm.user_id = (auth.uid())::text
        AND (fm.faction_id)::text = (chat_messages.channel)::text
    )
  );
