-- Étendre le CHECK constraint sur purchase_log.status
-- pour supporter les nouveaux statuts du webhook : skipped, no_match, no_tags
ALTER TABLE purchase_log DROP CONSTRAINT IF EXISTS purchase_log_status_check;
ALTER TABLE purchase_log ADD CONSTRAINT purchase_log_status_check
  CHECK (status IN ('unlocked', 'pending', 'manual', 'skipped', 'no_match', 'no_tags'));
