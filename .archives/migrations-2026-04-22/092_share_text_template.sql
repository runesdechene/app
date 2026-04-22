-- Migration 092: Template de partage éditable depuis le hub
-- Ajoute la clé 'share_text_template' dans app_settings (table key/value).
-- La valeur est un string avec placeholder {name} remplacé côté client par le nom du lieu.

insert into public.app_settings (key, value)
values (
  'share_text_template',
  'Un trésor oublié t''attend sur Runes de Chêne. Viens explorer {name}.'
)
on conflict (key) do nothing;
