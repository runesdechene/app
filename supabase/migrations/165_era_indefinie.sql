-- 165_era_indefinie.sql
-- WHY : à l'ajout d'un lieu, le choix d'époque était bloquant (UX friction).
-- On ajoute une époque "Indéfinie" (sort_order=0, donc en tête du dropdown)
-- qui sera sélectionnée par défaut au create. Côté affichage de la fiche lieu,
-- ce eraId sera traité comme "non renseigné" (CTA "Ajouter une époque" reste).
--
-- year_start/year_end NULL pour ne pas déclencher l'avertissement "date hors
-- fourchette" si l'utilisateur saisit une année précise sans choisir d'ère.

INSERT INTO public.eras (id, name, year_start, year_end, sort_order)
VALUES ('unknown', 'Indéfinie', NULL, NULL, 0)
ON CONFLICT (id) DO NOTHING;
