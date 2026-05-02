-- 062_v07_restore_xp_on_discover.sql
-- WHY: défait le no-op de Calibration C (mig 050) sur les triggers de découverte.
--      Décision Uriel 2026-05-02 : "Découvrir un lieu doit rapporter de la Gloire,
--      sinon le toast ment et le joueur ne progresse pas." Les mini-quêtes
--      journalières (qui devaient compenser, cf. mig 050 commentaire) ont été
--      rollback (mig 058) — donc on a besoin d'une source d'XP fiable côté
--      découverte tout de suite.
--
-- Restaure les triggers à la version mig 049 (avec `discovered_at`, et check
-- `>= _xp_epoch()` pour ne pas comptabiliser l'historique pré-switch).
-- Pas de backfill rétroactif : seules les découvertes futures donneront +1 XP.
-- Si l'on veut rattraper l'existant (donner +1 par découverte depuis 2026-03-01
-- aux 5 comptes actifs), une mig séparée le fera explicitement.

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.discovered_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.discovered_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 1) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;
