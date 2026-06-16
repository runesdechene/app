-- 262_enigmes_grecques_ton.sql
-- WHY : passe didactique sur les enigmes grecques (charte de ton 2026-06-16).
-- Le batch mig 261 etait trop academique : sujets de specialiste (theurgie,
-- enagismata, metoikion, navarques obscurs) en loterie de 4 noms inconnus, qui
-- intimident au lieu d'emerveiller. On reformule 14 enigmas vers l'ICONIQUE
-- (cheval de Troie, Sphinx, Eureka, Atlantide, boite de Pandore...), au ton de
-- conteur, avec explication "mini-lecon". Repartition de difficulte preservee
-- (3 very_easy / 5 easy / 3 medium / 3 hard). De-duplique vs mig 010 + 261.
-- Charte : ~/citadelle .../📖 Ecriture/Ton des enigmes.md  + spec
-- docs/superpowers/specs/2026-06-16-enigmes-ton-didactique-design.md
--
-- Idempotence : one-shot par construction. Le WHERE matche le TEXTE de l'ancienne
-- question ; apres remplacement il ne matche plus -> re-execution = 0 update.

-- ============================================================
-- VERY_EASY (3)
-- ============================================================

-- (mig 261) Mardonios a Platees -> Phidippides, le coureur de Marathon
UPDATE enigmas SET
  question = 'Quel messager, dit-on, courut d''une traite jusqu''à Athènes pour annoncer la victoire de Marathon, avant de s''effondrer, mort d''épuisement ?',
  lore_text = 'Imagine un homme couvert de poussière et de sueur, le souffle en feu, qui dévale les collines sans jamais ralentir. Il porte une nouvelle plus précieuse que sa propre vie : l''envahisseur est repoussé. Il franchit les portes de la cité, crie sa joie… et tombe.',
  choices = '["Phidippidès","Léonidas","Thésée","Diogène"]'::jsonb,
  answer = 'Phidippidès',
  explanation = 'On raconte que Phidippidès courut les quelque 40 km de Marathon à Athènes pour crier « Nenikékamen ! » (« Nous avons vaincu ! ») avant de mourir. C''est cette légende qui a donné son nom à notre marathon moderne, la course de 42 km créée pour les premiers Jeux olympiques de 1896.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%commandait les forces terrestres lors de la bataille%';

-- (mig 261) l'Apella -> origine du mot "laconique"
UPDATE enigmas SET
  question = 'Les Spartiates étaient célèbres pour répondre en très peu de mots, avec mordant. Quel adjectif français, tiré du nom de leur région, désigne encore une formule brève et tranchante ?',
  lore_text = 'À un ennemi qui menaçait : « Si j''entre en Laconie, je rase Sparte », les Spartiates répondirent un seul mot : « Si. » Toute leur culture tenait dans cet art de parler peu et de frapper juste.',
  choices = '["Laconique","Spartiate","Lapidaire","Sibyllin"]'::jsonb,
  answer = 'Laconique',
  explanation = '« Laconique » vient de la Laconie, la région de Sparte. Les Spartiates cultivaient la parole brève comme une arme. À Philippe de Macédoine, menaçant de tout détruire « s''il » entrait en Laconie, ils répondirent simplement : « Si. » Voilà pourquoi une formule courte et cinglante est dite laconique.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%assemblée des citoyens spartiates, composée des guerriers%';

-- (mig 261) bataille d'Ipsos -> le Colosse de Rhodes
UPDATE enigmas SET
  question = 'Quelle gigantesque statue de bronze, comptée parmi les Sept Merveilles du monde, veillait jadis sur le port de Rhodes ?',
  lore_text = 'Imagine un géant de bronze haut comme un immeuble, dressé face à la mer, étincelant sous le soleil. Les marins l''apercevaient de loin, salut éclatant à l''approche de l''île. Un tremblement de terre finit par le coucher, mais sa légende, elle, n''est jamais tombée.',
  choices = '["Le Colosse de Rhodes","Le Phare d''Alexandrie","La statue de Zeus à Olympie","Le géant de Délos"]'::jsonb,
  answer = 'Le Colosse de Rhodes',
  explanation = 'Le Colosse de Rhodes, érigé vers 280 av. J.-C., était une statue de bronze d''environ 30 m représentant le dieu-soleil Hélios. Il s''effondra lors d''un séisme une soixantaine d''années plus tard. Contrairement à la légende tenace, il n''enjambait pas l''entrée du port, jambes écartées : aucun navire ne passait entre ses pieds.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%scella le sort des Diadoques%';

-- ============================================================
-- EASY (5)
-- ============================================================

-- (mig 261) Ephialte -> Pericles
UPDATE enigmas SET
  question = 'Quel homme d''État guida Athènes à son apogée, fit reconstruire l''Acropole, et donna son nom au « siècle » le plus brillant de la cité ?',
  lore_text = 'Sous sa main, Athènes se couvre de marbre et d''idées. Les sculpteurs taillent le Parthénon, les philosophes débattent sur l''agora, les tragédies font pleurer des milliers de spectateurs. Jamais une cité n''avait rayonné d''un tel éclat.',
  choices = '["Périclès","Solon","Thémistocle","Clisthène"]'::jsonb,
  answer = 'Périclès',
  explanation = 'Périclès (v. 495-429 av. J.-C.) domina la vie politique athénienne près de trente ans. Il lança le chantier du Parthénon et fit d''Athènes le cœur intellectuel du monde grec. On parle encore du « siècle de Périclès » pour désigner cet âge d''or de la démocratie, de l''art et de la pensée.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%de la plupart de ses pouvoirs politiques en 462%';

-- (mig 261) les perieques -> les hilotes
UPDATE enigmas SET
  question = 'Sur quelle population asservie reposait toute l''économie de Sparte, libérant ses citoyens pour n''être que des guerriers ?',
  lore_text = 'Pendant que les Spartiates s''entraînaient au combat du matin au soir, d''autres labouraient leurs champs sans répit, sans liberté, sans espoir. Ils étaient bien plus nombreux que leurs maîtres, et la peur de leur révolte hantait Sparte comme une ombre permanente.',
  choices = '["Les hilotes","Les métèques","Les périèques","Les esclaves ioniens"]'::jsonb,
  answer = 'Les hilotes',
  explanation = 'Les hilotes étaient des serfs d''État, attachés à la terre, qui nourrissaient Sparte par leur travail forcé. Bien plus nombreux que les citoyens, ils leur permettaient de se consacrer entièrement à la guerre. Mais leur soulèvement était si redouté que Sparte vivait en état d''alerte permanent contre eux.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%qui vivaient autour de Sparte et servaient%';

-- (mig 261) orphisme "roue de la Genese" -> Persephone et les saisons
UPDATE enigmas SET
  question = 'Dans le mythe grec, l''hiver naît du chagrin de Déméter, déesse des moissons, quand sa fille est retenue aux Enfers. Comment se nomme cette fille, reine du royaume des morts ?',
  lore_text = 'Six mois par an, une jeune déesse remonte vers la lumière et la terre se couvre de fleurs : c''est le printemps, et sa mère exulte. Mais chaque automne, elle doit redescendre régner sur le royaume des ombres, et le monde, orphelin, s''endort sous le givre.',
  choices = '["Perséphone","Aphrodite","Athéna","Artémis"]'::jsonb,
  answer = 'Perséphone',
  explanation = 'Perséphone, fille de Déméter, fut enlevée par Hadès. Ayant goûté des grains de grenade aux Enfers, elle dut y passer une partie de l''année. Les Grecs expliquaient ainsi les saisons : quand Perséphone rejoint sa mère, c''est le printemps ; quand elle redescend, Déméter laisse la terre mourir, et c''est l''hiver.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Quel nom donnait-on à ce cycle%';

-- (mig 261) enagismata -> Cerbere
UPDATE enigmas SET
  question = 'Quel chien monstrueux à trois têtes gardait la porte des Enfers, empêchant les morts d''en ressortir ?',
  lore_text = 'Au seuil du royaume des ombres veille une bête effroyable : trois gueules béantes, une crinière de serpents, un grondement qui glace le sang. Il laisse entrer toutes les âmes, mais malheur à celle qui tenterait de rebrousser chemin vers la lumière.',
  choices = '["Cerbère","l''Hydre de Lerne","le Minotaure","Méduse"]'::jsonb,
  answer = 'Cerbère',
  explanation = 'Cerbère, le chien à trois têtes, gardait l''entrée des Enfers. Le dernier des douze travaux d''Héraclès consista justement à le capturer vivant et à le ramener au jour. Son nom est resté synonyme de gardien intraitable : on parle encore d''un « cerbère » pour un portier inflexible.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%offrandes versées dans des fosses ou sur des tombeaux%';

-- (mig 261) Iphicrate -> le cheval de Troie
UPDATE enigmas SET
  question = 'Par quelle ruse les Grecs s''emparèrent-ils enfin de Troie, après dix années de siège infructueux ?',
  lore_text = 'Las de dix ans de guerre, les Grecs feignent de partir et abandonnent sur la plage une gigantesque offrande de bois. Les Troyens, triomphants, la traînent à l''intérieur de leurs murs réputés imprenables. La nuit venue, le piège se referme…',
  choices = '["Un cheval de bois rempli de soldats","Un tunnel creusé sous les remparts","Un incendie allumé par des espions","Une trêve trahie pendant un banquet"]'::jsonb,
  answer = 'Un cheval de bois rempli de soldats',
  explanation = 'Sur une idée d''Ulysse, les Grecs bâtirent un immense cheval de bois creux où se cachèrent leurs meilleurs guerriers. Introduit dans Troie comme un trophée, il livra la cité de l''intérieur. De là vient l''expression « cheval de Troie », reprise jusqu''au nom des logiciels malveillants qui se dissimulent pour mieux frapper.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%révolutionna la guerre en réformant%';

-- ============================================================
-- MEDIUM (3)
-- ============================================================

-- (mig 261) Leotychidas a Mycale -> les Immortels perses
UPDATE enigmas SET
  question = 'Comment appelait-on le corps d''élite de l''armée perse, maintenu en permanence à exactement dix mille hommes ?',
  lore_text = 'Dès qu''un de ces guerriers tombait, mort, blessé ou malade, un autre prenait aussitôt sa place. Aux yeux des Grecs stupéfaits, leur nombre ne diminuait jamais, comme si la mort n''avait aucune prise sur eux.',
  choices = '["Les Immortels","Les Compagnons","Les hypaspistes","La garde royale spartiate"]'::jsonb,
  answer = 'Les Immortels',
  explanation = 'Les « Immortels » formaient la garde d''élite du Grand Roi perse. Hérodote raconte que leur effectif était fixé à 10 000 : chaque homme tombé était immédiatement remplacé, donnant l''illusion d''une troupe que la mort n''entamait jamais. Ils combattirent aux Thermopyles face aux 300 de Léonidas.',
  difficulty = 'medium', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%commandait la flotte lors de la bataille de Mycale%';

-- (mig 261) mistophorie -> l'enigme du Sphinx / Oedipe
UPDATE enigmas SET
  question = 'Devant Thèbes, un monstre ailé dévorait quiconque échouait à résoudre son énigme. Quel héros la résolut enfin et délivra la cité ?',
  lore_text = '« Quel être marche à quatre pattes le matin, à deux le midi, à trois le soir ? » Tous ceux qui se trompaient finissaient dévorés. Un voyageur s''avança, regarda la créature droit dans les yeux, et donna la réponse qui la fit se précipiter dans le vide.',
  choices = '["Œdipe","Thésée","Persée","Jason"]'::jsonb,
  answer = 'Œdipe',
  explanation = 'La réponse à l''énigme du Sphinx était : l''Homme, qui rampe à quatre pattes enfant, marche sur deux jambes adulte, et s''appuie sur une canne (la troisième « patte ») vieillard. Œdipe la trouva et libéra Thèbes ; vaincu, le Sphinx se jeta dans l''abîme. C''est la plus célèbre énigme de toute l''Antiquité.',
  difficulty = 'medium', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%les citoyens pauvres purent siéger%';

-- (mig 261) Erasistrate -> Eureka ! (poussee d'Archimede) [reste format free]
UPDATE enigmas SET
  question = 'Quel mot Archimède aurait-il crié, nu et ruisselant, en jaillissant de son bain après avoir compris comment mesurer le volume d''une couronne ?',
  lore_text = 'Le roi le soupçonnait : son orfèvre avait-il mêlé de l''argent à l''or de sa couronne sacrée ? Plongé dans son bain, le savant vit l''eau déborder à mesure qu''il s''enfonçait, et la solution lui apparut d''un coup. On raconte qu''il courut tout nu dans les rues de Syracuse, fou de joie.',
  choices = NULL,
  answer = 'Eurêka',
  explanation = '« Eurêka ! » signifie « J''ai trouvé ! » en grec. En entrant dans son bain, Archimède comprit qu''un corps plongé dans l''eau en déplace un volume égal au sien : il pouvait donc mesurer le volume de la couronne et vérifier si l''or était pur. C''est le principe de la poussée d''Archimède, et « eurêka » désigne depuis l''éclair du génie.',
  difficulty = 'medium', format = 'free'
WHERE theme = 'grecque' AND question LIKE '%distingua veines et artères%';

-- ============================================================
-- HARD (3)
-- ============================================================

-- (mig 261) Democrite connaissance batarde/legitime -> l'allegorie de la caverne
UPDATE enigmas SET
  question = 'Dans la plus célèbre image de Platon, des prisonniers enchaînés au fond d''une caverne ne voient que des ombres projetées sur un mur. Que représentent ces ombres ?',
  lore_text = 'Depuis leur naissance, ils sont enchaînés face à une paroi, incapables de tourner la tête. Derrière eux, un feu projette des silhouettes qu''ils prennent pour la seule réalité. Le jour où l''un d''eux s''évade et découvre le soleil, il mesure l''étendue de leur illusion. Mais qui le croira, à son retour ?',
  choices = '["Le monde sensible, simple reflet des vraies Idées","Les rêves envoyés par les dieux","Les souvenirs de nos vies antérieures","Les illusions semées par les sophistes"]'::jsonb,
  answer = 'Le monde sensible, simple reflet des vraies Idées',
  explanation = 'Pour Platon, les ombres sont le monde que perçoivent nos sens : un pâle reflet de la réalité véritable, celle des Idées éternelles (le Beau, le Juste, le Bien). Le prisonnier qui s''évade et voit le soleil, c''est le philosophe qui accède à la connaissance, et peine ensuite à la transmettre à ceux restés dans l''ombre.',
  difficulty = 'hard', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Démocrite distinguait deux types de connaissance%';

-- (mig 261) theurgie de Jamblique -> l'Atlantide
UPDATE enigmas SET
  question = 'Quelle île-continent engloutie, civilisation prodigieuse punie par les dieux, doit toute son existence aux écrits d''un seul philosophe grec ?',
  lore_text = 'Une cité d''anneaux concentriques, riche à n''en plus finir, puissante au point de défier le monde, puis avalée par les flots en un jour et une nuit funestes. Depuis, on la cherche partout. Pourtant, une seule source antique en parle, et nul ne sait s''il faut y voir une histoire vraie ou une parabole.',
  choices = '["L''Atlantide, chez Platon","Thulé, chez Pythéas","L''Hyperborée, chez Hérodote","L''Eldorado grec, chez Strabon"]'::jsonb,
  answer = 'L''Atlantide, chez Platon',
  explanation = 'L''Atlantide n''apparaît que dans deux dialogues de Platon, le Timée et le Critias, qui la décrivent comme une puissance maritime engloutie « en un seul jour », sans doute pour servir de leçon sur l''orgueil des cités. Aucune autre source antique ne la mentionne, ce qui n''a jamais empêché des siècles de chercheurs de la traquer.',
  difficulty = 'hard', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%La théurgie, telle que développée par Jamblique%';

-- (mig 261) metoikion (impot des metheques) -> la boite de Pandore
UPDATE enigmas SET
  question = 'Quand Pandore ouvrit la jarre qui libéra tous les maux sur l''humanité, qu''y resta-t-il, seul, accroché au fond ?',
  lore_text = 'Les dieux l''avaient façonnée, première femme, et lui avaient confié un vase scellé en lui interdisant de l''ouvrir. La curiosité l''emporta. Dans un tourbillon s''échappèrent la maladie, la vieillesse, la guerre, la peine… Mais une chose, plus lente, demeura au bord du récipient.',
  choices = '["L''espérance","La beauté","La sagesse","Le feu sacré"]'::jsonb,
  answer = 'L''espérance',
  explanation = 'Au fond de la jarre de Pandore (une jarre, pithos, plus tard mal traduite en « boîte ») il ne resta que l''Espérance, Elpis. Les Grecs en débattaient déjà : l''espoir est-il l''ultime consolation laissée aux hommes, ou le dernier des maux, celui qui nous fait endurer tous les autres ? À toi d''en juger.',
  difficulty = 'hard', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%impôt spécifique que les métèques devaient verser%';
