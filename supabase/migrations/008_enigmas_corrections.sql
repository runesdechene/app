-- 008_enigmas_corrections.sql
-- WHY : Audit des 301 énigmes daily (29 avril 2026) a révélé :
-- - 4 erreurs factuelles critiques (Hannibal "romain", gladiateurs "interdits",
--   Nerviens "Champagne", cratère Vix "208 L" alors que c'est 208 kg pour le poids)
-- - 3 nuances factuelles à adoucir (Taranis soleil→tonnerre, Sena Loire→Armorique,
--   partes romaines = thèse contestée à présenter comme telle)
-- - 2 QCM cosmétiques (Saturn→Saturne, L'Despotat→Le Despotat)
-- - ~22 typos dont une famille "Empereuromain"/"emperor"/"empereurroma"
--   (bug de génération, mots collés ou anglicismes restés)
--
-- Toutes les corrections sont idempotentes (REPLACE no-op si pattern absent).

-- ============================================================
-- BLOC 2 — Corrections sémantiques validées
-- ============================================================

-- #160 Hannibal : "général romain" est l'inverse de l'histoire (carthaginois)
UPDATE enigmas SET
  question = 'Quel général carthaginois traversa les Alpes avec des éléphants pour attaquer Rome par le nord à la fin du IIIe siècle av. J.-C. ?'
WHERE id = 160;

-- #99 Gladiateurs : la question disait "interdit" alors que c'est le sport public officiel.
-- L'explanation reste valide, on refond juste la question.
UPDATE enigmas SET
  question = 'Quel type de combat opposait deux hommes armés dans les arènes romaines, sous les cris de la foule ?',
  explanation = REPLACE(explanation, 'une investissement', 'un investissement')
WHERE id = 99;

-- #195 Nerviens : occupaient le Hainaut, pas la Champagne (les Rèmes étaient en Champagne)
UPDATE enigmas SET
  question = 'Quel peuple belge, dont le territoire couvrait l''actuel Hainaut et le nord de la Gaule belgique, résista le plus longtemps à César selon ses propres écrits ?'
WHERE id = 195;

-- #242 Cratère de Vix : confusion litres/kg. 208 = poids en kg, capacité ~1100 L.
UPDATE enigmas SET
  answer = '1 100 litres',
  choices = '["1 100 litres", "200 litres", "500 litres", "2 000 litres"]'::jsonb,
  explanation = 'Le cratère de Vix (vers 500 av. J.-C.) mesure 1,64 m de hauteur et pèse 208 kg. Sa capacité est d''environ 1 100 litres. C''est le plus grand vase métallique connu de l''Antiquité. Fabriqué en Grande-Grèce (Laconie), il témoigne des réseaux d''échange entre élites celtiques et Méditerranée.'
WHERE id = 242;

-- #131 Taranis : c'est le dieu du tonnerre/ciel, pas du soleil (Belenos)
UPDATE enigmas SET
  question = 'Comment s''appelait le dieu gaulois du tonnerre, du ciel et de la roue cosmique ?'
WHERE id = 131;

-- #239 Sena : île au large de l'Armorique, pas embouchure de la Loire + concordance verbale
UPDATE enigmas SET
  question = 'Selon Strabon, quel peuple insulaire aux rites mystérieux vivait sur une île proche des côtes armoricaines ?',
  lore_text = REPLACE(lore_text, 'tisseraient des vents', 'tissaient des vents')
WHERE id = 239;

-- #285 partes romaines : thèse Malmendier est débattue, présenter comme telle
UPDATE enigmas SET
  explanation = REPLACE(
    explanation,
    'Certains historiens (Ulrike Malmendier) les considèrent comme les premières sociétés par actions de l''histoire.',
    'Selon certains historiens (Ulrike Malmendier), elles pourraient constituer un ancêtre lointain des sociétés par actions modernes — thèse débattue.'
  )
WHERE id = 285;

-- ============================================================
-- BLOC 1 — Typos cosmétiques
-- ============================================================

-- Famille "Empereuromain" (mots collés sans espace)
UPDATE enigmas SET question = REPLACE(question, 'Empereuromain', 'empereur') WHERE id IN (175, 177, 181);
UPDATE enigmas SET explanation = REPLACE(explanation, 'Empereuromain', 'empereur') WHERE id = 181;

-- Famille "emperor" (mot anglais resté)
UPDATE enigmas SET question = REPLACE(question, 'emperor', 'empereur') WHERE id IN (171, 126, 103);
UPDATE enigmas SET explanation = REPLACE(explanation, 'emperor', 'empereur') WHERE id = 101;

-- "empereurroma" (concaténation foirée)
UPDATE enigmas SET question = REPLACE(question, 'empereurroma', 'empereur') WHERE id = 163;

-- QCM cosmétiques
UPDATE enigmas SET choices = REPLACE(choices::text, '"Saturn"', '"Saturne"')::jsonb WHERE id = 165;
UPDATE enigmas SET choices = REPLACE(choices::text, '"L''Despotat de Mistra"', '"Le Despotat de Mistra"')::jsonb WHERE id = 301;

-- Typos lore_text
UPDATE enigmas SET lore_text = REPLACE(lore_text, 'premières pousces', 'premières pousses') WHERE id = 192;
UPDATE enigmas SET lore_text = REPLACE(lore_text, 'un tourbière', 'une tourbière') WHERE id IN (33, 240);
UPDATE enigmas SET lore_text = REPLACE(lore_text, 'tomba definitvement', 'tomba définitivement') WHERE id = 298;
UPDATE enigmas SET lore_text = REPLACE(lore_text, 'lac Trébie', 'sur la Trébie') WHERE id = 245;

-- Typos question
UPDATE enigmas SET question = REPLACE(question, 'étrangeait', 'étonnait') WHERE id = 252;
UPDATE enigmas SET question = REPLACE(question, 'hipodrome', 'hippodrome') WHERE id = 228;

-- Typos explanation
UPDATE enigmas SET explanation = REPLACE(explanation, 'un tourbière', 'une tourbière') WHERE id = 80;
UPDATE enigmas SET explanation = REPLACE(explanation, 'écrase les Ostrogoths', 'écrasa les Ostrogoths') WHERE id IN (118, 229);
UPDATE enigmas SET explanation = REPLACE(explanation, 'inaugurea', 'inaugura') WHERE id = 223;
UPDATE enigmas SET explanation = REPLACE(explanation, 'silicates alumino-alumineux', 'silicates alumineux') WHERE id = 280;
UPDATE enigmas SET explanation = REPLACE(explanation, 'évolèrent', 'évoluèrent') WHERE id = 292;
UPDATE enigmas SET explanation = REPLACE(explanation, 'à la Allia', 'à l''Allia') WHERE id = 130;
UPDATE enigmas SET explanation = REPLACE(explanation, 'roues votive', 'roues votives') WHERE id = 247;
