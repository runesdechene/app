-- 258_enigma_themes.sql
-- WHY : Decouple la pioche d'enigmes de la mecanique faction. Cree la table de
-- reference des themes culturels (enigma_themes) : cle de pioche des motifs ET
-- source du macaron de theme sur la quotidienne. Etape 1/3 (schema + seed + FK +
-- colonne fragment + backfill). RPC en 259, DROP enigmas.heritage_id en 260.

BEGIN;

CREATE TABLE IF NOT EXISTS public.enigma_themes (
  id         text PRIMARY KEY,
  label      text NOT NULL,
  color      text,
  icon       text,
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

-- Seed dynamique depuis les valeurs distinctes existantes (garantit une FK valide)
INSERT INTO public.enigma_themes (id, label)
SELECT DISTINCT theme, initcap(theme)
FROM public.enigmas
WHERE theme IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Libelle lisible + couleur pour la Grece
UPDATE public.enigma_themes
SET label = 'Grèce Antique', color = '#1d4e89', sort_order = 10
WHERE id = 'grecque';

-- Couleurs des themes miroir depuis leur faction homonyme (one-shot, sans coupling runtime)
UPDATE public.enigma_themes et
SET color = f.color
FROM public.factions f
WHERE f.id = 'faction-' || et.id AND et.color IS NULL;

-- FK enigmas.theme -> enigma_themes (apres le seed)
ALTER TABLE public.enigmas
  ADD CONSTRAINT enigmas_theme_fkey FOREIGN KEY (theme) REFERENCES public.enigma_themes(id);

-- Colonne de pioche du motif
ALTER TABLE public.title_fragments
  ADD COLUMN IF NOT EXISTS theme text REFERENCES public.enigma_themes(id);

-- Backfill fragment.theme depuis le miroir faction 1:1 (cf. backfill mig 009)
UPDATE public.title_fragments SET theme = CASE collection
  WHEN 'faction-celtique'  THEN 'celtique'
  WHEN 'faction-nordique'  THEN 'nordique'
  WHEN 'faction-romaine'   THEN 'romaine'
  WHEN 'faction-byzantine' THEN 'byzantine'
  ELSE theme END
WHERE theme IS NULL;

COMMIT;
