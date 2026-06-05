-- Migration 215 — Empreinte des sources de génération SEO
--
-- Contexte : depuis que les utilisateurs rédigent eux-mêmes des descriptions
-- riches, les seo-pages affichent en priorité `places.text`. Claude Haiku ne
-- sert plus que de filet de sécurité pour les lieux à texte pauvre.
--
-- `seo_source_hash` mémorise l'empreinte (texte + récits) ayant servi à générer
-- `seo_description`. La nightly régénère un lieu (à texte pauvre) uniquement si
-- son empreinte change → fin de la SEO figée à vie.

ALTER TABLE places ADD COLUMN IF NOT EXISTS seo_source_hash TEXT;

COMMENT ON COLUMN places.seo_source_hash IS
  'Hash (sha256 tronqué 32) du texte + récits ayant servi à générer seo_description. Déclenche la régénération quand la source évolue. NULL = pas encore généré via le pipeline hash-aware.';
