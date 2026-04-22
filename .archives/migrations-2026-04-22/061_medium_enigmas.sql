-- 055_medium_enigmas.sql
-- Seed : ~55 énigmes quotidiennes de difficulté "medium"
-- Distribution : ~14 par faction · ~35 qcm · ~20 free

INSERT INTO enigmas (type, difficulty, heritage_id, format, question, lore_text, choices, answer, explanation, active) VALUES

-- ═══════════════════════════════════════════════════════════════
-- FACTION CELTIQUE (14)
-- ═══════════════════════════════════════════════════════════════

-- C1 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quel roi arverne affronta César lors de la campagne des Gaules et fut finalement capturé à Alésia en 52 av. J.-C. ?',
 'Les Arvernes dominaient le cœur de la Gaule depuis leurs oppida du Massif Central. Leur chef ultime allait unifier les tribus comme jamais auparavant.',
 '["Ambiorix","Vercingétorix","Dumnorix","Viridomarus"]',
 'Vercingétorix',
 'Vercingétorix réunit une coalition de tribus gauloises contre César. Sa stratégie de la terre brûlée fut efficace jusqu''à Alésia, où il fut contraint de se rendre après un siège de plusieurs semaines. Il fut exécuté à Rome en 46 av. J.-C.',
 true),

-- C2 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Dans la cosmologie celtique, quel terme désignait l''Autre Monde, le royaume des dieux et des morts situé au-delà des mers ou sous les collines ?',
 'Pour les Celtes, la mort n''était pas une fin mais un passage vers un ailleurs lumineux, peuplé de dieux et d''ancêtres. Les bardes en chantaient les merveilles.',
 '["L''Avalon","Le Tír na nÓg","Le Mag Mell","L''Annwn"]',
 'Le Tír na nÓg',
 'Le Tír na nÓg (Terre de la Jeunesse éternelle) est le principal Autre Monde de la mythologie irlandaise. Annwn est son équivalent gallois, Mag Mell une variante irlandaise. Ces espaces coexistaient dans la tradition sans hiérarchie fixe.',
 true),

-- C3 · free
('daily', 'medium', 'faction-celtique', 'free',
 'Quel peuple gaulois habitait la région autour de l''actuelle Paris et lui donna son nom antique, Lutetia ?',
 'Sur l''île de la Seine, un peuple de bateliers et de marchands avait établi leur oppidum. Rome en fit une ville, mais leur nom survécut dans celui de la cité.',
 NULL,
 'Parisii',
 'Les Parisii étaient un peuple gaulois dont l''oppidum de Lutetia occupait l''île de la Cité. Leur nom, lié au commerce fluvial, donna directement son nom à Paris après la conquête romaine.',
 true),

-- C4 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quelle bataille de 279 av. J.-C. vit des guerriers celtes tenter de piller le sanctuaire grec de Delphes ?',
 'L''audace des Celtes n''avait pas de frontières : ils avaient saccagé Rome, traversé les Balkans et osèrent même défier Apollon dans son sanctuaire.',
 '["Bataille de Thermopyles","Bataille de l''Aliakmon","Raid de Delphes","Bataille de Magnésie"]',
 'Raid de Delphes',
 'En 279 av. J.-C., des Galates menés par Brennos tentèrent de piller Delphes. Les Grecs repoussèrent l''attaque, attribuant leur victoire à des prodiges d''Apollon. L''événement marqua durablement l''imaginaire hellénique face aux "Barbares du Nord".',
 true),

-- C5 · free
('daily', 'medium', 'faction-celtique', 'free',
 'Comment s''appelait la grande fête celtique du début novembre, marquant l''entrée dans la saison sombre et le passage entre les mondes ?',
 'Quand les jours raccourcissent et que le voile entre les vivants et les morts s''amincit, les Celtes allumaient des feux sur les collines pour traverser ensemble le seuil de l''hiver.',
 NULL,
 'Samhain',
 'Samhain (fin octobre / début novembre) était l''une des quatre grandes fêtes saisonnières celtes avec Imbolc, Beltaine et Lughnasadh. Elle marquait la fin de la saison de pâture et l''ouverture de l''Autre Monde, ancêtre direct d''Halloween.',
 true),

-- C6 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quelle est la principale source archéologique sur la religion druidique, découverte dans des lacs et marécages d''Europe celtique ?',
 'Les eaux immobiles des tourbières et des lacs gardaient les secrets des dieux celtes. Ce que les archéologues en ont retiré parle de sacrifices, d''offrandes et de foi.',
 '["Les stèles de Carnac","Les dépôts votifs aquatiques","Les calendriers de Coligny","Les tablettes de Bath"]',
 'Les dépôts votifs aquatiques',
 'Les Celtes jetaient dans les lacs, rivières et tourbières des armes, bijoux et parfois des humains à titre d''offrandes. Le lac de La Tène (Suisse) et le lac de Toulouse ont livré des milliers d''objets témoignant de cette pratique pan-celtique.',
 true),

-- C7 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Dans la société gauloise, quelle classe sociale se situait entre les druides et le peuple ordinaire, exerçant un rôle de mémoire orale et de propagande poétique ?',
 'Chaque chef gaulois qui se respectait avait à sa cour un homme capable de chanter ses exploits, maudire ses ennemis et préserver la mémoire des ancêtres dans la langue sacrée.',
 '["Les equites","Les bardes","Les vates","Les ambactes"]',
 'Les bardes',
 'Les bardes (bardd en gaulois) composaient et déclamaient des poèmes épiques à la gloire des guerriers. Ils formaient, avec les druides et les vates (devins), la triade des "hommes de savoir" celtiques, seuls exemples de mobilité sociale reconnue.',
 true),

-- C8 · free
('daily', 'medium', 'faction-celtique', 'free',
 'Quel chef éduen, à la fois magistrat gaulois et citoyen romain, fut exécuté sur ordre de César pour trahison en 54 av. J.-C. ?',
 'La frontière entre collaboration et résistance était mince dans la Gaule sous domination romaine. Certains jouaient des deux côtés, jusqu''au faux pas fatal.',
 NULL,
 'Dumnorix',
 'Dumnorix, frère de l''allié romain Diviciacos, cherchait à unir les Gaulois contre César tout en maintenant des apparences de loyauté. Arrêté alors qu''il tentait de fuir, il fut tué par la cavalerie de César en 54 av. J.-C.',
 true),

-- C9 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quelle technique de construction gauloise, utilisant poutres de bois et remblai de terre avec un parement de pierre, est décrite par César dans la "Guerre des Gaules" ?',
 'Les oppida gaulois n''étaient pas des camps rudimentaires mais de véritables cités fortifiées, dont les défenses impressionnèrent même les ingénieurs romains.',
 '["L''opus incertum","Le murus gallicus","La palissade de chêne","Le rempart vitreux"]',
 'Le murus gallicus',
 'Le murus gallicus est un système défensif typique des oppida gaulois : un parement de pierre retenant un remplissage de terre traversé de poutres horizontales liées par des clous de fer. César l''admire dans la "Guerre des Gaules" (VII, 23) pour sa résistance aux béliers.',
 true),

-- C10 · free
('daily', 'medium', 'faction-celtique', 'free',
 'Quel peuple celte, établi en Anatolie au IIIe siècle av. J.-C., donna son nom à une région et une épître de saint Paul ?',
 'Certains Celtes ne s''arrêtèrent pas à Rome ni à Delphes : ils traversèrent la mer et fondèrent un royaume au cœur de l''actuelle Turquie, conservant leur langue pendant des siècles.',
 NULL,
 'Galates',
 'Les Galates (ou Gaulois d''Asie) s''installèrent en Anatolie centrale vers 278 av. J.-C. après avoir ravagé les royaumes hellénistiques. Leur région, la Galatie, est mentionnée par saint Paul dans son épître aux Galates, et leur langue celtique y survécut jusqu''au IVe siècle ap. J.-C.',
 true),

-- C11 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quelle est la fête celtique du 1er février, associée au réveil de la nature et à la déesse Brigid, célébrée encore aujourd''hui en Irlande ?',
 'Au plus profond de l''hiver, quand les premières pousces percent la terre gelée, les Celtes savaient lire le message des dieux dans les signes de renouveau.',
 '["Beltaine","Lughnasadh","Imbolc","Alban Eiler"]',
 'Imbolc',
 'Imbolc (1er février) marquait la lactation des brebis et le début du printemps selon le calendrier celtique. Associée à Brigid, déesse de la guérison, de la forge et de la poésie, elle fut christianisée en fête de sainte Brigitte d''Irlande.',
 true),

-- C12 · free
('daily', 'medium', 'faction-celtique', 'free',
 'Quel oppidum arverne, dont le nom signifie "le lieu de Gergos", fut le théâtre du siège décisif de 52 av. J.-C. ?',
 'Sur un plateau naturellement défendu par des falaises, les Gaulois firent leur dernier pari. Ce nom résonne encore dans toute l''histoire de France.',
 NULL,
 'Alésia',
 'Alésia (Alesia en gaulois) fut le site du siège final de la guerre des Gaules. César y fit construire deux lignes de fortification : la contrevallation (face aux assiégés) et la circumvallation (face aux renforts gaulois). La défaite de Vercingétorix y sella le sort de la Gaule indépendante.',
 true),

-- C13 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Le calendrier de Coligny, découvert en 1897, est rédigé dans quelle langue ?',
 'Gravé sur des plaques de bronze au Ier siècle de notre ère, ce calendrier lunaire est l''un des rares témoignages directs de la pensée astronomique des druides.',
 '["En latin","En gaulois avec caractères latins","En grec","En ogham"]',
 'En gaulois avec caractères latins',
 'Le calendrier de Coligny (Ain, France) est le plus long texte gaulois connu. Rédigé en gaulois mais utilisant l''alphabet latin, il présente un cycle de 5 ans de 62 mois lunaires, témoignant d''une astronomie sophistiquée chez les druides.',
 true),

-- C14 · qcm
('daily', 'medium', 'faction-celtique', 'qcm',
 'Quel peuple belge, dont le territoire couvrait l''actuelle Champagne, résista le plus longtemps à César selon ses propres écrits ?',
 'César écrivit que parmi tous les Gaulois, certains étaient les plus braves — et c''était peut-être plus un aveu d''admiration que d''objectivité.',
 '["Les Trévires","Les Éburons","Les Bellovaques","Les Nerviens"]',
 'Les Nerviens',
 'César écrit dans la "Guerre des Gaules" (II, 15) que les Nerviens étaient "de loin les plus belliqueux" des Belges. Lors de la bataille de la Sambre en 57 av. J.-C., ils mirent les légions romaines en grande difficulté avant d''être presque anéantis.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION NORDIQUE (14)
-- ═══════════════════════════════════════════════════════════════

-- N1 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Quel poème norrois du XIIIe siècle, composé de 164 strophes de sagesse attribuées à Odin, est aussi appelé "Les dits du Très-Haut" ?',
 'Suspendu neuf nuits à Yggdrasil, transpercé de sa propre lance, Odin acquit les runes et la sagesse du monde. Ces paroles sont sa transmission aux hommes.',
 '["Le Völuspá","Le Hávamál","Le Grímnismál","Le Skírnismál"]',
 'Le Hávamál',
 'Le Hávamál (Paroles du Très-Haut) est un poème de l''Edda poétique offrant conseils pratiques, maximes morales et récits mythologiques. Il constitue une des sources majeures sur l''éthique viking et la vision norroise de la sagesse.',
 true),

-- N2 · free
('daily', 'medium', 'faction-nordique', 'free',
 'Comment les Vikings appelaient-ils leur assemblée législative et judiciaire populaire, tenue en plein air sur des sites désignés ?',
 'Dans le monde norrois, la loi ne venait pas d''un roi seul mais de la parole des hommes libres réunis sur la plaine du destin. La démocratie y avait un visage sauvage.',
 NULL,
 'Thing',
 'Le Thing (ou Þing) était l''assemblée des hommes libres où se réglaient les litiges, se votaient les lois et s''élisaient les chefs. L''Althing islandais, fondé en 930, est l''une des plus anciennes assemblées parlementaires du monde encore en activité.',
 true),

-- N3 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Quelle est la signification littérale du terme "berserker", nom donné aux guerriers vikings en état de transe furieuse ?',
 'Sur le champ de bataille, certains guerriers d''Odin semblaient imperméables à la douleur et à la peur. Les sagas disent qu''ils combattaient comme des bêtes sauvages.',
 '["Porteur de hache","Manteau d''ours","Sans armure","Furieux de guerre"]',
 'Manteau d''ours',
 'Le mot "berserker" vient du norrois "berserkr" : "ber" (ours) + "serkr" (chemise/manteau). Ces guerriers consacrés à Odin combattaient en manteaux de peau d''ours ou sans armure, dans un état de fureur rituelle (wut) qui les rendait terrifiants.',
 true),

-- N4 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Lors de quelle bataille de 1066 Harald Hardrada, roi de Norvège, fut-il tué en tentant de conquérir l''Angleterre ?',
 'L''année 1066 vit deux invasions de l''Angleterre. L''une échoua dans le nord, fauchant le dernier grand conquérant viking. L''autre, au sud, allait changer l''histoire pour toujours.',
 '["Bataille de Maldon","Bataille de Stamford Bridge","Bataille d''Hastings","Bataille de Clontarf"]',
 'Bataille de Stamford Bridge',
 'Harald Hardrada (Harald le Sévère) fut tué à Stamford Bridge le 25 septembre 1066 par le roi Harold II d''Angleterre. Trois jours plus tard, Harold devait marcher vers le sud pour affronter Guillaume le Conquérant à Hastings, où il mourut à son tour.',
 true),

-- N5 · free
('daily', 'medium', 'faction-nordique', 'free',
 'Quel explorateur islandais est généralement crédité de la première installation européenne en Amérique du Nord, vers l''an 1000 ?',
 'Avant Colomb de cinq siècles, un Norrois suivit les traces de son père et toucha une terre que personne en Europe ne soupçonnait. Il l''appela Vinland.',
 NULL,
 'Leif Erikson',
 'Leif Erikson, fils d''Éric le Rouge, atteignit le continent nord-américain vers l''an 1000, fondant un établissement à L''Anse aux Meadows (Terre-Neuve, Canada). Ce site, fouillé depuis 1960, est la seule preuve archéologique confirmée d''une présence viking en Amérique.',
 true),

-- N6 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Dans la mythologie norroise, quel est le nom du serpent cosmique qui encercle Midgard et mord sa propre queue ?',
 'Au fond des océans, une créature ancienne comme le monde lui-même enserre toutes les terres connues dans ses anneaux. Thor et lui se connaissent, et leur destin est lié.',
 '["Níðhöggr","Fenrir","Jörmungandr","Fáfnir"]',
 'Jörmungandr',
 'Jörmungandr (le Serpent du Milieu) est le fils de Loki et de la géante Angrboða. Thor et lui sont ennemis jurés : au Ragnarök, Thor le tuera mais mourra empoisonné par son venin après neuf pas. Níðhöggr est le dragon qui ronge les racines de Yggdrasil.',
 true),

-- N7 · free
('daily', 'medium', 'faction-nordique', 'free',
 'Quel terme norrois désigne le code d''honneur non écrit des Vikings, centré sur la réputation, la loyauté et la vengeance des offenses ?',
 'Pour un Viking, mourir dans son lit était une honte si l''on n''avait pas vengé les siens. La réputation se construisait sur des actes, et se perdait en un instant de lâcheté.',
 NULL,
 'Drengskapr',
 'Le drengskapr (ou drengr) désignait l''idéal du guerrier noble : bravoure, générosité, respect de la parole donnée et sens de l''honneur. Son contraire, le níðingr (lâche, sans honneur), était la pire insulte possible dans la société norroise.',
 true),

-- N8 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Quelle ville française, ancienne capitale du duché normand fondé par les Vikings, conserve un nom d''origine scandinave ?',
 'Les hommes du Nord ne repartirent pas tous. Certains s''installèrent, se marièrent, apprirent le français — et devinrent les Normands, qui allaient conquérir l''Angleterre et la Sicile.',
 '["Caen","Cherbourg","Rouen","Bayeux"]',
 'Rouen',
 'Rouen (Rothomagus en latin, Rúðuborg en norrois) devint la capitale du duché de Normandie accordé à Rollon en 911 par le traité de Saint-Clair-sur-Epte. Le nom "Normandie" lui-même vient de "Northmannia" (terre des hommes du Nord).',
 true),

-- N9 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Dans l''Edda de Snorri Sturluson, quels sont les neuf mondes reliés par l''arbre-monde Yggdrasil ?',
 'L''univers norrois n''était pas plat ni simple : neuf royaumes s''entrelaçaient dans les branches et les racines de l''arbre éternel, depuis les profondeurs glacées jusqu''aux forges de feu.',
 '["Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim","Asgard, Midgard, Utgard, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim","Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Dwarfheim, Helheim","Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Ljosalfheim, Svartalfheim, Helheim"]',
 'Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim',
 'Les neuf mondes de Yggdrasil regroupent : Asgard (dieux Ases), Midgard (humains), Jötunheim (géants), Niflheim (brume/mort), Muspelheim (feu), Vanaheim (dieux Vanes), Alfheim (elfes lumineux), Svartalfheim (elfes noirs/nains), et Helheim (royaume des morts ordinaires).',
 true),

-- N10 · free
('daily', 'medium', 'faction-nordique', 'free',
 'Quel type de poésie norroise, composée selon des règles strictes d''allitération et de kennings, était la marque des poètes de cour vikings ?',
 'Il fallait des années d''apprentissage pour maîtriser cet art. Un seul vers pouvait honorer un roi ou le ruiner — les mots étaient des armes autant que des épées.',
 NULL,
 'Skaldique',
 'La poésie skaldique (skáldskapr) se distinguait de la poésie eddique par ses règles métriques complexes (dróttkvætt) et l''usage de kennings (métaphores périphrastiques). Les skalds composaient des éloges royaux (drápur) et des mémoriaux (erfidrápur) en échange de récompenses.',
 true),

-- N11 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Quel jarl norvégien, gouverneur de la Norvège pour le compte danois, fut tué lors d''une révolte en 995 permettant la conversion forcée du pays au christianisme ?',
 'Le vieux monde des dieux nordiques résistait face à la croix. Mais quand les hommes forts tombent, les peuples changent de foi — parfois à la pointe de l''épée.',
 '["Hakon le Bon","Jarl Sigurd","Jarl Hakon Sigurdsson","Erik Bloodaxe"]',
 'Jarl Hakon Sigurdsson',
 'Hakon Sigurdsson, jarl de Lade, gouverna la Norvège de façon quasi indépendante et maintint le culte des dieux nordiques contre la pression chrétienne danoise. Son assassinat par son propre esclave permit à Olaf Tryggvason de s''emparer du pouvoir et d''imposer le christianisme.',
 true),

-- N12 · free
('daily', 'medium', 'faction-nordique', 'free',
 'Comment s''appelait la garde d''élite byzantine composée en grande partie de guerriers scandinaves, servant l''Empereur de Constantinople ?',
 'Des hommes venus des fjords glacés se retrouvèrent à garder le trône le plus riche de la Méditerranée. Leur réputation de férocité était leur meilleur bouclier.',
 NULL,
 'Varègues',
 'La Garde varègue (Varangian Guard) fut fondée vers 988 après qu''Olaf, prince de Kiev, envoya 6 000 guerriers à l''Empereur Basile II. Composée majoritairement de Scandinaves, puis d''Anglais après 1066, elle assura la protection personnelle des empereurs byzantins pendant trois siècles.',
 true),

-- N13 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Quel instrument les Vikings utilisaient-ils pour naviguer par temps couvert en s''orientant grâce à la lumière polarisée du soleil ?',
 'Par ciel nuageux, sans étoiles, sur l''océan illimité, le Viking trouvait quand même son chemin. Son secret tenait dans un cristal qui capturait la lumière cachée.',
 '["La boussole magnétique","La pierre solaire","L''astrolabe","Le gnomon"]',
 'La pierre solaire',
 'La pierre solaire (sólarsteinn en norrois) était probablement de la calcite islandaise (spath d''Islande), capable de polariser la lumière et de révéler la position du soleil par ciel couvert. Des recherches récentes ont confirmé son efficacité pour la navigation en haute mer.',
 true),

-- N14 · qcm
('daily', 'medium', 'faction-nordique', 'qcm',
 'Dans la mythologie norroise, quel événement cosmique final voit les dieux combattre et périr contre les forces du chaos ?',
 'Les dieux eux-mêmes savent qu''ils mourront. Odin connaît la prophétie, Thor sait qu''il tuera le serpent et succombera à son venin. Et pourtant ils combattent.',
 '["Fimbulwinter","Le Ragnarök","La Bataille des Dieux","Le Crépuscule des Dieux"]',
 'Le Ragnarök',
 'Le Ragnarök (destin des puissances) est la fin du monde norrois : Odin est dévoré par Fenrir, Thor tue Jörmungandr mais meurt de son venin, Freyr périt contre Surtr. Mais le monde se renouvelle : une nouvelle terre émergera et des dieux survivants repeupleront un Asgard renaissant.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION ROMAINE (14)
-- ═══════════════════════════════════════════════════════════════

-- R1 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quelle réforme militaire de la fin du IIe siècle av. J.-C. supprima le recrutement censitaire et ouvrit l''armée romaine aux prolétaires sans terre ?',
 'Rome avait grandi grâce à ses légions de paysans-soldats. Mais quand la paysannerie s''effondra, un général ambitieux trouva une solution qui allait transformer la République pour toujours.',
 '["Réforme des Gracques","Réforme marienne","Réforme de Sylla","Réforme de César"]',
 'Réforme marienne',
 'Gaius Marius (consul 7 fois entre 107 et 86 av. J.-C.) ouvrit l''armée aux capite censi (proléaires sans bien). L''État fournissait désormais l''équipement, et les légionnaires devenaient des professionnels liés à leur général plus qu''à Rome, préparant les guerres civiles.',
 true),

-- R2 · free
('daily', 'medium', 'faction-romaine', 'free',
 'Quel terme latin désignait le droit des citoyens romains à faire appel d''une sentence capitale devant l''assemblée du peuple ?',
 'Un citoyen romain ne pouvait être condamné à mort sans recours. Ce droit fondamental distinguait Rome de tous les régimes despotiques qu''elle combattait — du moins en théorie.',
 NULL,
 'Provocatio',
 'La provocatio ad populum (appel au peuple) était un droit constitutionnel romain protégeant les citoyens contre l''arbitraire des magistrats. Codifiée par les lois Valerio-Horatiae de 449 av. J.-C., elle est l''une des premières formes de protection des droits individuels dans l''Antiquité.',
 true),

-- R3 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Contre quel général carthaginois Rome remporta-t-elle la bataille de Zama en 202 av. J.-C., mettant fin à la Deuxième Guerre punique ?',
 'La plaine de Zama vit s''affronter le plus grand général de son époque contre un adversaire qui n''avait jamais perdu une bataille. Rome avait trouvé enfin son digne adversaire de Carthage.',
 '["Hasdrubal","Hamilcar Barca","Hannibal Barca","Mago Barca"]',
 'Hannibal Barca',
 'À Zama (202 av. J.-C.), Scipion l''Africain vainquit Hannibal en neutralisant ses éléphants et en utilisant la cavalerie numide de Massinissa retournée du côté romain. C''était la première défaite d''Hannibal en bataille rangée, après 16 ans de campagnes invincibles en Italie.',
 true),

-- R4 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quel terme désigne la ligne de fortifications romaines construite aux frontières de l''Empire pour se protéger des peuples germaniques ?',
 'La puissance de Rome ne résidait pas seulement dans ses légions mais dans sa capacité à bâtir : routes, aqueducs, et ces longues murailles qui séparaient le monde ordonné du chaos barbare.',
 '["Le Vallum","Le Limes","La Via Militaris","La Clausura"]',
 'Le Limes',
 'Le Limes (frontière, limite) désignait l''ensemble du système défensif aux frontières de l''Empire : fossés, palissades, tours de guet, routes militaires et forts. Le plus célèbre est le Limes germanicus (550 km), classé au patrimoine mondial de l''UNESCO.',
 true),

-- R5 · free
('daily', 'medium', 'faction-romaine', 'free',
 'Quel magistrat romain extraordinaire était investi de tous les pouvoirs pour une durée maximale de six mois en cas de crise grave de la République ?',
 'La République romaine avait inventé une soupape de sécurité : quand la situation devenait trop grave pour les institutions ordinaires, on nommait un seul homme pour tout décider.',
 NULL,
 'Dictateur',
 'Le dictateur romain (dictator) était nommé par un consul sur recommandation du Sénat. Il disposait de l''imperium absolu mais devait abdiquer après six mois ou la fin de la crise. Cincinnatus est le dictateur modèle, qui retourna à sa charrue après avoir sauvé Rome.',
 true),

-- R6 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quelle bataille de 216 av. J.-C. fut la plus catastrophique défaite militaire de Rome, où Hannibal détruisit deux armées consulaires grâce à une manœuvre d''encerclement ?',
 'Rome aligna ce jour-là plus de 70 000 soldats. Au soir, la plupart étaient morts. Un seul général ennemi avait accompli ce que personne n''avait osé imaginer possible.',
 '["Bataille du Tessin","Bataille de la Trébie","Bataille du lac Trasimène","Bataille de Cannes"]',
 'Bataille de Cannes',
 'À Cannes (2 août 216 av. J.-C.), Hannibal mit en œuvre la première grande manœuvre d''encerclement documentée de l''histoire (la "tenaille de Cannes") : ses ailes reculèrent pour envelopper les légions qui avançaient au centre. Environ 50 000 Romains furent tués en une seule journée.',
 true),

-- R7 · free
('daily', 'medium', 'faction-romaine', 'free',
 'Comment s''appelait le bâtiment central des thermes romains où l''eau atteignait sa température maximale, le dernier bain avant de ressortir ?',
 'Les thermes n''étaient pas de simples piscines : c''était un voyage du chaud au froid, une progression rituelle à travers des salles aux températures savamment calculées.',
 NULL,
 'Caldarium',
 'Le caldarium était la salle la plus chaude des thermes romains (40-45°C), chauffée par hypocauste. Le baigneur progressait du frigidarium (eau froide) au tepidarium (eau tiède) puis au caldarium. Les thermes de Caracalla à Rome pouvaient accueillir 1 600 personnes simultanément.',
 true),

-- R8 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quel général romain conquit la Bretagne pour Claude en 43 ap. J.-C. et fut ensuite nommé gouverneur de la nouvelle province ?',
 'L''île des druides résistait depuis des siècles aux convoitises romaines. César l''avait effleurée ; ce fut un autre qui la ceignit vraiment dans les chaînes de l''Empire.',
 '["Gnaeus Julius Agricola","Aulus Plautius","Ostorius Scapula","Suetonius Paulinus"]',
 'Aulus Plautius',
 'Aulus Plautius dirigea l''invasion de la Bretagne (Britannia) avec quatre légions en 43 ap. J.-C. Il remporta la décisive bataille de la Medway et permit à l''Empereur Claude lui-même de venir symboliquement prendre possession de la nouvelle province.',
 true),

-- R9 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quelle institution permettait aux Romains de manumissionner un esclave lors d''un repas, simplement en lui faisant toucher le sel et le pain ?',
 'La liberté avait plusieurs chemins à Rome : certains coûtaient une fortune, d''autres ne coûtaient qu''un geste. Mais tous laissaient une marque indélébile sur le statut social.',
 '["La manumissio vindicta","La manumissio censu","La manumissio inter amicos","La manumissio testamento"]',
 'La manumissio inter amicos',
 'La manumissio inter amicos (affranchissement entre amis) permettait à un maître de libérer son esclave lors d''un repas en présence de témoins. Moins formelle que la vindicta (par magistrat), elle créait un affranchi de statut latin plutôt que citoyen jusqu''à la loi Junia Norbana de 19 ap. J.-C.',
 true),

-- R10 · free
('daily', 'medium', 'faction-romaine', 'free',
 'Quel mot latin désignait le vote secret utilisé lors des élections et des procès romains, inscrit sur une tablette de cire ?',
 'La démocratie romaine avait ses ruses pour protéger l''électeur des pressions des puissants. Une petite tablette permit à des milliers de citoyens de voter selon leur conscience.',
 NULL,
 'Tabella',
 'La lex Gabinia de 139 av. J.-C. introduisit le vote par tablette (tabella) pour les élections, remplaçant le vote oral qui exposait les citoyens aux pressions. Des lois similaires furent ensuite étendues aux procès et aux lois (tabella iudiciaria, tabella de legibus).',
 true),

-- R11 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quel principe juridique romain, encore fondamental aujourd''hui, posait que nul ne peut être juge dans sa propre cause ?',
 'La grandeur de Rome ne résidait pas seulement dans ses armées mais dans ses lois. Certains principes qu''elle énonça traversèrent les siècles pour fonder nos droits modernes.',
 '["Habeas corpus","Nemo iudex in causa sua","In dubio pro reo","Nullum crimen sine lege"]',
 'Nemo iudex in causa sua',
 'Le principe "nemo iudex in causa sua" (nul ne peut être juge dans sa propre affaire) est l''un des fondements de l''impartialité judiciaire. Présent dans le droit romain classique, il fut repris par les juristes médiévaux et reste un principe cardinal de tous les systèmes juridiques modernes.',
 true),

-- R12 · free
('daily', 'medium', 'faction-romaine', 'free',
 'Quel mot latin désignait la formation militaire romaine où les soldats se couvraient mutuellement de leurs boucliers, formant une carapace impénétrable ?',
 'Face aux projectiles ennemis, les légionnaires avaient une réponse collective et géométrique. Ensemble ils devenaient une bête blindée que les flèches ne pouvaient percer.',
 NULL,
 'Testudo',
 'La testudo (tortue) était une formation défensive où les soldats des rangées extérieures tenaient leur bouclier devant et sur les côtés, tandis que ceux du centre les levaient au-dessus. Elle était particulièrement efficace lors des assauts de fortifications sous les projectiles.',
 true),

-- R13 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quelle révolte d''esclaves, menée entre 73 et 71 av. J.-C., fut l''une des plus graves crises intérieures de la République romaine tardive ?',
 'Des milliers d''hommes enchaînés choisirent de mourir libres plutôt que de vivre comme propriété. Leur chef devint une légende que Rome ne put effacer malgré six mille croix dressées sur la Voie Appienne.',
 '["Révolte de Sicile de Eunous","Révolte de Spartacus","Révolte de Salvius Tryphon","Révolte de Perpenna"]',
 'Révolte de Spartacus',
 'Spartacus, gladiateur thrace, lança sa révolte depuis Capoue en 73 av. J.-C. Son armée atteignit 120 000 hommes et infligea plusieurs défaites aux armées romaines. Crassus l''écrasa en 71 av. J.-C. et fit crucifier 6 000 survivants le long de la Via Appia de Capoue à Rome.',
 true),

-- R14 · qcm
('daily', 'medium', 'faction-romaine', 'qcm',
 'Quel titre romain, signifiant littéralement "premier citoyen", fut adopté par Auguste pour voiler sa monarchie derrière une façade républicaine ?',
 'Auguste avait appris de César : ne jamais nommer ouvertement ce que l''on est. En se proclamant simple citoyen parmi d''autres, il régna en fait comme aucun roi n''avait osé le faire.',
 '["Imperator","Pontifex Maximus","Princeps","Dictator perpetuo"]',
 'Princeps',
 'Auguste adopta le titre de princeps (premier citoyen) pour éviter de paraître roi, terme honni depuis l''expulsion de Tarquin. Le "Principat" qu''il inaugurea maintint les formes républicaines (Sénat, magistratures) tout en concentrant les pouvoirs militaire, civil et religieux en une seule main.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION BYZANTINE (13)
-- ═══════════════════════════════════════════════════════════════

-- B1 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quel Empereur byzantin du VIe siècle fit compiler tout le droit romain en un seul corpus légal, encore étudié dans les facultés de droit ?',
 'Un seul homme ordonna de rassembler mille ans de droit romain épars en une œuvre cohérente. Ce qu''il accomplit en quelques années allait gouverner l''Europe pendant des siècles.',
 '["Théodose II","Justinien Ier","Héraclius","Basile II"]',
 'Justinien Ier',
 'Justinien Ier fit compiler le Corpus Juris Civilis entre 529 et 534, sous la direction du juriste Tribonien. Il comprend le Code (constitutions impériales), les Pandectes (jurisprudence), les Institutes (manuel) et les Novelles. C''est le fondement du droit civil continental européen.',
 true),

-- B2 · free
('daily', 'medium', 'faction-byzantine', 'free',
 'Quel nom portait l''arme secrète byzantine projetant un liquide enflammé impossible à éteindre par l''eau, utilisée notamment contre les flottes arabes ?',
 'Constantinople résista à des dizaines de sièges grâce à ses murailles et à un secret jalousement gardé. Ce secret brûlait sur l''eau elle-même, rendant la mer aussi dangereuse que la terre.',
 NULL,
 'Feu grégeois',
 'Le feu grégeois (pyr Rhōmaïkon, "feu romain") fut utilisé dès 673 contre la flotte arabe lors du premier siège de Constantinople. Sa composition exacte reste inconnue mais incluait probablement de la chaux vive, du soufre et de la naphte. Il contribua à préserver l''Empire byzantin pendant des siècles.',
 true),

-- B3 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quelle crise iconoclaste byzantine, qui durait depuis 726, fut-elle définitivement résolue par le Deuxième Concile de Nicée en 787 ?',
 'Faut-il adorer les images de Dieu et des saints, ou est-ce une idolâtrie que même les Arabes et les Juifs moquent ? La question déchira l''Empire pendant un siècle.',
 '["La querelle des images","L''iconoclasme","La querelle monophysite","La querelle nestorienne"]',
 'L''iconoclasme',
 'L''iconoclasme (destruction des images) fut lancé par Léon III en 726 et provoqua une crise majeure. Le Deuxième Concile de Nicée (787) rétablit le culte des icônes, distinguant la proskynèse (vénération) de la latreia (adoration due à Dieu seul). L''iconoclasme reprit de 814 à 842.',
 true),

-- B4 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quel Patriarche de Constantinople, excommunié par Rome en 1054, fut l''un des acteurs du Grand Schisme entre Chrétienté orientale et occidentale ?',
 'Deux frères en Christ qui s''étaient affrontés sur des mots pendant des siècles finirent par s''excommunier mutuellement. La rupture de 1054 n''a jamais été totalement réparée.',
 '["Michel Cérulaire","Photius","Jean IV le Jeûneur","Ignace de Constantinople"]',
 'Michel Cérulaire',
 'Michel Cérulaire (Patriarche 1043-1058) fut excommunié par le légat papal Humbert de Moyenmoutier le 16 juillet 1054, date du Grand Schisme. Il répliqua en excommuniant les légats. Le différend portait sur le Filioque, l''autorité papale et des pratiques liturgiques divergentes.',
 true),

-- B5 · free
('daily', 'medium', 'faction-byzantine', 'free',
 'Comment s''appelait le principal hipodrome de Constantinople, adjacent au palais impérial, théâtre de courses de chars mais aussi de séditions populaires ?',
 'Plus qu''un simple stade, c''était le cœur politique de Constantinople. Les factions colorées qui s''y affrontaient pouvaient renverser un Empereur ou en sauver un autre.',
 NULL,
 'Hippodrome',
 'L''Hippodrome de Constantinople (Ἱππόδρομος) fut agrandi par Constantin en 324. Long de 450m, il pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y organisèrent la révolte de Nika en 532, qui faillit coûter le trône à Justinien avant que Bélisaire n''écrase les insurgés.',
 true),

-- B6 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quel général de Justinien reconquit l''Italie aux Ostrogoths et l''Afrique du Nord aux Vandales dans les années 530-540 ?',
 'Un seul homme, avec peu de troupes mais un génie tactique exceptionnel, reconquit en quelques années ce que Rome avait perdu en un siècle. Justinien lui en voulut presque pour ça.',
 '["Narsès","Bélisaire","Mundus","Jean l''Arménien"]',
 'Bélisaire',
 'Bélisaire reconquit l''Afrique du Nord aux Vandales (533-534) et lança la reconquête de l''Italie (535-540), prenant Rome et Ravenne. Sa jalousie avec Narsès et la méfiance de Justinien limitèrent ses succès ultérieurs. Il reste l''un des plus grands généraux de l''Antiquité tardive.',
 true),

-- B7 · free
('daily', 'medium', 'faction-byzantine', 'free',
 'Quel terme byzantin désignait le système administratif divisant l''Empire en grandes provinces militaro-civiles dirigées par un stratège, mis en place au VIIe siècle ?',
 'Face aux invasions arabes et slaves qui menaçaient l''Empire de toutes parts, Constantinople réorganisa son territoire. Le nouveau système fusionna pouvoir civil et militaire pour réagir plus vite.',
 NULL,
 'Thème',
 'Le système des thèmes (θέματα) fut développé sous Héraclius et ses successeurs au VIIe siècle. Chaque thème était gouverné par un stratège (général) qui détenait à la fois le commandement militaire et le gouvernement civil. Ce système décentralisé permit à Byzance de survivre aux invasions.',
 true),

-- B8 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quelle impératrice byzantine du IXe siècle rétablit définitivement le culte des icônes en 843, événement célébré encore aujourd''hui comme le "Triomphe de l''Orthodoxie" ?',
 'Une femme gouvernait au nom de son fils mineur quand elle trancha le débat qui avait déchiré l''Empire depuis un siècle. Son choix définit le visage de l''Église orthodoxe pour toujours.',
 '["Théodora (femme de Théophile)","Irène d''Athènes","Zoé Porphyrogénète","Eudocie Makrembolitissa"]',
 'Théodora (femme de Théophile)',
 'Théodora, régente pour son fils Michel III après la mort de Théophile (842), convoqua un synode qui rétablit le culte des icônes le 11 mars 843 (premier dimanche de Carême). Ce "Triomphe de l''Orthodoxie" est encore commémoré chaque année dans les Églises orthodoxes.',
 true),

-- B9 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quel siège de 1204 vit des Croisés catholiques saccager Constantinople, divisant l''Empire byzantin en États successeurs et provoquant un traumatisme durable dans la chrétienté orientale ?',
 'Les guerriers de la Croix, partis pour libérer Jérusalem, se retournèrent contre leurs frères chrétiens. Ce qu''ils firent à la Reine des Villes ne fut jamais pardonné.',
 '["Quatrième Croisade","Troisième Croisade","Croisade des Albigeois","Deuxième Croisade"]',
 'Quatrième Croisade',
 'La Quatrième Croisade (1202-1204), détournée par Venise, aboutit au sac de Constantinople du 12 avril 1204. Les croisés pillèrent l''une des villes les plus riches du monde et fondèrent l''Empire latin. Les trésors volés, dont les Chevaux de Saint-Marc, ornent encore Venise.',
 true),

-- B10 · free
('daily', 'medium', 'faction-byzantine', 'free',
 'Quel type de fonctionnaire byzantin, castré dès l''enfance ou la jeunesse, occupait souvent les plus hautes charges de l''État et de la cour impériale ?',
 'L''Empire byzantin avait trouvé une solution paradoxale au problème des ambitions dynastiques : confier le pouvoir à des hommes qui ne pouvaient pas fonder de lignées.',
 NULL,
 'Eunuque',
 'Les eunuques (εὐνοῦχοι) occupèrent dans l''Empire byzantin des postes de confiance au palais (parakoimomenos, protovestiaire) et dans l''Église. Leur castration les excluant de la succession impériale, ils étaient considérés comme loyaux par nature. Narsès, le conquérant de l''Italie, était eunuque.',
 true),

-- B11 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quel Empereur byzantin du Xe siècle, dit le "Tueur de Bulgares" (Boulgaroktonos), fit crever les yeux de 15 000 prisonniers bulgares après la bataille de Kleidion en 1014 ?',
 'Certaines victoires laissent des traces dans les mémoires pour des siècles. Quand les prisonniers aveuglés rentrèrent chez eux, leur tsar mourut de saisissement.',
 '["Nicéphore Phocas","Jean Tzimiskès","Basile II","Constantin VIII"]',
 'Basile II',
 'Basile II (976-1025) imposa la puissance byzantine dans les Balkans et fit crever les yeux de 15 000 prisonniers à Kleidion (1014), laissant un œil à chaque centième pour guider les autres. Le tsar Samuel, en voyant ses guerriers revenir ainsi, mourut d''une apoplexie deux jours après.',
 true),

-- B12 · free
('daily', 'medium', 'faction-byzantine', 'free',
 'Quel schéma doctrinal, affirmant que le Christ n''a qu''une seule nature (divine), causa une rupture durable entre Constantinople et les Églises d''Égypte et d''Éthiopie ?',
 'Une seule lettre de différence dans la formulation théologique put diviser des communautés chrétiennes pour des siècles. L''Égypte, la Syrie et l''Arménie choisirent leur lecture — et restèrent séparées.',
 NULL,
 'Monophysisme',
 'Le monophysisme (du grec monos, seul, et physis, nature) soutient que le Christ a une seule nature divine après l''Incarnation. Condamné au Concile de Chalcédoine (451), il fut adopté par les Églises copte (Égypte), éthiopienne, arménienne et syriaque, qui se séparèrent de Constantinople.',
 true),

-- B13 · qcm
('daily', 'medium', 'faction-byzantine', 'qcm',
 'Quelle bataille de 1071 vit la défaite décisive de Byzance face aux Seldjoukides, ouvrant l''Anatolie à la colonisation turque ?',
 'En un seul après-midi, le destin d''une région fut scellé pour mille ans. L''Anatolie, cœur nourricier de l''Empire, allait lentement changer de visage, de langue et de foi.',
 '["Bataille de Manzikert","Bataille de Myriokephalon","Bataille de Antioche","Bataille de Nicée"]',
 'Bataille de Manzikert',
 'À Manzikert (26 août 1071), l''Empereur Romain IV Diogène fut capturé par le Sultan Alp Arslan. Cette défaite ouvrit l''Anatolie centrale aux migrations turques seldjoukides, réduisant progressivement la base démographique et économique de Byzance. Elle est souvent vue comme le début du déclin irréversible de l''Empire.',
 true);
