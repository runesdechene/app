-- 263_enigmes_grecques_ton_faible_niveau.sql
-- WHY : 2e passe charte de ton (2026-06-16) sur les enigmes grecques de FAIBLE
-- niveau (very_easy + easy) du batch mig 261. 7 violateurs nets (loterie de noms
-- obscurs / sujets de specialiste) + 8 borderline reformules vers les grands
-- mythes iconiques (Icare, Midas, fil d'Ariane, Pegase, Promethee, Ulysse & le
-- cyclope, talon d'Achille, Toison d'or, Homere, Sisyphe, Heracles, Narcisse,
-- pomme de discorde, Amazones) ; Solon adouci en gardant le sujet.
-- Repartition de difficulte preservee (5 very_easy / 10 easy), tout en qcm.
-- De-duplique vs mig 010 + 261 + 262. Mig 010 (deja iconique) non touchee.
-- Charte : ~/citadelle .../📖 Ecriture/Ton des enigmes.md
--
-- Idempotence : one-shot par construction (WHERE matche le texte de l'ancienne
-- question ; apres remplacement il ne matche plus -> re-execution = 0 update).

-- ============================================================
-- VERY_EASY (5)
-- ============================================================

-- (mig 261) Anaximene / l'air -> Icare
UPDATE enigmas SET
  question = 'Quel jeune homme, s''envolant avec des ailes de cire fixées dans son dos, s''approcha trop du soleil et chuta dans la mer ?',
  lore_text = 'Enfermé avec son père dans un labyrinthe, il rêvait de ciel. Quand vint le moment de fuir par les airs, son père le supplia de voler à mi-hauteur. Mais l''ivresse de l''envol fut la plus forte : il monta, monta encore, jusqu''à ce que la cire fonde.',
  choices = '["Icare","Phaéton","Ganymède","Bellérophon"]'::jsonb,
  answer = 'Icare',
  explanation = 'Icare et son père Dédale s''échappèrent du labyrinthe de Crète grâce à des ailes de plumes et de cire. Grisé, Icare s''approcha trop du soleil : la cire fondit et il tomba dans la mer qui porte aujourd''hui son nom. Sa chute reste le symbole de l''orgueil qui perd ceux qui oublient toute mesure.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Selon Anaximène, quel élément primordial%';

-- (mig 261) l'Ecclesia -> Midas
UPDATE enigmas SET
  question = 'Quel roi obtint le pouvoir de transformer en or tout ce qu''il touchait, avant de réaliser avec horreur qu''il ne pouvait plus ni boire ni manger ?',
  lore_text = 'Un dieu reconnaissant lui offrit d''exaucer son vœu le plus cher. Il demanda l''or, encore l''or, toujours l''or. Au début, quel émerveillement : roses, coupes et murs se changeaient en métal précieux sous ses doigts. Puis vint l''heure du repas…',
  choices = '["Midas","Crésus","Tantale","Sardanapale"]'::jsonb,
  answer = 'Midas',
  explanation = 'Le roi Midas reçut de Dionysos le pouvoir de changer en or tout ce qu''il touchait. Ravi, il déchanta vite : sa nourriture aussi se métamorphosait, le condamnant à mourir de faim au milieu de ses trésors. Il supplia qu''on lui retire ce don. Le « toucher de Midas » désigne depuis une réussite éclatante… ou une avidité qui se retourne contre soi.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%assemblée de tous les citoyens athéniens qui votait les lois%';

-- (mig 261) la pentecontere -> le fil d'Ariane
UPDATE enigmas SET
  question = 'Quel fil, déroulé dans les couloirs du labyrinthe, permit à Thésée de retrouver la sortie après avoir vaincu le Minotaure ?',
  lore_text = 'Au cœur du palais de Crète serpentait un dédale dont nul ne ressortait vivant. La jeune Ariane, amoureuse du héros, lui glissa une pelote avant qu''il n''y pénètre. Il n''eut qu''à la dérouler en avançant… puis à la suivre en sens inverse, le monstre abattu.',
  choices = '["Le fil d''Ariane","Le fil d''or de Pénélope","La corde de Dédale","Le ruban d''Athéna"]'::jsonb,
  answer = 'Le fil d''Ariane',
  explanation = 'Le « fil d''Ariane » sauva Thésée du labyrinthe où l''attendait le Minotaure, mi-homme mi-taureau. L''expression désigne aujourd''hui tout repère qui aide à se sortir d''un problème complexe, à ne pas perdre le fil, exactement comme dans un dédale.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%à cinquante rameurs, précéda la grande trirème%';

-- (mig 261) Solon / seisachtheia -> Solon, adouci (sujet conserve)
UPDATE enigmas SET
  question = 'Quel sage législateur libéra les Athéniens tombés en esclavage à cause de leurs dettes, jetant les bases d''une cité plus juste ?',
  lore_text = 'La cité étouffait : des hommes libres, ruinés, avaient été vendus comme du bétail pour quelques sacs de grain. Un homme respecté de tous accepta la lourde tâche de tout réformer. Il effaça les dettes, brisa les chaînes, et refusa pourtant de devenir tyran quand on le lui offrit.',
  choices = '["Solon","Dracon","Clisthène","Thésée"]'::jsonb,
  answer = 'Solon',
  explanation = 'Solon (vers 594 av. J.-C.), compté parmi les Sept Sages de la Grèce, abolit l''esclavage pour dettes et adoucit des lois d''une dureté légendaire (celles de Dracon, d''où notre mot « draconien »). En refusant le pouvoir absolu, il ouvrit la voie qui mènera, un siècle plus tard, à la démocratie athénienne.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%réforma les classes censitaires%';

-- (mig 261) Koine -> Pegase
UPDATE enigmas SET
  question = 'Quel cheval ailé, né du sang de la Gorgone Méduse, devint la monture des héros et le compagnon des poètes ?',
  lore_text = 'Lorsque le héros trancha la tête du monstre aux cheveux de serpents, un prodige jaillit de son sang : un cheval d''un blanc éclatant, doté de grandes ailes. D''un seul coup de sabot, il fit même jaillir une source sacrée chère aux poètes.',
  choices = '["Pégase","le centaure Chiron","le taureau de Crète","la biche de Cérynie"]'::jsonb,
  answer = 'Pégase',
  explanation = 'Pégase, le cheval ailé, naquit du sang de Méduse décapitée par Persée. Il aida le héros Bellérophon à terrasser la Chimère. D''un coup de sabot, il fit surgir la source Hippocrène, réputée inspirer les poètes : « enfourcher Pégase » signifie encore se laisser porter par l''inspiration.',
  difficulty = 'very_easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Comment appelait-on le grec commun parlé dans tout le monde hellénistique%';

-- ============================================================
-- EASY (10)
-- ============================================================

-- (mig 261) l'Heliee -> Promethee
UPDATE enigmas SET
  question = 'Quel Titan déroba le feu aux dieux pour l''offrir aux hommes, et fut puni en ayant le foie dévoré chaque jour par un aigle ?',
  lore_text = 'Les hommes grelottaient dans l''obscurité, privés de la flamme que les dieux gardaient jalousement. Un Titan rebelle eut pitié d''eux : il déroba une étincelle et la leur apporta. Pour ce don, Zeus le fit enchaîner à un rocher, livré à un supplice sans fin.',
  choices = '["Prométhée","Atlas","Cronos","Épiméthée"]'::jsonb,
  answer = 'Prométhée',
  explanation = 'Prométhée (« le prévoyant ») vola le feu, et donc la civilisation, les arts et la technique, pour le donner aux humains. Zeus le condamna à être enchaîné, un aigle lui dévorant le foie chaque jour, repoussant chaque nuit. Il incarne le bienfaiteur révolté qui défie les puissants pour faire avancer l''humanité.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%composé de plusieurs centaines de jurés tirés au sort%';

-- (mig 261) Artemision -> Ulysse & le cyclope
UPDATE enigmas SET
  question = 'De quel géant à l''œil unique Ulysse creva-t-il l''œil avec un pieu pour s''échapper de sa caverne ?',
  lore_text = 'Prisonniers d''une grotte avec un monstre qui dévorait ses compagnons un à un, Ulysse imagina une ruse. Il enivra le géant, lui annonça se nommer « Personne », puis lui enfonça un pieu chauffé dans son œil unique. « Personne m''aveugle ! » hurla le monstre, et nul ne vint l''aider.',
  choices = '["Le cyclope Polyphème","le géant Antée","le Minotaure","Argos aux cent yeux"]'::jsonb,
  answer = 'Le cyclope Polyphème',
  explanation = 'Dans l''Odyssée, Ulysse aveugle le cyclope Polyphème, fils de Poséidon, puis s''échappe accroché sous le ventre des béliers. Sa ruse du nom « Personne » est restée célèbre, mais sa vantardise en partant lui vaudra la colère de Poséidon et dix ans d''errance avant de revoir Ithaque.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%les Grecs retardèrent-ils la flotte perse en 480%';

-- (mig 261) Theophraste / botanique -> le talon d'Achille
UPDATE enigmas SET
  question = 'Quel grand héros de la guerre de Troie n''était vulnérable qu''en un seul point de son corps, le talon ?',
  lore_text = 'Enfant, sa mère l''avait plongé dans un fleuve magique pour le rendre invincible. Mais elle le tenait par le talon, le seul endroit que l''eau n''avait pas touché. Des années plus tard, sous les murs de Troie, une flèche guidée par un dieu trouva précisément ce point.',
  choices = '["Achille","Hector","Ajax","Patrocle"]'::jsonb,
  answer = 'Achille',
  explanation = 'Trempé enfant dans le Styx par sa mère Thétis, Achille était invulnérable partout, sauf au talon par lequel elle l''avait tenu. C''est là qu''une flèche de Pâris le tua devant Troie. On parle encore du « talon d''Achille » pour le point faible secret d''une personne ou d''un système par ailleurs très solide.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%est considéré comme le fondateur de la botanique%';

-- (mig 261) Seleukos -> la Toison d'or / Jason
UPDATE enigmas SET
  question = 'Quel héros rassembla l''équipage des Argonautes pour partir conquérir la Toison d''or, au bout du monde connu ?',
  lore_text = 'Pour reconquérir son trône, un jeune prince devait rapporter une relique fabuleuse : la peau d''un bélier d''or, gardée par un dragon qui ne dormait jamais. Il fit construire un navire et réunit les plus grands héros de Grèce pour cette expédition aux confins du monde.',
  choices = '["Jason","Persée","Thésée","Bellérophon"]'::jsonb,
  answer = 'Jason',
  explanation = 'Jason mena les Argonautes, à bord du navire Argo, jusqu''en Colchide pour s''emparer de la Toison d''or. Il y parvint grâce à la magie de Médée, qui tomba amoureuse de lui. Cette quête est l''une des plus anciennes épopées grecques, bien antérieure à la guerre de Troie.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%fonda la dynastie qui régna sur la Syrie%';

-- (mig 261) Milet / revolte ionienne -> Homere
UPDATE enigmas SET
  question = 'Quel poète aveugle est, par la tradition, l''auteur des deux plus grandes épopées grecques : l''Iliade et l''Odyssée ?',
  lore_text = 'On ne sait presque rien de lui, ni où il naquit, ni même s''il exista vraiment. Pourtant deux poèmes immenses portent son nom depuis près de trois mille ans, récités de mémoire par des générations d''aèdes avant d''être couchés par écrit. La colère d''Achille, le retour d''Ulysse : tout commence avec lui.',
  choices = '["Homère","Hésiode","Virgile","Ésope"]'::jsonb,
  answer = 'Homère',
  explanation = 'On attribue à Homère l''Iliade (la guerre de Troie) et l''Odyssée (le retour d''Ulysse), fondations de toute la littérature occidentale. La tradition le dit aveugle et errant. Les historiens débattent encore de son existence réelle, la fameuse « question homérique », mais son influence, elle, est indiscutable.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Quelle cité ionienne déclencha la grande révolte contre la domination perse%';

-- (mig 261) Parmenide / l'Etre -> Sisyphe
UPDATE enigmas SET
  question = 'Quel roi rusé fut condamné à pousser éternellement un rocher au sommet d''une colline, d''où il retombe sans cesse ?',
  lore_text = 'Il avait osé tromper la Mort elle-même, l''enchaîner, et revenir des Enfers par la ruse. Les dieux, excédés, lui réservèrent un châtiment sans fin : hisser un énorme bloc de pierre en haut d''une pente. Chaque fois qu''il touche au but, le rocher roule de nouveau jusqu''en bas.',
  choices = '["Sisyphe","Tantale","Atlas","Ixion"]'::jsonb,
  answer = 'Sisyphe',
  explanation = 'Sisyphe, roi de Corinthe, fut puni pour avoir défié les dieux et la mort. Son rocher éternellement recommencé est devenu le symbole de l''effort absurde et sans fin : on parle d''un « travail de Sisyphe » pour une tâche pénible que rien n''achève jamais.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%le changement et le mouvement sont des illusions%';

-- (mig 261) Doryphore / Polyclete -> Heracles et les 12 travaux
UPDATE enigmas SET
  question = 'Quel héros, le plus fort de tous les mortels, dut accomplir douze travaux surhumains pour expier un terrible malheur ?',
  lore_text = 'Fils de Zeus, doté d''une force prodigieuse dès le berceau où il étrangla deux serpents, il fut frappé d''une folie qui lui fit commettre l''irréparable. Pour se racheter, un oracle lui imposa douze épreuves dont nul ne revenait : lion invincible, hydre à têtes multiples, et jusqu''à une descente aux Enfers.',
  choices = '["Héraclès (Hercule)","Thésée","Persée","Atalante"]'::jsonb,
  answer = 'Héraclès (Hercule)',
  explanation = 'Héraclès, Hercule chez les Romains, accomplit douze travaux légendaires : le lion de Némée, l''hydre de Lerne, les écuries d''Augias, la capture de Cerbère… Devenu le modèle du héros qui débarrasse le monde de ses monstres, il fut le seul mortel admis parmi les dieux de l''Olympe après sa mort.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%de Polyclète définissait les proportions idéales%';

-- (mig 261) Grandes Dionysies (saison) -> Narcisse
UPDATE enigmas SET
  question = 'Quel très beau jeune homme tomba amoureux de son propre reflet dans l''eau, au point de s''y laisser dépérir ?',
  lore_text = 'Il était d''une beauté telle que tous tombaient amoureux de lui, et il les dédaignait tous. Pour le punir, une déesse fit en sorte qu''il s''éprenne de la seule image qu''il ne pourrait jamais étreindre : la sienne, tremblant à la surface d''une source.',
  choices = '["Narcisse","Adonis","Ganymède","Hyacinthe"]'::jsonb,
  answer = 'Narcisse',
  explanation = 'Narcisse, incapable de se détacher de son reflet, se laissa mourir au bord de l''eau ; à sa place poussa la fleur qui porte son nom. De ce mythe vient le mot « narcissisme », l''amour excessif de soi. La nymphe Écho, qui l''aimait sans retour, n''en garda qu''une voix répétant les derniers mots.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Les Grandes Dionysies étaient un festival athénien dédié à Dionysos%';

-- (mig 261) apoikia -> la pomme de discorde
UPDATE enigmas SET
  question = 'Quel objet, lancé « à la plus belle » lors d''un banquet divin, déclencha la rivalité des déesses et, de fil en aiguille, la guerre de Troie ?',
  lore_text = 'Une seule déesse n''avait pas été conviée aux noces : celle de la Discorde. Vexée, elle se vengea d''un rien, un simple fruit doré jeté au milieu des convives, portant ces mots : « À la plus belle. » Trois déesses le revendiquèrent aussitôt, et le monde s''embrasa.',
  choices = '["La pomme de discorde","La toison d''or","Le bouclier d''Achille","Le casque d''Hadès"]'::jsonb,
  answer = 'La pomme de discorde',
  explanation = 'La déesse Éris jeta une pomme d''or « à la plus belle ». Héra, Athéna et Aphrodite se la disputèrent ; chargé d''arbitrer, le prince troyen Pâris choisit Aphrodite, qui lui promit Hélène, la plus belle femme du monde. Son enlèvement déclencha la guerre de Troie. Une « pomme de discorde » désigne depuis tout sujet qui sème la zizanie.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%qui envoyait des colons établir une nouvelle polis indépendante%';

-- (mig 261) peltaste / pelte -> les Amazones
UPDATE enigmas SET
  question = 'Comment appelait-on le peuple légendaire de femmes guerrières que les plus grands héros grecs affrontèrent au combat ?',
  lore_text = 'On les disait redoutables à l''arc et à cheval, vivant sans hommes aux confins du monde connu. Achille, Héraclès, Thésée : tous croisèrent un jour le fer avec ces cavalières intrépides. Les Grecs, fascinés et inquiets, les peignirent sur leurs temples comme l''image même de l''altérité guerrière.',
  choices = '["Les Amazones","Les Ménades","Les Walkyries","Les Gorgones"]'::jsonb,
  answer = 'Les Amazones',
  explanation = 'Les Amazones, peuple mythique de femmes guerrières, hantaient l''imaginaire grec comme un monde renversé. Héraclès dut s''emparer de la ceinture de leur reine Hippolyte ; Achille affronta la reine Penthésilée sous Troie. C''est en croyant en apercevoir que des explorateurs donnèrent plus tard son nom au fleuve Amazone.',
  difficulty = 'easy', format = 'qcm'
WHERE theme = 'grecque' AND question LIKE '%Les peltastes tiraient leur nom de quel équipement distinctif%';
