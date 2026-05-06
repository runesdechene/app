-- 117_users_display_name_backfill.sql
-- WHY : la colonne users.display_name est lue par 50+ RPCs V0.7 mais
-- n'est écrite nulle part — l'app set users.first_name à l'inscription.
-- Résultat : display_name = NULL pour la majorité, RPCs retournent
-- des noms vides en silence. Backfill défensif jusqu'au sprint
-- consolidation (cf. docs/db/tech-debt.md D2).

UPDATE public.users
   SET display_name = first_name
 WHERE display_name IS NULL
   AND first_name IS NOT NULL
   AND first_name <> '';
