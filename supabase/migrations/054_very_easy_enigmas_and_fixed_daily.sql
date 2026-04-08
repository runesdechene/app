-- 054_very_easy_enigmas_and_fixed_daily.sql
-- 1. Ajouter 'very_easy' comme difficulté
-- 2. Générer des énigmes very_easy (mix QCM + libre) sur les 4 héritages
-- 3. Convertir quelques medium en champ libre
-- 4. Quotidiennes = very_easy, easy, medium (fixées par jour)
-- 5. Fragments gardent easy, medium, hard (aléatoire)

-- ============================================================
-- 1. Autoriser very_easy dans la contrainte
-- ============================================================
ALTER TABLE enigmas DROP CONSTRAINT IF EXISTS enigmas_difficulty_check;
ALTER TABLE enigmas ADD CONSTRAINT enigmas_difficulty_check
  CHECK (difficulty IN ('very_easy', 'easy', 'medium', 'hard'));

-- Settings pour very_easy
INSERT INTO app_settings (key, value) VALUES
  ('enigma_influence_very_easy', '2'),
  ('enigma_erudition_very_easy', '1')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Énigmes very_easy — culture générale accessible
-- ============================================================

-- Celtique
INSERT INTO enigmas (type, difficulty, heritage_id, format, question, lore_text, choices, answer, explanation, active) VALUES
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel arbre est sacré chez les Celtes et a donné son nom aux druides ?',
 'Dans les forêts de Gaule, un arbre était vénéré par-dessus tous les autres...',
 '["Le chêne", "Le sapin", "Le bouleau", "L''olivier"]',
 'Le chêne',
 'Le mot "druide" vient du gaulois "dru-wid", signifiant "celui qui connaît le chêne". Le chêne était l''arbre sacré par excellence chez les Celtes.',
 true),

('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Comment appelle-t-on les prêtres et sages de la civilisation celtique ?',
 'Ils étaient à la fois juges, médecins, poètes et gardiens du savoir...',
 '["Les druides", "Les centurions", "Les scaldes", "Les moines"]',
 'Les druides',
 'Les druides formaient la classe savante de la société celtique. Ils transmettaient leur savoir oralement, refusant l''écriture pour les textes sacrés.',
 true),

('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel héros celtique est célèbre pour sa force surhumaine et son chien de garde ?',
 'Son vrai nom était Sétanta, mais un exploit de jeunesse lui donna un nouveau nom...',
 '["Cú Chulainn", "Vercingétorix", "Brennus", "Boudicca"]',
 'Cú Chulainn',
 'Cú Chulainn, "le chien de Culann", est le plus grand héros de la mythologie irlandaise. Enfant, il tua le chien de garde du forgeron Culann et prit sa place.',
 true),

('daily', 'very_easy', 'faction-celtique', 'free',
 'Quel chef gaulois a mené la résistance contre Jules César à Alésia ?',
 'En 52 avant J.-C., un jeune chef arverne rassembla les tribus gauloises pour un dernier combat...',
 NULL,
 'Vercingétorix',
 'Vercingétorix, chef des Arvernes, unifia les tribus gauloises contre Rome. Sa reddition à Alésia marqua la fin de l''indépendance gauloise.',
 true),

-- Nordique
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment s''appelle le dieu du tonnerre dans la mythologie nordique ?',
 'Armé de son marteau, il protège les hommes et les dieux contre les géants...',
 '["Thor", "Odin", "Loki", "Freyr"]',
 'Thor',
 'Thor, fils d''Odin, est le dieu du tonnerre. Son marteau Mjöllnir est l''arme la plus puissante des neuf mondes.',
 true),

('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment appelle-t-on les guerriers vikings qui combattaient dans une fureur sacrée ?',
 'Vêtus de peaux d''ours ou de loup, ils entraient dans une transe de combat terrifiante...',
 '["Les berserkers", "Les druides", "Les légionnaires", "Les samouraïs"]',
 'Les berserkers',
 'Les berserkers (de "ber-serkr", peau d''ours) étaient des guerriers d''élite qui combattaient dans un état de fureur quasi-surnaturel.',
 true),

('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom du grand arbre qui relie les neuf mondes dans la mythologie nordique ?',
 'Ses racines plongent dans trois puits de sagesse, ses branches touchent le ciel...',
 '["Yggdrasil", "Bifröst", "Valhalla", "Midgard"]',
 'Yggdrasil',
 'Yggdrasil est le frêne cosmique qui soutient les neuf mondes. Un aigle vit à sa cime, un serpent ronge ses racines.',
 true),

('daily', 'very_easy', 'faction-nordique', 'free',
 'Comment s''appelle le paradis des guerriers morts au combat dans la mythologie nordique ?',
 'Les valkyries y emmenaient les plus braves, tombés l''épée à la main...',
 NULL,
 'Valhalla',
 'Le Valhalla (Valhöll, "hall des occis") est la demeure d''Odin où festoient les einherjar, les guerriers tombés au combat, en attendant le Ragnarök.',
 true),

-- Romaine
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel célèbre amphithéâtre de Rome accueillait les combats de gladiateurs ?',
 'Inauguré en 80 après J.-C., il pouvait accueillir plus de 50 000 spectateurs...',
 '["Le Colisée", "Le Panthéon", "Le Circus Maximus", "Les Thermes de Caracalla"]',
 'Le Colisée',
 'Le Colisée (amphithéâtre Flavien) est le plus grand amphithéâtre jamais construit. Les jeux pouvaient durer des semaines entières.',
 true),

('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel général romain a conquis la Gaule et franchi le Rubicon ?',
 'Ses légions ont soumis la Gaule en huit ans de campagne. Puis il marcha sur Rome elle-même...',
 '["Jules César", "Auguste", "Néron", "Marc Aurèle"]',
 'Jules César',
 'Jules César conquit la Gaule entre 58 et 50 av. J.-C. En franchissant le Rubicon en 49 av. J.-C., il déclencha la guerre civile qui fit de lui le maître de Rome.',
 true),

('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quelle langue parlaient les Romains ?',
 'Cette langue a donné naissance au français, à l''espagnol, à l''italien et au portugais...',
 '["Le latin", "Le grec", "L''étrusque", "Le gaulois"]',
 'Le latin',
 'Le latin était la langue de Rome. En se transformant au fil des siècles, il a donné naissance aux langues romanes que nous parlons aujourd''hui.',
 true),

('daily', 'very_easy', 'faction-romaine', 'free',
 'Quel volcan a enseveli la ville de Pompéi en 79 après J.-C. ?',
 'En un seul jour, une cité romaine prospère fut engloutie sous les cendres...',
 NULL,
 'Le Vésuve',
 'L''éruption du Vésuve le 24 octobre 79 ensevelit Pompéi et Herculanum. Les fouilles, commencées au XVIIIe siècle, ont révélé une ville figée dans le temps.',
 true),

-- Byzantine
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quelle ville était la capitale de l''Empire byzantin ?',
 'Fondée par un empereur romain, elle fut le carrefour entre l''Europe et l''Asie pendant mille ans...',
 '["Constantinople", "Athènes", "Alexandrie", "Jérusalem"]',
 'Constantinople',
 'Constantinople (aujourd''hui Istanbul) fut fondée par Constantin Ier en 330. Capitale de l''Empire byzantin pendant plus de 1000 ans, elle tomba aux mains des Ottomans en 1453.',
 true),

('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quelle célèbre basilique de Constantinople est devenue mosquée puis musée ?',
 'Chef-d''œuvre d''architecture, sa coupole semblait flotter dans les airs...',
 '["Sainte-Sophie", "Saint-Pierre", "Notre-Dame", "Saint-Marc"]',
 'Sainte-Sophie',
 'Sainte-Sophie (Hagia Sophia), construite en 537 sous Justinien, resta la plus grande cathédrale du monde pendant près de mille ans.',
 true),

('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel empereur romain a fondé Constantinople ?',
 'Premier empereur chrétien, il déplaça la capitale de l''Empire vers l''Orient...',
 '["Constantin Ier", "Justinien", "Théodose", "Dioclétien"]',
 'Constantin Ier',
 'Constantin Ier (272-337) fonda Constantinople en 330 sur le site de l''ancienne Byzance. Il fut le premier empereur à se convertir au christianisme.',
 true),

('daily', 'very_easy', 'faction-byzantine', 'free',
 'Comment appelle-t-on les images sacrées peintes sur bois, typiques de l''art byzantin ?',
 'Dans les églises d''Orient, ces images dorées étaient vénérées comme des fenêtres vers le divin...',
 NULL,
 'Les icônes',
 'Les icônes sont des peintures religieuses sur panneaux de bois, caractéristiques de l''art byzantin et orthodoxe. La crise iconoclaste (726-843) divisa l''Empire sur leur vénération.',
 true);

-- ============================================================
-- 3. Convertir quelques medium existantes en champ libre
-- ============================================================
UPDATE enigmas SET format = 'free', choices = NULL
WHERE type = 'daily' AND difficulty = 'medium' AND format = 'qcm'
AND id IN (
  SELECT id FROM enigmas
  WHERE type = 'daily' AND difficulty = 'medium' AND format = 'qcm'
  ORDER BY RANDOM()
  LIMIT 5
);

-- ============================================================
-- 4. get_daily_enigma — questions fixées par jour + very_easy/easy/medium
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_day_seed INT;
  v_answered_difficulties TEXT[];
  v_diff TEXT;
  v_enigma RECORD;
  v_result JSON[] := '{}';
  v_candidates INT[];
  v_pick_idx INT;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;
  -- Seed déterministe basé sur la date (même questions pour tout le monde ce jour)
  v_day_seed := (EXTRACT(EPOCH FROM v_today)::INT / 86400);

  -- Quelles difficultés ont déjà été répondues aujourd'hui ?
  SELECT ARRAY_AGG(DISTINCT e.difficulty) INTO v_answered_difficulties
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  v_answered_difficulties := COALESCE(v_answered_difficulties, '{}');

  -- Si les 3 sont répondues
  IF ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  -- Pour chaque difficulté non répondue, choisir l'énigme du jour (déterministe)
  FOREACH v_diff IN ARRAY ARRAY['very_easy', 'easy', 'medium']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    -- Collecter les IDs de cette difficulté, triés pour stabilité
    SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
    FROM enigmas
    WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff;

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      CONTINUE;
    END IF;

    -- Pick déterministe : day_seed mod nombre d'énigmes
    v_pick_idx := (v_day_seed % array_length(v_candidates, 1)) + 1;

    SELECT * INTO v_enigma FROM enigmas WHERE id = v_candidates[v_pick_idx];

    IF v_enigma.id IS NOT NULL THEN
      v_result := array_append(v_result, json_build_object(
        'id', v_enigma.id,
        'difficulty', v_enigma.difficulty,
        'loreText', v_enigma.lore_text,
        'question', v_enigma.question,
        'format', v_enigma.format,
        'choices', v_enigma.choices,
        'heritageId', v_enigma.heritage_id
      ));
    END IF;
  END LOOP;

  IF array_length(v_result, 1) IS NULL OR array_length(v_result, 1) = 0 THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'enigmas', (SELECT json_agg(elem) FROM unnest(v_result) AS elem),
    'answeredToday', v_answered_difficulties
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;
