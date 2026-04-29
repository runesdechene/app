-- 010_enigmes_grecques.sql
-- WHY : Premier batch d'énigmes transverses (heritage_id = NULL, theme = 'grecque').
-- 32 énigmes sur la Grèce Antique avec angle historique + occulte (peu mythologique).
-- Teaser collection grecque RdC sortie le 12 mai 2026 à Écho & Merveilles :
-- - Motif Hoplite : énigmes #1, #10, #18, #21, #30
-- - Motif Hécate : énigmes #15, #19, #27
-- Sources : Hérodote, Thucydide, Plutarque, Diogène Laërce, Pline l'Ancien
-- Ton resserré par Uriel : questions courtes, lore immersif, explanations laconiques.

INSERT INTO enigmas (type, difficulty, heritage_id, theme, format, question, lore_text, choices, answer, explanation, active) VALUES

-- ============================================================
-- VERY_EASY (8)
-- ============================================================

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'Quelle cité grecque antique était célèbre pour son éducation militaire austère, l''agôgê, imposée à tous les jeunes garçons dès l''âge de sept ans ?',
 'Là où d''autres cités élevaient des orateurs, celle-ci forgeait des guerriers. Dès l''enfance, le froid, la faim et le silence devenaient des maîtres. On y apprenait à survivre, à obéir, et surtout à ne jamais faillir.',
 '["Athènes", "Sparte", "Thèbes", "Corinthe"]'::jsonb,
 'Sparte',
 'L''agôgê spartiate formait des citoyens-soldats d''une discipline extrême, piliers de la puissance lacédémonienne.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'En quel lieu se déroulèrent les premiers Jeux panhelléniques attestés à partir de 776 av. J.-C. ?',
 'Tous les quatre ans, les guerres se taisaient. Les hommes se mesuraient nus sous le regard des dieux, cherchant non la richesse, mais la gloire impérissable.',
 '["Delphes", "Olympie", "Némée", "Isthme de Corinthe"]'::jsonb,
 'Olympie',
 'Les Jeux d''Olympie honoraient Zeus et rassemblaient tout le monde grec dans une trêve sacrée.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'Quelle bataille de 490 av. J.-C. vit les Athéniens repousser une invasion perse ?',
 'Face à un empire immense, une poignée d''hommes fit un choix insensé : courir vers l''ennemi. Le choc fut brutal, décisif — et l''histoire bascula.',
 '["Salamine", "Marathon", "Platées", "Thermopyles"]'::jsonb,
 'Marathon',
 'Une charge rapide et inhabituelle permit aux Athéniens de briser les lignes perses.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'Quel régime politique fut institué à Athènes à la fin du VIe siècle av. J.-C. par Clisthène ?',
 'Le pouvoir quitta les lignées anciennes pour descendre dans la foule des citoyens. Une expérience fragile, audacieuse — donner la voix à ceux qui n''avaient jamais gouverné.',
 '["L''oligarchie", "La démocratie", "La tyrannie", "La monarchie élective"]'::jsonb,
 'La démocratie',
 'Elle émerge progressivement avant d''être structurée par Clisthène.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'free',
 'Quel temple domine l''Acropole d''Athènes ?',
 'Dressé au sommet de la cité, il veille depuis des millénaires. Ses colonnes semblent droites, mais trompent l''œil — comme si les hommes avaient voulu rivaliser avec la perfection divine.',
 NULL,
 'Le Parthénon',
 'Construit sous Périclès et dédié à Athéna, il demeure le sommet de l''architecture dorique.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'Quelle ligue maritime dirigée par Athènes fut fondée en 478 av. J.-C. ?',
 'Une alliance née de la peur devint lentement un empire. L''or sacré quitta son île pour nourrir la puissance d''une seule cité.',
 '["Ligue du Péloponnèse", "Ligue de Délos", "Ligue de Corinthe", "Ligue ionienne"]'::jsonb,
 'Ligue de Délos',
 'Son trésor, d''abord déposé sur l''île sacrée d''Apollon, fut transféré à Athènes par Périclès.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'qcm',
 'Quel système d''écriture mycénien a été déchiffré en 1952 ?',
 'Des signes oubliés, figés dans l''argile brûlée. Pendant des siècles, ils gardèrent le silence — jusqu''à ce qu''un homme entende à nouveau la voix des premiers Grecs.',
 '["Linéaire A", "Linéaire B", "Hiéroglyphique crétois", "Cypriote"]'::jsonb,
 'Linéaire B',
 'Michael Ventris y reconnut une forme archaïque du grec, faisant gagner mille ans à l''Histoire.',
 TRUE),

('daily', 'very_easy', NULL, 'grecque', 'free',
 'Quel sanctuaire abritait l''oracle le plus célèbre du monde grec ?',
 'On y montait en quête de réponses… et l''on redescendait chargé d''énigmes. Une voix, venue d''un autre plan, murmurait des vérités que nul ne comprenait sans trembler.',
 NULL,
 'Delphes',
 'La Pythie y rendait les oracles d''Apollon depuis un trépied placé au-dessus d''une faille sacrée.',
 TRUE),

-- ============================================================
-- EASY (9)
-- ============================================================

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quel philosophe fut condamné à boire la ciguë ?',
 'Il passa sa vie à interroger les autres — et finit condamné pour cela. Sa mort transforma la philosophie en destin.',
 '["Platon", "Anaxagore", "Socrate", "Diogène"]'::jsonb,
 'Socrate',
 'Accusé d''impiété et de corruption de la jeunesse en 399 av. J.-C., il refusa de fuir et but la ciguë selon la loi.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quelle bataille vit Léonidas résister à Xerxès ?',
 'Un passage étroit. Une armée infinie. Et quelques hommes décidés à mourir plutôt qu''à céder.',
 '["Salamine", "Marathon", "Thermopyles", "Platées"]'::jsonb,
 'Thermopyles',
 'En 480 av. J.-C., trois cents Spartiates et leurs alliés tinrent trois jours dans le défilé avant d''être encerclés.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Qui fonda l''Académie d''Athènes ?',
 'Sous des arbres sacrés, un homme enseignait que le monde visible n''était qu''une ombre.',
 '["Aristote", "Xénophon", "Platon", "Antisthène"]'::jsonb,
 'Platon',
 'Fondée vers 387 av. J.-C. sur un terrain dédié au héros Académos, l''école survécut près de neuf siècles.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quel roi conquit l''Empire perse ?',
 'Il avançait toujours plus loin, comme si aucune frontière ne pouvait contenir son ambition.',
 '["Philippe II", "Alexandre III", "Antigone Ier", "Séleucos Ier"]'::jsonb,
 'Alexandre III',
 'En dix ans (334-323 av. J.-C.), Alexandre le Grand brisa les armées achéménides et atteignit l''Indus.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'free',
 'Quel genre théâtral mettait en scène le destin tragique ?',
 'Sur scène, les hommes affrontaient les dieux — et perdaient toujours.',
 NULL,
 'La tragédie',
 'Eschyle, Sophocle et Euripide en restent les sommets, joués lors des Grandes Dionysies devant la cité entière.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quel philosophe vivait dans une jarre (souvent appelée tonneau) ?',
 'Il rejeta tout : richesse, confort, conventions. Il ne resta que la liberté nue.',
 '["Antisthène", "Diogène de Sinope", "Cratès de Thèbes", "Démonax"]'::jsonb,
 'Diogène de Sinope',
 'Le cynique le plus radical, qui aurait demandé à Alexandre de "s''ôter de son soleil".',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quelle déesse recevait des offrandes à la fin du mois lunaire aux carrefours ?',
 'Aux frontières du monde visible, on déposait pour elle des restes et des prières. Elle veille là où les chemins se croisent — et où les ombres s''épaississent.',
 '["Artémis", "Perséphone", "Hécate", "Déméter"]'::jsonb,
 'Hécate',
 'Déesse triple, gardienne des seuils et des mystères nocturnes, invoquée par les magiciennes du monde grec.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Qui est considéré comme le père de la médecine ?',
 'Il refusa les explications divines. Là où d''autres voyaient les dieux, il observa le corps.',
 '["Galien", "Asclépios", "Hippocrate", "Hérophile"]'::jsonb,
 'Hippocrate',
 'Fondateur de l''école de Cos au Vᵉ siècle av. J.-C., il fit de l''observation la première arme du soignant.',
 TRUE),

('daily', 'easy', NULL, 'grecque', 'qcm',
 'Quelle guerre opposa Athènes et Sparte ?',
 'Deux visions du monde s''affrontèrent — et l''une d''elles disparut dans la poussière des murailles abattues.',
 '["Guerres médiques", "Guerre du Péloponnèse", "Guerre de Corinthe", "Guerre lamiaque"]'::jsonb,
 'Guerre du Péloponnèse',
 'Vingt-sept ans de conflit (431-404 av. J.-C.) racontés par Thucydide, qui s''achevèrent par la capitulation d''Athènes.',
 TRUE),

-- ============================================================
-- MEDIUM (8)
-- ============================================================

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Quelle bataille brisa la suprématie spartiate en 371 av. J.-C. ?',
 'Un général osa rompre les règles. Ce jour-là, l''invincible vacilla.',
 '["Mantinée", "Chéronée", "Leuctres", "Coronée"]'::jsonb,
 'Leuctres',
 'Épaminondas inventa l''ordre oblique, concentrant son aile gauche pour broyer l''élite lacédémonienne.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Quels mystères initiatiques étaient les plus importants ?',
 'Ceux qui y entraient juraient de ne jamais parler. Pourtant, tous en ressortaient changés.',
 '["Mystères orphiques", "Mystères de Samothrace", "Mystères d''Éleusis", "Mystères dionysiaques"]'::jsonb,
 'Mystères d''Éleusis',
 'Célébrés en l''honneur de Déméter et Perséphone, ils initiaient depuis deux mille ans rois et empereurs.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Quel philosophe fonda une communauté à Crotone ?',
 'Entre science et mystère, il enseignait que l''âme ne meurt jamais.',
 '["Thalès", "Pythagore", "Anaximandre", "Empédocle"]'::jsonb,
 'Pythagore',
 'Sa communauté ésotérique mêlait mathématiques, métempsycose et règles de vie strictes — silence, végétarisme, interdit des fèves.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'free',
 'Quelle formation militaire hoplitique soudait les soldats en muraille de boucliers ?',
 'Une muraille d''hommes, soudés les uns aux autres. Ici, la force n''est rien sans le collectif.',
 NULL,
 'La phalange',
 'Chaque hoplon couvre le flanc droit du voisin : si un seul rompt, tous tombent.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Qui fonda le Lycée ?',
 'Il voulait tout comprendre : la nature, les hommes, le monde.',
 '["Théophraste", "Aristote", "Speusippe", "Xénocrate"]'::jsonb,
 'Aristote',
 'Élève vingt ans de Platon puis précepteur d''Alexandre, il fonda le Lycée à Athènes en 335 av. J.-C.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Qui fonda la dynastie lagide en Égypte ?',
 'Dans l''ombre d''Alexandre, il bâtit son propre royaume.',
 '["Séleucos", "Antigone", "Ptolémée", "Lysimaque"]'::jsonb,
 'Ptolémée',
 'Garde du corps d''Alexandre, il détourna le cortège funèbre du conquérant vers Alexandrie pour fonder sa légitimité.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Quel savant calcula π et défendit Syracuse ?',
 'Même la guerre ne détourna pas son esprit des nombres et des cercles.',
 '["Euclide", "Archimède", "Ératosthène", "Apollonius"]'::jsonb,
 'Archimède',
 'Ses machines de guerre tinrent les Romains à distance trois ans ; il mourut en traçant des cercles dans le sable.',
 TRUE),

('daily', 'medium', NULL, 'grecque', 'qcm',
 'Quel navire de guerre à trois rangs de rameurs faisait la puissance navale grecque ?',
 'Long, rapide, mortel. Il frappait avant même que l''ennemi ne comprenne.',
 '["Pentécontère", "Trière", "Quinquérème", "Liburne"]'::jsonb,
 'Trière',
 'Cent soixante-dix rameurs, un éperon de bronze à la proue : la trière fit d''Athènes une thalassocratie.',
 TRUE),

-- ============================================================
-- HARD (8)
-- ============================================================

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Quel philosophe affirmait que tout s''écoule ?',
 'Rien ne demeure. Tout change, tout brûle, tout devient autre.',
 '["Parménide", "Héraclite", "Anaximandre", "Xénophane"]'::jsonb,
 'Héraclite',
 'L''"Obscur" d''Éphèse : pour lui, le feu est principe et le logos régit le devenir.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Comment appelle-t-on les tablettes de malédiction grecques ?',
 'Gravées dans le plomb, pliées, enterrées… leurs mots descendaient vers les puissances souterraines.',
 '["Tablettes orphiques", "Defixiones", "Pinakes", "Ostraca"]'::jsonb,
 'Defixiones',
 'Plus de 1 700 ont été retrouvées : athlètes, plaideurs et amants y invoquaient Hécate ou Hermès Chthonios contre leurs rivaux.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Quelle école philosophique vient du Stoa ?',
 'Apprendre à rester droit, même lorsque le monde vacille.',
 '["Épicurisme", "Stoïcisme", "Scepticisme", "Cynisme"]'::jsonb,
 'Stoïcisme',
 'Zénon de Kition enseignait sous le portique peint de l''agora d''Athènes ; Marc Aurèle écrivait encore selon ses principes cinq siècles plus tard.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'free',
 'Quel naturaliste romain écrivit l''Histoire naturelle ?',
 'Il voulut tout consigner — plantes, pierres, remèdes — jusqu''à mourir face à la colère d''un volcan.',
 NULL,
 'Pline l''Ancien',
 '37 livres compilant tout le savoir antique sur la nature ; il périt à Stabies lors de l''éruption du Vésuve en 79 ap. J.-C.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Quelle armure en lin portaient les hoplites ?',
 'Plus légère que le bronze, elle permit à d''autres cités de lever leurs propres armées.',
 '["Linothorax", "Cuirasse anatomique", "Lorica hamata", "Squamata"]'::jsonb,
 'Linothorax',
 'Plusieurs couches de toile encollées — 3 à 5 kg seulement, presque aussi efficaces que le bronze contre flèches et lames.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Quelle bataille marque la domination macédonienne sur la Grèce ?',
 'Ce jour-là, les cités libres comprirent qu''une ère s''achevait.',
 '["Granique", "Chéronée", "Issos", "Mantinée"]'::jsonb,
 'Chéronée',
 'En 338 av. J.-C., Philippe II et le jeune Alexandre écrasèrent la coalition d''Athènes et Thèbes — le Bataillon Sacré thébain mourut sur place.',
 TRUE),

('daily', 'hard', NULL, 'grecque', 'qcm',
 'Quelle pratique athénienne permettait d''exiler un citoyen par vote ?',
 'Un nom gravé sur un tesson. Et un homme disparaissait de la cité.',
 '["L''ostracisme", "L''atimie", "Le pétalisme", "Le bannissement perpétuel"]'::jsonb,
 'L''ostracisme',
 'Chaque année, l''Ecclésia pouvait bannir dix ans un citoyen jugé trop puissant — son nom inscrit sur un *ostrakon*, tesson de poterie.',
 TRUE);
