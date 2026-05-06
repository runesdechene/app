-- 099_tutorial_slide_mecenat.sql
-- Ajoute un slide tutoriel "Le Mécénat" en phase `after` (après onboarding).
-- Couvre : investir des Couronnes sur un lieu, rayonnement visuel sur la carte,
-- la marche IRL prime toujours sur l'or.
-- Position : à la fin de la phase `after` (la place finale peut être ajustée
-- via le Hub si nécessaire).

INSERT INTO tutorial_slides (phase, position, title, body, image_url)
VALUES (
  'after',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM tutorial_slides WHERE phase = 'after'),
  'Le Mécénat',
  E'Tes Couronnes ne dorment pas dans tes coffres. Investis-les sur un lieu — pour soutenir son veilleur, ou pour t''en disputer la marque depuis l''autre bout du monde. Plus un lieu reçoit de Couronnes, plus il rayonne sur la carte.\n\nMais souviens-toi : la marche prime toujours sur l''or. Quiconque foule le lieu en personne efface les menaces et reprend le dessus.',
  NULL
);
