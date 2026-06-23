-- 271_factions_to_classes_rename.sql
-- Renomme les 4 factions en classes (identité visuelle). Additif : UPDATE de données,
-- id et color conservés. Rollback = restaurer les anciens titres (Chevauchée du Crépuscule,
-- Pèlerins des Brumes, Garde Boréale, Légions d'Airain).

update public.factions set
  title = 'L''Archiviste',
  adjective = 'Archiviste',
  description = 'L''Archiviste accueille ceux qui refusent que les choses disparaissent. Quand un lieu s''efface, c''est lui qui le retient ; quand une histoire s''éteint, c''est lui qui la rallume. Son combat n''est pas contre les hommes, mais contre l''Oubli lui-même.'
where id = 'faction-byzantine';

update public.factions set
  title = 'Le Pèlerin',
  adjective = 'Pèlerin',
  description = 'Le Pèlerin accueille les âmes contemplatives, ceux qui entendent une présence dans une source, un vieux chêne, une pierre levée — et qui s''inclinent là où d''autres ne voient qu''un décor. Il refuse que le monde oublie qu''il est encore vivant et sacré.'
where id = 'faction-celtique';

update public.factions set
  title = 'Le Rôdeur',
  adjective = 'Rôdeur',
  description = 'Le Rôdeur accueille les cœurs sans repos, ceux que l''horizon appelle et qui s''enfoncent là où les chemins s''effacent, pour débusquer les lieux que le monde a cessé de fouler. Quand une route s''oublie, c''est lui qui la rouvre.'
where id = 'faction-nordique';

update public.factions set
  title = 'Le Protecteur',
  adjective = 'Protecteur',
  description = 'Le Protecteur accueille les âmes loyales et constantes, ceux qui ne se contentent pas de trouver un lieu mais veillent sur lui, le défendent et le soignent pour qu''il ne retombe pas dans la nuit. Ce qu''il a juré de garder, l''Oubli ne le reprendra pas.'
where id = 'faction-romaine';

-- image_url (emblème de classe) : inchangé ici — UPDATE séparé quand les assets seront prêts.
