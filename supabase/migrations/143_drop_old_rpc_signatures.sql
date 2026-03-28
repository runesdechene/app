-- ============================================
-- MIGRATION 143 : Supprimer les anciennes signatures de RPCs
-- ============================================
-- PostgreSQL garde les anciennes signatures quand on en crée de nouvelles
-- avec des paramètres différents. Il faut les drop explicitement.

-- Anciennes signatures sans coordonnées
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT);
