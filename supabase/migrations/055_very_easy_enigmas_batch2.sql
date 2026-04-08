-- 055_very_easy_enigmas_batch2.sql
-- ~60 énigmes very_easy QCM supplémentaires (15 par héritage)
-- Évite tous les sujets déjà couverts dans 054 et 018

INSERT INTO enigmas (type, difficulty, heritage_id, format, question, lore_text, choices, answer, explanation, active) VALUES

-- ═══════════════════════════════════════════════════════════════
-- FACTION CELTIQUE (15)
-- ═══════════════════════════════════════════════════════════════

-- C1
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel animal était considéré comme sacré et royal chez les Celtes ?',
 'Dans les forêts gauloises, croiser cet animal de bon augure était un présage de gloire...',
 '["Le sanglier", "Le loup", "Le cerf", "L''aigle"]',
 'Le sanglier',
 'Le sanglier était l''animal le plus emblématique des Celtes, symbole de bravoure et de puissance guerrière. Il ornait casques, boucliers et monnaies. Le festin du sanglier rôti était réservé aux guerriers les plus vaillants.',
 true),

-- C2
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Comment s''appelait la grande défaite gauloise face à Jules César en 52 av. J.-C. ?',
 'Sur ce plateau de Bourgogne, la résistance gauloise s''éteignit après un siège de plusieurs semaines...',
 '["La bataille d''Alésia", "La bataille de Gergovie", "La bataille de Magetobriga", "La bataille du Teutoburg"]',
 'La bataille d''Alésia',
 'La bataille d''Alésia marqua la fin de la résistance gauloise. César construisit deux lignes de fortifications en cercle pour piéger les assiégés et repousser les renforts. Vercingétorix capitula après plusieurs semaines.',
 true),

-- C3
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quelle était la monnaie principale des Gaulois ?',
 'Bien avant les deniers romains, les marchands gaulois échangeaient des pièces frappées à leur propre effigie...',
 '["Des pièces d''or et d''argent", "Du sel", "Des lingots de bronze", "Des peaux d''animaux"]',
 'Des pièces d''or et d''argent',
 'Les Gaulois frappaient leurs propres monnaies depuis le IIIe siècle av. J.-C., d''abord inspirées des statères grecs. Chaque peuple gaulois (Parisii, Éduens, Arvernes...) avait ses propres monnaies reconnaissables à leurs motifs stylisés.',
 true),

-- C4
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel peuple celtique a brûlé Rome vers 390 av. J.-C. ?',
 'Ils franchirent les Alpes, battirent les Romains à l''Allia et poussèrent jusqu''au Capitole...',
 '["Les Sénons", "Les Boïens", "Les Helvètes", "Les Galates"]',
 'Les Sénons',
 'Les Sénons, sous la conduite de Brennus, déferlèrent sur Rome en 390 av. J.-C. Leur chef aurait déclaré "Vae victis !" (malheur aux vaincus) en jetant son épée dans la balance lors du pesage de la rançon.',
 true),

-- C5
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Qu''est-ce qu''un oppidum gaulois ?',
 'Ces grandes agglomérations fortifiées dominaient les collines et contrôlaient les routes commerciales...',
 '["Une ville fortifiée sur une hauteur", "Un temple druidique", "Un camp militaire romain", "Un marché saisonnier"]',
 'Une ville fortifiée sur une hauteur',
 'Les oppida étaient les grandes agglomérations gauloises, souvent perchées sur des hauteurs stratégiques. Bibracte (Éduens), Gergovie (Arvernes) ou Avaricum (Bituriges) comptaient plusieurs milliers d''habitants avec artisans, marchands et élites.',
 true),

-- C6
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quelle déesse celtique de la guerre se manifestait souvent sous la forme d''un corbeau ?',
 'Sur les champs de bataille irlandais, cette déesse volait au-dessus des combattants pour sceller leur destin...',
 '["La Morrigane", "Brigid", "Dana", "Epona"]',
 'La Morrigane',
 'La Morrigane (ou Morrigan) est la déesse irlandaise de la guerre, du destin et de la mort. Elle apparaissait souvent comme une corneille ou un corbeau, tournoyant au-dessus des guerriers. Elle joua un rôle crucial dans la légende de Cú Chulainn.',
 true),

-- C7
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel instrument de musique celtique a une forme recourbée comme une trompe d''animal ?',
 'Son beuglement grave résonnait dans les vallées pour rassembler les guerriers ou effrayer l''ennemi...',
 '["Le carnyx", "La lyre", "La cornemuse", "La cithare"]',
 'Le carnyx',
 'Le carnyx est une trompe de guerre celtique en bronze dont l''extrémité représente une gueule d''animal ouverte (sanglier, serpent). Long de près de deux mètres, son son grave et retentissant était utilisé pour coordonner les mouvements de troupes et impressionner l''ennemi.',
 true),

-- C8
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel peuple celtique habitait la région qui deviendra la Suisse ?',
 'César les força à rebrousser chemin lors de leur grande migration vers l''ouest en 58 av. J.-C...',
 '["Les Helvètes", "Les Boïens", "Les Allobroges", "Les Séquanes"]',
 'Les Helvètes',
 'La migration des Helvètes en 58 av. J.-C. fut le prétexte de l''intervention de César en Gaule. Ce peuple celte tentait de rejoindre les territoires atlantiques, mais César les battit à la bataille de Bibracte et les renvoya dans leur pays d''origine.',
 true),

-- C9
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Comment appelle-t-on les poètes et musiciens de la société celtique, gardiens de la mémoire orale ?',
 'Ils mémorisaient des milliers de vers et pouvaient louer ou maudire un roi avec leurs chants...',
 '["Les bardes", "Les scaldes", "Les aèdes", "Les troubadours"]',
 'Les bardes',
 'Les bardes formaient une des trois classes savantes celtiques avec les druides et les devins (vates). Ils composaient et récitaient des poèmes épiques, des généalogies et des louanges. Un barde insulté pouvait "satirer" un roi — une malédiction en vers redoutée de tous.',
 true),

-- C10
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel pays est souvent appelé "le pays des Celtes" car il conserve encore une langue celtique vivante ?',
 'Sur cette île à l''ouest de la France, le breton, le gallois et le cornique témoignent d''un passé celtique résistant...',
 '["L''Irlande", "L''Espagne", "La Pologne", "La Norvège"]',
 'L''Irlande',
 'L''irlandais (gaélique irlandais) est la langue celtique la plus vivante aujourd''hui, avec le gallois. L''Irlande n''ayant jamais été conquise par Rome, sa culture celtique s''est préservée de façon exceptionnelle, notamment dans ses manuscrits enluminés et ses légendes mythologiques.',
 true),

-- C11
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quelle reine brittonique a mené une révolte contre l''occupation romaine en 60-61 ap. J.-C. ?',
 'Cheveux roux au vent, elle conduisit ses chars de guerre contre les légions de Néron...',
 '["Boudicca", "La Morrigane", "Cartimandua", "Medb"]',
 'Boudicca',
 'Boudicca, reine des Icènes, mena une rébellion dévastatrice contre Rome : Camulodunum (Colchester), Londinium et Verulamium furent incendiées. Son armée est estimée à 100 000 hommes avant d''être finalement écrasée par le gouverneur Suetonius Paulinus.',
 true),

-- C12
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel est l''autre nom de la fête celtique du 31 octobre, encore célébrée aujourd''hui ?',
 'En cette nuit, le voile entre les vivants et les morts s''amincissait jusqu''à devenir transparent...',
 '["Samain", "Imbolc", "Lughnasadh", "Beltane"]',
 'Samain',
 'Samain (ou Samhain) marquait la fin de l''année celtique et le début de la saison sombre. C''est lors de cette fête que les frontières entre le monde des vivants et celui des morts s''effaçaient. Halloween est la version christianisée et populaire de cette fête ancienne.',
 true),

-- C13
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Dans la mythologie celtique irlandaise, comment s''appelle le monde des dieux et des ancêtres ?',
 'Un pays de délices où nul ne vieillit, accessible au-delà des mers ou sous les collines enchantées...',
 '["L''Autre Monde (Tír na nÓg)", "Le Valhalla", "L''Olympe", "L''Annwn"]',
 'L''Autre Monde (Tír na nÓg)',
 'Tír na nÓg ("Pays de la jeunesse éternelle") est le paradis de la mythologie irlandaise, où vivent les Tuatha Dé Danann. On y accède par des collines féeriques, des grottes ou en traversant l''océan vers l''ouest. Ni maladie, ni vieillesse, ni mort n''y existent.',
 true),

-- C14
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'De quel matériau était fabriqué le chaudron de Gundestrup, chef-d''œuvre de l''art celtique ?',
 'Retrouvé dans un marais danois, ce récipient couvert de scènes mythologiques est l''un des plus beaux objets celtes jamais découverts...',
 '["L''argent", "L''or", "Le bronze", "Le fer"]',
 'L''argent',
 'Le chaudron de Gundestrup, découvert en 1891 dans un tourbière danoise, est fait de plaques d''argent presque pur. Il date du Ier siècle av. J.-C. et représente des divinités, des guerriers, des animaux sacrés et une scène de régénération dans un chaudron — peut-être le Chaudron de Dagda.',
 true),

-- C15
('daily', 'very_easy', 'faction-celtique', 'qcm',
 'Quel est le nom du dieu solaire et artisan des Celtes irlandais, père de nombreux héros ?',
 'Maître des arts, des métiers et de la magie, il était l''égal d''Apollon chez les Grecs...',
 '["Le Dagda", "Lug", "Nuada", "Cernunnos"]',
 'Lug',
 'Lug (ou Lugh) est le dieu solaire et polyvalent des Celtes irlandais — son épithète "Lamhfhada" signifie "au long bras". Il maîtrisait tous les arts et métiers à la fois : c''est lui qui tua le géant Balor de son œil maléfique lors de la bataille de Mag Tuired.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION NORDIQUE (15)
-- ═══════════════════════════════════════════════════════════════

-- N1
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment s''appelle le dieu suprême de la mythologie nordique, maître de la sagesse et de la guerre ?',
 'Il sacrifia un œil au puit de Mimir pour obtenir la sagesse, et se pendit à Yggdrasil pour révéler les runes...',
 '["Odin", "Thor", "Tyr", "Baldr"]',
 'Odin',
 'Odin (ou Woden en vieux germanique) est le père des dieux nordiques. Il règne sur le Valhalla, accompagné de ses deux corbeaux Huginn (pensée) et Muninn (mémoire). Le mercredi (Wednesday) tire son nom de Woden''s Day en anglais.',
 true),

-- N2
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom du pont arc-en-ciel qui relie le monde des hommes au royaume des dieux nordiques ?',
 'Gardé par Heimdall qui ne dort jamais, il brillait de toutes les couleurs entre Midgard et Asgard...',
 '["Bifröst", "Niflheim", "Jörmungandr", "Gjöll"]',
 'Bifröst',
 'Bifröst est le pont arc-en-ciel de la mythologie nordique, reliant Midgard (le monde des hommes) à Asgard (le monde des dieux). Gardé par le dieu Heimdall, il sera détruit lors du Ragnarök quand les géants de feu le traverseront.',
 true),

-- N3
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment s''appelle le grand festin des morts au combat dans le Valhalla ?',
 'Chaque soir les guerriers s''y régalaient, chaque matin ils ressuscitaient pour s''affronter à nouveau...',
 '["Les einherjar festoient", "Le Ragnarök", "Le blót", "Le Thing"]',
 'Les einherjar festoient',
 'Les einherjar sont les guerriers choisis par les valkyries pour rejoindre le Valhalla. Chaque jour ils s''entraînent au combat, se blessent et meurent, puis ressuscitent le soir pour festoyer avec Odin. Ils attendent ainsi le Ragnarök, la bataille finale.',
 true),

-- N4
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom du serpent géant qui encercle le monde dans la mythologie nordique ?',
 'Si grand qu''il peut tenir sa propre queue dans sa gueule, il dort au fond de l''océan qui entoure Midgard...',
 '["Jörmungandr", "Níðhöggr", "Fáfnir", "Lindworm"]',
 'Jörmungandr',
 'Jörmungandr (le Serpent de Midgard) est fils de Loki et de la géante Angrboda. Odin le jeta dans l''océan où il grandit jusqu''à encercler toute la Terre. Lors du Ragnarök, il émergera pour affronter Thor — chacun tuera l''autre.',
 true),

-- N5
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel dieu nordique est associé à la tromperie, au feu et au changement de forme ?',
 'Ni tout à fait ennemi, ni vraiment allié, il était le génie du chaos qui finit par trahir les dieux...',
 '["Loki", "Baldr", "Freyr", "Tyr"]',
 'Loki',
 'Loki est le dieu de la ruse et du changement de forme (shapeshifter). D''abord compagnon d''Odin, il devient progressivement l''ennemi des dieux. Il est responsable de la mort de Baldr, le dieu de la lumière, et sera enchaîné jusqu''au Ragnarök.',
 true),

-- N6
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel continent les Vikings ont-ils découvert vers l''an 1000, bien avant Christophe Colomb ?',
 'Leif Erikson y aborda et appela ce pays "Vinland" à cause des vignes sauvages qu''il y trouva...',
 '["L''Amérique du Nord", "L''Afrique", "L''Australie", "L''Asie"]',
 'L''Amérique du Nord',
 'Leif Erikson atteignit l''Amérique du Nord vers l''an 1000, qu''il appela Vinland. Le site de L''Anse aux Meadows, découvert en 1960 à Terre-Neuve (Canada), est la seule colonie viking confirmée en Amérique. Colomb n''arrivera que 500 ans plus tard.',
 true),

-- N7
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom de la fin du monde dans la mythologie nordique, la grande bataille des dieux ?',
 'Dieux et géants s''y affronteront en une dernière lutte, et la Terre sombrera dans l''océan avant de renaître...',
 '["Le Ragnarök", "Le Niflheim", "Le Götterdämmerung", "Le Jötunheim"]',
 'Le Ragnarök',
 'Le Ragnarök ("Crépuscule des dieux") est la fin du monde de la mythologie nordique. Odin mourra dévoré par le loup Fenrir, Thor tuera Jörmungandr mais mourra de son venin. Après la destruction totale, une nouvelle Terre émergera des eaux, verte et fertile.',
 true),

-- N8
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel outil était le symbole de protection le plus répandu chez les Vikings ?',
 'Ce pendentif en métal représentait l''arme du dieu du tonnerre — des millions de Scandinaves le portaient au cou...',
 '["Le marteau Mjöllnir", "La croix", "La rune Algiz", "Le casque ailé"]',
 'Le marteau Mjöllnir',
 'Le Mjöllnir ("écraseur") est le marteau de Thor, forgé par les nains Sindri et Brokkr. Son pendentif était le symbole de protection le plus répandu en Scandinavie avant et pendant la christianisation. Archeologists en ont retrouvé des milliers sur des sites funéraires.',
 true),

-- N9
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment appelle-t-on les guerrières divines qui choisissaient les morts sur le champ de bataille ?',
 'À cheval, elles parcouraient les champs de carnage pour désigner ceux qui rejoindraient Odin...',
 '["Les valkyries", "Les nornes", "Les disir", "Les völva"]',
 'Les valkyries',
 'Les valkyries ("celles qui choisissent les morts") étaient des esprits guerriers qui servaient Odin. Elles désignaient les soldats qui mourraient au combat et escortaient les élus vers le Valhalla. Leurs noms évoquent la bataille : Brynhildr (cuirasse de combat), Sigrún (rune de victoire).',
 true),

-- N10
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quelle ville française a été fondée par les Vikings et porte encore leur nom dans son origine ?',
 'Son nom vient du pays des "Hommes du Nord" — Nortmanni — qui s''y installèrent au Xe siècle...',
 '["Rouen (Normandie)", "Nantes", "Bordeaux", "Lyon"]',
 'Rouen (Normandie)',
 'La Normandie tire son nom des Normands (Nortmanni, "hommes du Nord"). En 911, le chef viking Rollon reçut cette région du roi franc Charles le Simple par le traité de Saint-Clair-sur-Epte. Les descendants de ces Vikings deviendront les ducs de Normandie, dont Guillaume le Conquérant.',
 true),

-- N11
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel peuple nordique a colonisé l''Islande à partir du IXe siècle ?',
 'Fuyant le pouvoir centralisateur du roi Harald à la Belle Chevelure, des familles entières prirent la mer vers l''ouest...',
 '["Les Norvégiens", "Les Danois", "Les Suédois", "Les Frisons"]',
 'Les Norvégiens',
 'L''Islande fut colonisée principalement par des Norvégiens à partir de 874 ap. J.-C., date de l''arrivée d''Ingólfr Arnarson à Reykjavik. Cette colonisation est exceptionnellement bien documentée dans le Landnámabók (Livre des Établissements), qui liste plus de 400 colons et 3 000 personnes.',
 true),

-- N12
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Comment s''appellent les récits épiques en prose de la littérature nordique médiévale ?',
 'Mis par écrit en Islande aux XIIe-XIIIe siècles, ils racontent les aventures des rois, des héros et des explorateurs vikings...',
 '["Les sagas", "Les eddas", "Les kenningar", "Les skaldic"]',
 'Les sagas',
 'Les sagas islandaises sont des récits en prose composés aux XIIe-XIVe siècles, relatant l''histoire des familles, des rois et des aventuriers nordiques. Les plus célèbres incluent la Saga de Njáll, la Saga des Groenlandais et la Saga d''Erik le Rouge qui raconte la découverte de l''Amérique.',
 true),

-- N13
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom du dieu nordique de la lumière et de la beauté, dont la mort causa le premier deuil des dieux ?',
 'Si aimé qu''Odin demanda à toutes les créatures de jurer de ne jamais lui faire de mal — sauf une...',
 '["Baldr", "Freyr", "Höðr", "Víðarr"]',
 'Baldr',
 'Baldr est le dieu de la lumière, de la beauté et de la pureté. Sa mort, causée par la ruse de Loki (une flèche de gui tirée par son frère aveugle Höðr), provoqua un deuil universel chez les dieux. Il reviendra après le Ragnarök pour régner sur le nouveau monde.',
 true),

-- N14
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel célèbre chef normand conquit l''Angleterre en 1066 ?',
 'Sa victoire à Hastings changea à jamais la langue et la culture anglaise, y introduisant des milliers de mots français...',
 '["Guillaume le Conquérant", "Rollon", "Ragnar Lothbrok", "Harald Hardrada"]',
 'Guillaume le Conquérant',
 'Guillaume le Conquérant, duc de Normandie et descendant des Vikings, vainquit le roi Harold II à la bataille de Hastings le 14 octobre 1066. Sa conquête de l''Angleterre introduisit le français normand comme langue de la cour, modifiant durablement la langue anglaise.',
 true),

-- N15
('daily', 'very_easy', 'faction-nordique', 'qcm',
 'Quel est le nom du monde des morts glacial et brumeux dans la mythologie nordique ?',
 'Ni guerriers glorieux ni dieux — seulement ceux qui meurent de maladie ou de vieillesse y descendent...',
 '["Niflheim", "Jötunheim", "Muspellheim", "Svartalfheim"]',
 'Niflheim',
 'Niflheim ("monde du brouillard") est l''un des neuf mondes nordiques, domaine des morts qui n''ont pas péri au combat. Gouverné par la déesse Hel (dont l''anglais "hell" tire son origine), c''est un lieu froid et sombre, à l''opposé de la chaleur du Valhalla.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION ROMAINE (15)
-- ═══════════════════════════════════════════════════════════════

-- R1
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Selon la légende, qui a fondé la ville de Rome ?',
 'Selon la tradition, des jumeaux élevés par une louve seraient à l''origine de la plus grande ville du monde antique...',
 '["Romulus", "Remus", "Énée", "Numa Pompilius"]',
 'Romulus',
 'Selon la légende, Romulus et Remus, fils du dieu Mars, furent abandonnés et allaités par une louve. Romulus fonda Rome en 753 av. J.-C. et en devint le premier roi. Il tua son frère Remus qui avait sauté par-dessus les murs de la nouvelle cité en signe de mépris.',
 true),

-- R2
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Comment appelle-t-on les soldats d''élite des empereurs romains, leur garde personnelle ?',
 'Ces soldats d''élite stationnés à Rome jouèrent un rôle politique démesuré, allant jusqu''à assassiner ou vendre le trône...',
 '["Les prétoriens", "Les légionnaires", "Les auxiliaires", "Les triarii"]',
 'Les prétoriens',
 'La Garde prétorienne, créée par Auguste, était la garde personnelle de l''empereur. Mieux payés et moins soumis que les légions, les prétoriens devinrent une force politique redoutable — ils assassinèrent plusieurs empereurs (Caligula, Pertinax) et vendirent parfois le trône au plus offrant.',
 true),

-- R3
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel type de combat était interdit dans les jeux romains mais pratiqué illégalement comme sport favori des paris ?',
 'Ces combats opposaient deux hommes avec épée et bouclier dans l''arène, sous les cris de la foule...',
 '["Les combats de gladiateurs", "La chasse au sanglier", "Le char de course", "La lutte gréco-romaine"]',
 'Les combats de gladiateurs',
 'Contrairement aux idées reçues, les gladiateurs n''étaient pas condamnés à mort systématiquement. Un bon gladiateur était une investissement coûteux — les combats à mort étaient l''exception. Beaucoup de gladiateurs étaient des professionnels libres qui choisissaient cette carrière pour la gloire et l''argent.',
 true),

-- R4
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel bâtiment romain en forme de dôme, encore intact aujourd''hui, était dédié à tous les dieux ?',
 'Sa coupole en béton, percée d''un oculus ouvert sur le ciel, reste un prodige d''ingénierie après deux mille ans...',
 '["Le Panthéon", "Le Colisée", "L''Arc de Titus", "Les thermes de Caracalla"]',
 'Le Panthéon',
 'Le Panthéon de Rome, construit sous Hadrien vers 125 ap. J.-C., est l''édifice antique le mieux conservé au monde. Sa coupole de 43,3 mètres de diamètre était, jusqu''à la Renaissance, la plus grande coupole jamais construite. L''oculus central éclaire l''intérieur de lumière naturelle.',
 true),

-- R5
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Comment s''appelait le premier empereur de Rome ?',
 'Neveu adoptif de César, il mit fin aux guerres civiles et instaura deux siècles de paix romaine...',
 '["Auguste", "Jules César", "Néron", "Tibère"]',
 'Auguste',
 'Auguste (né Octave) devint le premier emperor romain en 27 av. J.-C. Son règne de 44 ans inaugura le Principat et le siècle d''or de la littérature latine (Virgile, Horace, Ovide). Son mois de naissance, Sextilis, fut rebaptisé Augustus en son honneur — d''où notre mois d''août.',
 true),

-- R6
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel ouvrage hydraulique romain transportait l''eau des montagnes vers les villes ?',
 'Ces constructions monumentales traversaient vallées et plaines sur des arches de pierre, parfois sur des dizaines de kilomètres...',
 '["L''aqueduc", "Le forum", "Le cloaque", "La voie romaine"]',
 'L''aqueduc',
 'Rome était alimentée par 11 aqueducs transportant 1 million de mètres cubes d''eau par jour — soit plus par habitant que la plupart des villes modernes. Le pont du Gard, en France, est un fragment d''aqueduc romain toujours debout, long de 50 km au total.',
 true),

-- R7
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel célèbre philosophe et emperor romain a écrit les "Pensées" (Méditations) ?',
 'Il gouverna l''Empire au IIe siècle tout en pratiquant la philosophie stoïcienne — un sage sur le trône...',
 '["Marc Aurèle", "Cicéron", "Sénèque", "Hadrien"]',
 'Marc Aurèle',
 'Marc Aurèle (121-180 ap. J.-C.) est souvent considéré comme le dernier des "Cinq bons empereurs". Ses "Méditations", écrites en grec pour lui-même, sont un chef-d''œuvre de la philosophie stoïcienne. Il gouverna avec sagesse tout en menant de longues guerres contre les Marcomans.',
 true),

-- R8
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel est le nom du grand cirque de Rome où se tenaient les courses de chars ?',
 'Long de 600 mètres, il pouvait accueillir jusqu''à 250 000 spectateurs — le plus grand stade de l''Antiquité...',
 '["Le Circus Maximus", "Le Colisée", "Le Circus Nero", "Le Stade de Domitien"]',
 'Le Circus Maximus',
 'Le Circus Maximus était le plus grand stade du monde antique. Les courses de chars (quadriges) y attiraient des foules fanatiques organisées en factions par couleur (Bleus, Verts, Rouges, Blancs). Un cocher victorieux pouvait devenir aussi riche et célèbre qu''une star moderne.',
 true),

-- R9
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quelle expression latine signifie "pain et jeux" et décrit la politique romaine pour contenter le peuple ?',
 'Distribuer de la nourriture et offrir des spectacles : une recette politique vieille de deux mille ans...',
 '["Panem et circenses", "Veni vidi vici", "Carpe diem", "Alea jacta est"]',
 'Panem et circenses',
 '"Panem et circenses" (pain et jeux du cirque) est une expression du poète satirique Juvénal (Satires, X). Il critiquait ainsi la population romaine qui, ayant abandonné ses responsabilités civiques, se contentait de distributions gratuites de blé et de spectacles pour être satisfaite.',
 true),

-- R10
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Comment s''appelait la grande route militaire qui reliait Rome à Brindisi, dans le talon de l''Italie ?',
 'Première grande route romaine construite en 312 av. J.-C., elle fut pendant des siècles l''épine dorsale de l''Italie...',
 '["La Via Appia", "La Via Aurelia", "La Via Flaminia", "La Via Salaria"]',
 'La Via Appia',
 'La Via Appia ("reine des routes") fut construite en 312 av. J.-C. par le censeur Appius Claudius Caecus. Longue de 560 km, elle reliait Rome à Brindisi, port d''embarquement vers la Grèce et l''Orient. C''est sur ses bas-côtés que 6 000 esclaves de Spartacus furent crucifiés en 71 av. J.-C.',
 true),

-- R11
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quelle déesse romaine est l''équivalent de la déesse grecque Athéna ?',
 'Déesse de la sagesse, des arts et de la guerre stratégique, elle jaillissait armée de la tête de Jupiter...',
 '["Minerve", "Junon", "Vénus", "Diane"]',
 'Minerve',
 'Minerve est la déesse romaine de la sagesse, des arts, de l''artisanat et de la guerre stratégique, équivalente à l''Athéna grecque. Avec Jupiter et Junon, elle formait la Triade Capitoline, les trois divinités principales de Rome. Sa chouette était son animal symbolique.',
 true),

-- R12
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel est le nom de la célèbre sentence prononcée par César lors de sa traversée du Rubicon ?',
 'Cette rivière marquait la frontière légale — la franchir en armes était une déclaration de guerre contre Rome...',
 '["Alea jacta est", "Veni vidi vici", "Tu quoque, Brute", "Carpe diem"]',
 'Alea jacta est',
 '"Alea jacta est" ("Le sort en est jeté") aurait été prononcé par Jules César en franchissant le Rubicon en 49 av. J.-C. avec sa légion. En traversant cette frontière en armes, il commettait un acte de guerre contre la République romaine, déclenchant la guerre civile contre Pompée.',
 true),

-- R13
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel type de vêtement blanc drapé était porté par les citoyens romains lors des occasions officielles ?',
 'Ce vêtement lourd et encombrant était la marque distinctive du citoyen romain libre — les étrangers n''avaient pas le droit d''en porter...',
 '["La toge", "La tunique", "Le pallium", "La stola"]',
 'La toge',
 'La toge était le vêtement civique officiel du citoyen romain mâle adulte. Faite d''un grand demi-cercle de laine blanche (jusqu''à 6 mètres de tissu), elle était difficile à draper et inconfortable — c''est pourquoi les Romains portaient une simple tunique au quotidien.',
 true),

-- R14
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Comment s''appelait le sénat de la Rome antique, assemblée de la classe dirigeante ?',
 'Ses quelque 300 membres décidaient de la guerre et de la paix, des lois et des finances de la République...',
 '["Le Sénat", "Le Comice", "La Curie", "L''Assemblée du peuple"]',
 'Le Sénat',
 'Le Sénat romain (de "senex", vieillard) était l''assemblée des ex-magistrats et de l''aristocratie. Sous la République, son autorité (auctoritas) était morale autant que légale. Avec l''Empire, il perdit progressivement ses pouvoirs réels mais conserva son prestige et ses fonctions formelles.',
 true),

-- R15
('daily', 'very_easy', 'faction-romaine', 'qcm',
 'Quel dieu romain est le maître de l''Olympe, des dieux et de la foudre ?',
 'Père des dieux et des hommes, son symbole — l''aigle — ornait les étendards des légions romaines...',
 '["Jupiter", "Mars", "Neptune", "Pluton"]',
 'Jupiter',
 'Jupiter (équivalent du Zeus grec) est le roi des dieux romains, maître du ciel et de la foudre. Son temple sur le Capitole était le plus important de Rome. Les légions portaient l''aigle de Jupiter (aquila) comme insigne sacré — le perdre au combat était une honte suprême.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION BYZANTINE (15)
-- ═══════════════════════════════════════════════════════════════

-- B1
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'En quelle langue écrivaient et gouvernaient les Byzantins, malgré leur héritage romain ?',
 'L''Empire romain d''Orient abandonna progressivement la langue de Rome pour celle de la philosophie et des Évangiles...',
 '["Le grec", "Le latin", "L''araméen", "L''hébreu"]',
 'Le grec',
 'Bien qu''héritiers de Rome, les Byzantins utilisaient le grec comme langue officielle depuis le VIIe siècle. Le grec était la langue de la culture, de la religion (Septante, Nouveau Testament) et de l''administration. Les empereurs portaient le titre de "Basileus" (roi en grec) plutôt que d''imperator.',
 true),

-- B2
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel célèbre code de lois fut rédigé sous l''empire byzantin de Justinien ?',
 'Ce monument juridique, compilé en quelques années, forma la base du droit dans toute l''Europe occidentale...',
 '["Le Code Justinien", "La Loi Salique", "Les Douze Tables", "Le Code d''Hammurabi"]',
 'Le Code Justinien',
 'Le Corpus Juris Civilis, compilé entre 529 et 534 sous Justinien Ier, est la plus grande réalisation juridique de l''Antiquité tardive. Il rassembla des siècles de droit romain en un ensemble cohérent. Il forma la base du droit civil dans la plupart des pays européens et latino-américains.',
 true),

-- B3
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel peuple nomade d''Asie centrale menaçait régulièrement les frontières byzantines depuis les steppes ?',
 'Ces cavaliers redoutables vivaient à cheval, fondant soudainement sur les territoires frontaliers avant de disparaître...',
 '["Les Huns", "Les Mongols", "Les Avars", "Les Petchénègues"]',
 'Les Huns',
 'Les Huns, sous Attila, ravagèrent les Balkans byzantins dans les années 440. L''Empire paya de lourds tributs pour acheter la paix. Après la mort d''Attila en 453, leur confédération s''effondra rapidement, mais d''autres peuples des steppes (Avars, Petchénègues, Coumans) reprirent leur rôle de menace.',
 true),

-- B4
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel est le nom de l''arme secrète byzantine qui pouvait brûler sur l''eau et décima les flottes arabes ?',
 'Projetée depuis les navires de guerre, cette substance mystérieuse continuait à brûler même quand on l''arrosait d''eau...',
 '["Le feu grégeois", "Le naphte", "La poix ardente", "Le soufre liquide"]',
 'Le feu grégeois',
 'Le feu grégeois était une arme incendiaire byzantine dont la composition exacte reste un mystère. Utilisé dès le VIIe siècle, il brûlait sur l''eau et adhérait aux surfaces. Il sauva Constantinople lors des sièges arabes de 674-678 et 717-718. Sa formule exacte ne fut jamais percée.',
 true),

-- B5
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Sous quel nom l''empire byzantin se désignait-il lui-même ?',
 'Pour eux, ils n''étaient pas "byzantins" — ce terme est une invention d''historiens modernes. Ils se voyaient comme les héritiers directs d''une gloire millénaire...',
 '["L''Empire romain", "L''Empire grec", "L''Empire chrétien", "L''Empire d''Orient"]',
 'L''Empire romain',
 'Les habitants de l''Empire byzantin se nommaient "Romaioi" (Romains) et leur empire "Basileia Rhomaion" (Empire des Romains). Le terme "byzantin" fut inventé par des historiens occidentaux au XVIe siècle, tiré de l''ancien nom de Constantinople, Byzance. Ils auraient rejeté ce nom.',
 true),

-- B6
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel grand schisme religieux de 1054 divisa définitivement le christianisme en deux branches ?',
 'L''Église de Rome et l''Église de Constantinople s''excommunièrent mutuellement, créant une fracture qui dure encore...',
 '["Le Grand Schisme d''Orient", "La Réforme protestante", "Le schisme d''Avignon", "La querelle des investitures"]',
 'Le Grand Schisme d''Orient',
 'Le Schisme de 1054 divisa le christianisme en Église catholique romaine (pape de Rome) et Église orthodoxe (patriarche de Constantinople). Les divergences portaient sur la primauté du pape, le célibat des prêtres et la procession du Saint-Esprit (la querelle du Filioque). Cette division n''a jamais été réparée.',
 true),

-- B7
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel grand général byzantin reconquit l''Afrique du Nord et l''Italie sous Justinien Ier ?',
 'Avec des armées souvent inférieures en nombre, ce stratège de génie renversa le royaume vandale et écrase les Ostrogoths...',
 '["Bélisaire", "Narsès", "Jean Troglita", "Héraclius"]',
 'Bélisaire',
 'Bélisaire (505-565) est considéré comme le plus grand général de l''Antiquité tardive. Il reconquit l''Afrique du Nord en 533 (en détruisant le royaume vandale en 3 mois) et l''Italie entre 535 et 540. Malgré ses succès, il fut disgrâcié plusieurs fois par un Justinien jaloux de sa gloire.',
 true),

-- B8
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quelle cérémonie liturgique et musicale est caractéristique de l''Église orthodoxe héritée de Byzance ?',
 'Sans instruments de musique, les voix humaines seules s''élèvent en harmonies complexes dans les cathédrales orthodoxes...',
 '["Le chant byzantin (a cappella)", "La polyphonie grégorienne", "Le plain-chant romain", "L''orgue liturgique"]',
 'Le chant byzantin (a cappella)',
 'Le chant byzantin, fondé sur des modes musicaux hérités de la Grèce antique, est exécuté sans instruments dans les offices orthodoxes. Il utilise des mélismes (de nombreuses notes sur une seule syllabe) et des modes non tempérés qui lui donnent un caractère contemplatif unique.',
 true),

-- B9
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel peuple slave fut évangélisé au IXe siècle grâce à un alphabet créé par des moines byzantins ?',
 'Cyrille et Méthode inventèrent un alphabet spécialement adapté à leur langue pour leur transmettre l''Évangile...',
 '["Les Bulgares et Moraves (slaves)", "Les Germains", "Les Scandinaves", "Les Hongrois"]',
 'Les Bulgares et Moraves (slaves)',
 'Saints Cyrille et Méthode, moines byzantins, créèrent l''alphabet glagolitique vers 862 pour transcrire les langues slaves. L''alphabet cyrillique (qui porte le nom de Cyrille) en est une adaptation ultérieure. Il est encore utilisé par des centaines de millions de personnes (Russie, Serbie, Bulgarie...).',
 true),

-- B10
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel nom portait la grande rue principale de Constantinople, qui reliait la porte d''or au Grand Palais ?',
 'Cette avenue monumentale, bordée de colonnes et de statues, était le cœur de la vie publique byzantine...',
 '["La Mésé", "Le Tétrastoon", "L''Augustéon", "La Via Sacra"]',
 'La Mésé',
 'La Mésé ("voie du milieu") était l''artère principale de Constantinople, l''équivalent de la Via Sacra romaine. Bordée de portiques couverts, elle abritait marchands et artisans. Elle partait du Forum de Constantin, passait par plusieurs forums monumentaux et menait au Grand Palais impérial.',
 true),

-- B11
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel sport hippique divisait la population de Constantinople en factions rivales fanatiques ?',
 'Les Bleus et les Verts s''affrontaient non seulement dans l''hippodrome mais aussi dans les rues, allant jusqu''à renverser des empereurs...',
 '["Les courses de chars", "La joute à cheval", "Le polo", "La chasse à courre"]',
 'Les courses de chars',
 'L''Hippodrome de Constantinople, adjacent au Grand Palais, était le centre politique et sportif de l''Empire. Les factions des Bleus et des Verts étaient de véritables partis politiques autant que clubs sportifs. La révolte de Nika (532) faillit coûter son trône à Justinien — il fut sauvé par la détermination de sa femme, l''impératrice Théodora.',
 true),

-- B12
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quelle puissance islamique a finalement conquis Constantinople en 1453 ?',
 'Un sultan de 21 ans, armé des plus grands canons jamais construits, mit fin à un empire millénaire...',
 '["L''Empire ottoman", "Le califat abbasside", "L''Empire seldjoukide", "L''Égypte mamelouke"]',
 'L''Empire ottoman',
 'Mehmed II, sultan ottoman âgé de 21 ans, conquit Constantinople le 29 mai 1453 après 53 jours de siège. Les canons géants de l''ingénieur Urbain percèrent les murailles théodosiennes. Cette date est souvent citée comme marquant la fin du Moyen Âge en Europe.',
 true),

-- B13
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quelle impératrice byzantine du VIe siècle, ancienne actrice, co-gouverna avec son mari Justinien ?',
 'D''origine modeste, elle devint l''une des femmes les plus puissantes de l''histoire, guidant son empire lors des crises les plus graves...',
 '["Théodora", "Irène", "Zoé Porphyrogénète", "Eudocie"]',
 'Théodora',
 'Théodora (497-548) était fille d''un dompteur d''ours et actrice avant d''épouser Justinien. Impératrice, elle joua un rôle politique crucial : lors de la révolte de Nika (532), c''est elle qui convainquit Justinien de ne pas fuir : "La pourpre est le plus beau linceul." Elle réforma aussi les lois sur les femmes et la prostitution.',
 true),

-- B14
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel art décoratif byzantin, fait de petits cubes de verre ou pierre colorés, ornait les murs des églises ?',
 'Ces compositions scintillantes de fonds dorés représentaient les saints dans une lumière qui semblait venue d''un autre monde...',
 '["La mosaïque", "La fresque", "L''enluminure", "L''émail cloisonné"]',
 'La mosaïque',
 'La mosaïque byzantine est considérée comme le sommet de cet art. Les tessères (petits cubes de verre coloré ou de pierre) étaient posées à des angles légèrement différents pour mieux réfléchir la lumière des bougies. Les mosaïques de Ravenne (VIe siècle), notamment celles de San Vitale, sont les plus célèbres exemples subsistant.',
 true),

-- B15
('daily', 'very_easy', 'faction-byzantine', 'qcm',
 'Quel titre portait l''épouse de l''emperor byzantin ?',
 'Ce mot grec signifiant "celle qui règne" confèrait à l''impératrice un statut sacré et une autorité réelle...',
 '["Basilissa", "Augusta", "Déspina", "Kyria"]',
 'Basilissa',
 'La Basilissa était le titre officiel de l''impératrice byzantine, équivalent féminin du Basileus. Certaines Basilissai gouvernèrent effectivement l''Empire — Irène d''Athènes (797-802) fut la première femme à régner seule à Constantinople, allant jusqu''à se proclamer "Basileus" au masculin.',
 true);
