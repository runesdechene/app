-- 018_v05_seed_enigmas.sql
-- Seed : 50 énigmes quotidiennes (20 easy, 20 medium, 10 hard)

INSERT INTO enigmas (type, difficulty, heritage_id, lore_text, question, format, choices, answer, explanation, active) VALUES

-- ═══════════════════════════════════════════════════════════════
-- EASY (20)
-- ═══════════════════════════════════════════════════════════════

-- 1 · Celtique · Easy
('daily', 'easy', 'faction-celtique',
 'Pline l''Ancien raconte qu''une fois l''an, un druide vêtu de blanc grimpait dans un arbre sacré, armé d''une serpe d''or. Ce qu''il cueillait valait plus que de l''or aux yeux des Gaulois.',
 'Quelle plante les druides récoltaient-ils cérémonieusement sur les chênes, selon Pline l''Ancien ?',
 'qcm',
 '["Le lierre","Le gui","La bruyère","Le houx"]',
 'Le gui',
 'Pline (Histoire naturelle, XVI) décrit la récolte du gui au sixième jour de la lune, suivie du sacrifice de deux taureaux blancs. Le gui de chêne, extrêmement rare, était considéré comme un don divin.',
 true),

-- 2 · Nordique · Easy
('daily', 'easy', 'faction-nordique',
 'Ils partaient de Scandinavie sur des navires à fond plat, capables de remonter les fleuves. Leurs voiles rayées terrorisaient les côtes de l''Europe pendant trois siècles.',
 'Comment appelle-t-on les navires longs des Vikings, conçus pour la guerre et l''exploration ?',
 'qcm',
 '["Kogge","Drakkar","Trirème","Galion"]',
 'Drakkar',
 'Le mot "drakkar" vient du norrois "dreki" (dragon), car la proue était souvent ornée d''une tête de dragon. Ces navires pouvaient transporter 60 guerriers et naviguer aussi bien en haute mer que sur des rivières peu profondes.',
 true),

-- 3 · Byzantin · Easy
('daily', 'easy', 'faction-byzantine',
 'En 330, Constantin déplace le cœur de l''Empire vers l''Orient. La ville qu''il fonde survivra mille ans à celle qu''il quitte.',
 'Quel nom portait Constantinople avant que Constantin ne la rebaptise ?',
 'qcm',
 '["Nicée","Antioche","Byzance","Éphèse"]',
 'Byzance',
 'La cité grecque de Byzance, fondée vers 657 av. J.-C. par des colons de Mégare, contrôlait le détroit du Bosphore. Constantin y vit l''emplacement stratégique parfait pour sa nouvelle capitale, entre Europe et Asie.',
 true),

-- 4 · Romain · Easy
('daily', 'easy', 'faction-romaine',
 'Quand les légions s''arrêtaient pour la nuit, elles ne dormaient jamais à la belle étoile. En quelques heures, elles bâtissaient une forteresse temporaire — chaque soir, depuis des siècles.',
 'Comment appelle-t-on le camp fortifié que les légions romaines construisaient chaque soir en territoire ennemi ?',
 'qcm',
 '["L''oppidum","Le castrum","Le forum","La villa"]',
 'Le castrum',
 'Un castrum pouvait être érigé en 3 à 5 heures par une légion entraînée : fossé, palissade, rues en grille, tentes ordonnées. Beaucoup de villes européennes actuelles (Chester, Castra Regina/Ratisbonne) sont nées de ces camps devenus permanents.',
 true),

-- 5 · Celtique · Easy
('daily', 'easy', 'faction-celtique',
 'Avant la conquête romaine, les Gaulois frappaient monnaie. Leurs pièces d''or rivalisaient avec les statères grecs — et les motifs qu''ils y gravaient n''avaient rien de primitif.',
 'Quel peuple gaulois a donné son nom à la ville de Paris ?',
 'qcm',
 '["Les Sénons","Les Éduens","Les Parisii","Les Arvernes"]',
 'Les Parisii',
 'Les Parisii occupaient l''île de la Cité et ses environs. Leur oppidum, Lutèce, était un carrefour commercial sur la Seine. Leurs monnaies d''or, retrouvées jusqu''en Angleterre, témoignent d''un réseau d''échanges considérable.',
 true),

-- 6 · Nordique · Easy
('daily', 'easy', 'faction-nordique',
 'L''écriture des peuples germaniques et scandinaves n''utilisait ni parchemin ni encre. Chaque signe était taillé dans le bois ou la pierre, fait de lignes droites — plus faciles à graver qu''à tracer.',
 'Comment appelle-t-on l''alphabet utilisé par les peuples nordiques avant la christianisation ?',
 'qcm',
 '["Les hiéroglyphes","Les runes","Les ogham","Les cunéiformes"]',
 'Les runes',
 'Le futhark ancien (du nom de ses six premières lettres : F-U-Þ-A-R-K) compte 24 runes. Chaque signe avait un nom et une signification au-delà du son : *fehu* (bétail/richesse), *ansuz* (dieu/Odin). Les plus anciennes inscriptions runiques datent du IIe siècle.',
 true),

-- 7 · Byzantin · Easy
('daily', 'easy', 'faction-byzantine',
 'Quand les barbares ont submergé Rome en 476, une moitié de l''Empire a continué comme si de rien n''était. Pendant mille ans encore, elle a maintenu le droit, la foi et les routes commerciales.',
 'En quelle année Constantinople est-elle finalement tombée aux mains des Ottomans ?',
 'qcm',
 '["1204","1389","1453","1492"]',
 '1453',
 'Le 29 mai 1453, après un siège de 53 jours, Mehmed II entre dans la ville. Les murailles théodosiennes, imprenables pendant un millénaire, ont cédé face aux canons géants de l''ingénieur hongrois Urbain. Le dernier empereur, Constantin XI, est mort les armes à la main.',
 true),

-- 8 · Romain · Easy
('daily', 'easy', 'faction-romaine',
 'Une route droite, pavée de pierres taillées, bordée de bornes milliaires. On dit qu''elle menait partout — et c''était presque vrai.',
 'Quelle expression latine signifie que « tous les chemins mènent à Rome » et désigne la borne d''or du Forum ?',
 'qcm',
 '["Via Appia","Milliarium Aureum","Cursus Publicum","Pax Romana"]',
 'Milliarium Aureum',
 'Auguste fit ériger le Milliarium Aureum (borne milliaire dorée) au Forum en 20 av. J.-C. Toutes les distances de l''Empire étaient mesurées depuis ce point. Le réseau routier romain couvrait 400 000 km — dont certains tronçons sont encore visibles aujourd''hui.',
 true),

-- 9 · Celtique · Easy
('daily', 'easy', 'faction-celtique',
 'Des milliers de pierres dressées, alignées sur des kilomètres, dans la lande bretonne. Personne ne sait vraiment pourquoi elles sont là — et ça dure depuis 6 000 ans.',
 'Dans quelle commune bretonne trouve-t-on le plus célèbre alignement mégalithique d''Europe ?',
 'qcm',
 '["Locmariaquer","Carnac","Brocéliande","Stonehenge"]',
 'Carnac',
 'Les alignements de Carnac comptent près de 3 000 menhirs répartis sur 4 km, érigés entre 4500 et 3300 av. J.-C. — bien avant les pyramides. Leur fonction exacte reste débattue : calendrier astronomique, chemin processionnaire, marqueur territorial ?',
 true),

-- 10 · Nordique · Easy
('daily', 'easy', 'faction-nordique',
 'Chaque guerrier nordique rêvait d''y festoyer après la mort, attablé devant un sanglier éternellement renaissant, une corne d''hydromel à la main.',
 'Comment s''appelle le palais d''Odin où les guerriers tombés au combat sont accueillis ?',
 'qcm',
 '["Asgard","Le Walhalla","Midgard","Helheim"]',
 'Le Walhalla',
 'Le Valhöll ("hall des occis") n''accueillait que les guerriers morts les armes à la main, choisis par les Valkyries. Ils y combattaient chaque jour et festoyaient chaque nuit, en attendant le Ragnarök — la bataille finale des dieux.',
 true),

-- 11 · Romain · Easy
('daily', 'easy', 'faction-romaine',
 'Sous la République puis l''Empire, un citoyen romain pouvait se baigner, faire du sport, lire, discuter philosophie et conclure des affaires — le tout dans un seul bâtiment public.',
 'Comment appelle-t-on les grands complexes de bains publics romains ?',
 'qcm',
 '["Les arènes","Les thermes","Les basiliques","Les gymnases"]',
 'Les thermes',
 'Les thermes de Caracalla à Rome (216 ap. J.-C.) pouvaient accueillir 1 600 baigneurs simultanément. On y trouvait bibliothèques, jardins, salles de sport et boutiques. L''entrée était gratuite ou quasi gratuite — c''était un service public essentiel.',
 true),

-- 12 · Byzantin · Easy
('daily', 'easy', 'faction-byzantine',
 'Justinien voulait bâtir un lieu de culte qui ferait oublier le temple de Salomon. Il y a consacré les revenus fiscaux de l''Empire pendant cinq ans. Le résultat a stupéfié le monde.',
 'Quel monument Justinien a-t-il fait construire à Constantinople en 537 ?',
 'qcm',
 '["Le Palais de Topkapi","La Mosquée bleue","Sainte-Sophie","Sainte-Irène"]',
 'Sainte-Sophie',
 'La basilique Sainte-Sophie (Hagia Sophia) possédait la plus grande coupole du monde pendant près de 1 000 ans (31 mètres de diamètre). À sa consécration, Justinien aurait déclaré : « Salomon, je t''ai surpassé. »',
 true),

-- 13 · Celtique · Easy
('daily', 'easy', 'faction-celtique',
 'César écrit que les Gaulois « se considèrent tous comme descendants du même dieu ». Ce dieu de la nuit et des morts fondait leur calendrier et leur conception du temps — qui commençait par l''obscurité.',
 'Selon César, de quel dieu les Gaulois prétendaient-ils tous descendre ?',
 'qcm',
 '["Toutatis","Lug","Dis Pater","Cernunnos"]',
 'Dis Pater',
 'César (Guerre des Gaules, VI.18) écrit que les druides enseignaient cette filiation. Dis Pater est l''interprétation romaine — le nom gaulois réel nous échappe. Cette croyance explique pourquoi les Gaulois comptaient le temps par nuits et non par jours.',
 true),

-- 14 · Romain · Easy
('daily', 'easy', 'faction-romaine',
 'Deux mille ans après sa construction, il est toujours debout, avec son oculus ouvert sur le ciel. Quand il pleut, l''eau entre — et s''évacue par un système de drainage toujours fonctionnel.',
 'Quel temple romain, bâti sous Hadrien, possède la plus grande coupole en béton non armé jamais construite ?',
 'qcm',
 '["Le Colisée","Le Panthéon","Le temple de Jupiter","La Maison carrée"]',
 'Le Panthéon',
 'La coupole du Panthéon (43,3 m de diamètre) n''a été surpassée qu''au XVe siècle par Brunelleschi à Florence. Le béton romain, à base de cendres volcaniques (pouzzolane), se renforce avec le temps au contact de l''eau — l''exact opposé du béton moderne.',
 true),

-- 15 · Nordique · Easy
('daily', 'easy', 'faction-nordique',
 'Un alphabet de glace et de feu, gravé sur des pierres dressées dans toute la Scandinavie. Chaque inscription est un message laissé aux vivants par ceux qui savaient tailler la pierre.',
 'Combien de runes compte le futhark ancien, l''alphabet runique le plus répandu ?',
 'qcm',
 '["16","20","24","32"]',
 '24',
 'Le futhark ancien (IIe-VIIIe siècle) compte 24 runes, divisées en trois groupes de huit (ættir). Les Vikings l''ont simplifié en futhark récent à 16 runes — paradoxalement, moins de signes pour noter plus de sons, rendant les inscriptions plus ambiguës.',
 true),

-- 16 · Byzantin · Easy
('daily', 'easy', 'faction-byzantine',
 'Deux frères de Thessalonique, envoyés en mission chez les Slaves, ont inventé un système d''écriture pour traduire la Bible. Leur héritage se lit encore dans la moitié de l''Europe.',
 'Quel alphabet, créé par les disciples de Cyrille et Méthode, est encore utilisé en Russie, Serbie et Bulgarie ?',
 'qcm',
 '["L''alphabet glagolitique","L''alphabet cyrillique","L''alphabet copte","L''alphabet arménien"]',
 'L''alphabet cyrillique',
 'Cyrille a d''abord créé l''alphabet glagolitique vers 863. Ses disciples ont ensuite développé le cyrillique, plus simple et basé sur l''onciale grecque. Aujourd''hui, plus de 250 millions de personnes utilisent cet alphabet au quotidien.',
 true),

-- 17 · Celtique · Easy
('daily', 'easy', 'faction-celtique',
 'En 52 av. J.-C., un jeune chef arverne unit les tribus gauloises pour la première — et dernière — fois. Sa défaite finale est devenue le mythe fondateur de la résistance gauloise.',
 'Quel chef gaulois a mené la grande révolte contre César en 52 av. J.-C. ?',
 'qcm',
 '["Ambiorix","Vercingétorix","Brennus","Diviciacus"]',
 'Vercingétorix',
 'Son nom signifie « roi suprême des guerriers » (ver-cingeto-rix). Après sa victoire à Gergovie, il a été vaincu à Alésia par le siège de César. Emprisonné six ans à Rome, il a été étranglé lors du triomphe de César en 46 av. J.-C.',
 true),

-- 18 · Romain · Easy
('daily', 'easy', 'faction-romaine',
 'En 79, le Vésuve a englouti deux villes sous des mètres de cendres. Dix-sept siècles plus tard, les archéologues ont retrouvé des pains intacts, des fresques éclatantes et des corps figés dans leur dernier geste.',
 'Quelle ville romaine, ensevelie par le Vésuve en 79 ap. J.-C., est le site archéologique le plus visité d''Italie ?',
 'qcm',
 '["Herculanum","Pompéi","Stabies","Oplontis"]',
 'Pompéi',
 'Pompéi comptait environ 11 000 habitants. Les cendres ont préservé un instantané de la vie quotidienne romaine : tavernes, lupanars, graffitis politiques. On y a retrouvé des slogans électoraux peints sur les murs — la plus ancienne propagande politique conservée.',
 true),

-- 19 · Nordique · Easy
('daily', 'easy', 'faction-nordique',
 'Un guerrier nordique pouvait entrer en transe au combat, mordant son bouclier, hurlant comme une bête. Ni la douleur ni la peur ne semblaient l''atteindre — ses ennemis le croyaient possédé.',
 'Comment appelle-t-on ces guerriers vikings réputés combattre dans une fureur sacrée incontrôlable ?',
 'qcm',
 '["Les Ulfhednar","Les Berserkers","Les Jomsvikings","Les Housecarls"]',
 'Les Berserkers',
 'Le mot vient du norrois "berserkr" — peut-être "chemise d''ours" (ber-serkr). Les sagas décrivent leur furie au combat (berserksgangr). Les théories modernes évoquent l''amanite tue-mouches, l''auto-hypnose ou un état de stress extrême. Plusieurs lois scandinaves médiévales ont fini par interdire le berserksgangr.',
 true),

-- 20 · Byzantin · Easy
('daily', 'easy', 'faction-byzantine',
 'L''hippodrome de Constantinople n''était pas qu''un cirque — c''était le cœur politique de l''Empire. Les factions de supporters y faisaient et défaisaient les empereurs.',
 'Quelles étaient les deux principales factions rivales de l''hippodrome de Constantinople ?',
 'qcm',
 '["Rouges et Noirs","Bleus et Verts","Blancs et Pourpres","Or et Argent"]',
 'Bleus et Verts',
 'Les Bleus (aristocrates, orthodoxes) et les Verts (marchands, monophysites) étaient bien plus que des clubs sportifs. En 532, leur révolte commune (sédition Nika) a failli renverser Justinien et détruit la moitié de Constantinople avant d''être écrasée dans le sang — 30 000 morts dans l''hippodrome.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- MEDIUM (20)
-- ═══════════════════════════════════════════════════════════════

-- 21 · Celtique · Medium
('daily', 'medium', 'faction-celtique',
 'Les archéologues ont retrouvé des crânes percés datant du Néolithique, avec des signes de cicatrisation — preuve que le patient a survécu. Nos ancêtres ouvraient le crâne des vivants, et certains s''en remettaient.',
 'Comment appelle-t-on l''opération chirurgicale consistant à percer un trou dans le crâne, pratiquée dès le Néolithique en Europe ?',
 'qcm',
 '["La trépanation","La craniotomie","La lobotomie","La cautérisation"]',
 'La trépanation',
 'Des crânes trépanés avec repousse osseuse (donc survie du patient) ont été retrouvés à Ensisheim (Alsace, 5000 av. J.-C.). Le taux de survie estimé dépasse 50 % — comparable à celui des chirurgiens de la guerre de Sécession, 7 000 ans plus tard.',
 true),

-- 22 · Nordique · Medium
('daily', 'medium', 'faction-nordique',
 'Bien avant Christophe Colomb, des marins nordiques ont posé le pied sur un continent inconnu. Ils y ont trouvé du raisin sauvage et des prairies verdoyantes — mais n''ont pas pu s''y maintenir.',
 'Comment les Vikings appelaient-ils la terre qu''ils ont découverte en Amérique du Nord vers l''an 1000 ?',
 'qcm',
 '["Groenland","Markland","Vinland","Helluland"]',
 'Vinland',
 'Leif Eriksson a atteint le Vinland (« terre de la vigne ») vers l''an 1000. Le site de L''Anse aux Meadows (Terre-Neuve), fouillé en 1960, a confirmé la présence viking en Amérique. Les sagas mentionnent des conflits avec les autochtones (Skrælings) qui ont forcé l''abandon de la colonie.',
 true),

-- 23 · Byzantin · Medium
('daily', 'medium', 'faction-byzantine',
 'Sur les murs de la flotte impériale, des siphons crachaient un feu liquide que l''eau ne pouvait éteindre. L''arme la plus redoutée de la Méditerranée médiévale — et personne ne connaît la recette.',
 'Comment appelle-t-on l''arme incendiaire secrète utilisée par la marine byzantine, dont la composition reste inconnue ?',
 'qcm',
 '["Le naphta","Le feu grégeois","L''huile ardente","Le soufre liquide"]',
 'Le feu grégeois',
 'Inventé vers 672, le feu grégeois brûlait sur l''eau et ne pouvait être éteint qu''avec du sable ou du vinaigre. Sa recette était un secret d''État si bien gardé qu''il s''est perdu à la chute de l''Empire. Les historiens pensent à un mélange de naphte, résine et chaux vive, mais aucune reconstitution moderne n''a reproduit tous les effets décrits.',
 true),

-- 24 · Romain · Medium
('daily', 'medium', 'faction-romaine',
 'Le béton romain résiste depuis deux millénaires. Les ports romains immergés sont toujours solides. Notre béton moderne commence à se fissurer au bout de 50 ans. Leur secret ? Une réaction chimique que nous venons à peine de comprendre.',
 'Quel ingrédient volcanique donne au béton romain sa résistance exceptionnelle à l''eau de mer ?',
 'qcm',
 '["Le basalte","La pouzzolane","L''obsidienne","Le tuf"]',
 'La pouzzolane',
 'La pouzzolane (cendres volcaniques de Pouzzoles) réagit avec la chaux et l''eau de mer pour former des cristaux d''aluminium tobermorite, qui se renforcent avec le temps. Une étude de 2017 (University of Utah) a montré que l''eau de mer renforce le béton romain au lieu de le détruire — l''exact inverse du béton Portland moderne.',
 true),

-- 25 · Celtique · Medium
('daily', 'medium', 'faction-celtique',
 'Les Romains décrivent avec horreur une coutume gauloise : après la bataille, les guerriers fixaient les têtes de leurs ennemis vaincus sur les portes de leurs maisons. Pour eux, c''était un honneur — pas de la barbarie.',
 'Selon les auteurs antiques et l''archéologie, que faisaient les Gaulois avec les têtes de leurs ennemis vaincus ?',
 'qcm',
 '["Ils les brûlaient en offrande","Ils les embaumaient et les exposaient","Ils les enterraient avec les leurs","Ils les jetaient dans les rivières"]',
 'Ils les embaumaient et les exposaient',
 'Diodore de Sicile et Strabon confirment cette pratique. Au sanctuaire de Roquepertuse (Bouches-du-Rhône), des piliers percés de niches contenaient des crânes humains. Pour les Celtes, la tête était le siège de l''âme — posséder celle d''un ennemi, c''était capturer sa force.',
 true),

-- 26 · Nordique · Medium
('daily', 'medium', 'faction-nordique',
 'Des guerriers scandinaves se sont mis au service de l''empereur de Constantinople. Ils formaient sa garde personnelle — les hommes les plus grands, les mieux armés, et les plus loyaux de l''Empire.',
 'Comment s''appelait la garde d''élite de l''empereur byzantin, composée de guerriers scandinaves ?',
 'qcm',
 '["Les Jomsvikings","La Garde varangienne","Les Housecarls","Les Thegns"]',
 'La Garde varangienne',
 'La Garde varangienne (du norrois "væringi", « ceux qui ont prêté serment ») a protégé les empereurs byzantins du Xe au XIVe siècle. Harald Hardrada, futur roi de Norvège, en a fait partie. Ils étaient payés en or et avaient le droit de « piller le palais » à la mort de chaque empereur.',
 true),

-- 27 · Byzantin · Medium
('daily', 'medium', 'faction-byzantine',
 'En 1204, une armée chrétienne censée libérer Jérusalem s''est retournée contre la plus grande ville chrétienne du monde. Le sac qui a suivi a choqué l''Europe entière.',
 'Quelle croisade a abouti au sac de Constantinople par les croisés eux-mêmes en 1204 ?',
 'qcm',
 '["La deuxième croisade","La troisième croisade","La quatrième croisade","La cinquième croisade"]',
 'La quatrième croisade',
 'Détournée par Venise (qui finançait la flotte), la quatrième croisade a pillé Constantinople pendant trois jours. Les croisés ont volé les chevaux de bronze de l''hippodrome (aujourd''hui à Venise), fondu des œuvres d''art en lingots, et profané Sainte-Sophie. L''Empire latin qu''ils ont fondé n''a duré que 57 ans.',
 true),

-- 28 · Romain · Medium
('daily', 'medium', 'faction-romaine',
 'Les Romains ont construit un mur de 117 km à travers l''Angleterre — puis un second, plus au nord, en Écosse. Le mur d''Écosse a été abandonné après seulement 20 ans. Trop de résistance picte.',
 'Comment s''appelle le mur romain construit en Écosse, plus au nord que le mur d''Hadrien, et rapidement abandonné ?',
 'qcm',
 '["Le mur de Trajan","Le mur d''Antonin","Le mur de Septime Sévère","Le mur de Marc Aurèle"]',
 'Le mur d''Antonin',
 'Construit en 142 sous Antonin le Pieux, ce mur de tourbe et de bois s''étendait sur 63 km entre le Firth of Forth et le Firth of Clyde. Abandonné vers 162, il marque la limite nord de l''expansion romaine. Les Pictes au-delà n''ont jamais été soumis — Rome a renoncé.',
 true),

-- 29 · Celtique · Medium
('daily', 'medium', 'faction-celtique',
 'En 390 av. J.-C., des guerriers gaulois entrent dans Rome elle-même. Le chef qui mène le sac exige une rançon en or — et quand les Romains protestent contre les poids truqués, il jette son épée dans la balance.',
 'Quel chef gaulois, lors du sac de Rome, aurait lancé « Vae victis ! » (Malheur aux vaincus !) ?',
 'qcm',
 '["Vercingétorix","Ambiorix","Brennus","Diviciacos"]',
 'Brennus',
 'Brennus et ses Sénons ont pris Rome en 390 av. J.-C. (date traditionnelle). Seul le Capitole a résisté, sauvé — selon la légende — par les oies sacrées de Junon. Le traumatisme du « dies Alliensis » a hanté Rome pendant des siècles et motivé la future conquête de la Gaule.',
 true),

-- 30 · Nordique · Medium
('daily', 'medium', 'faction-nordique',
 'En 885, une flotte de centaines de navires remonte la Seine. Paris est assiégée pendant un an. Mais cette fois, la ville résiste — et un comte franc entre dans la légende.',
 'Quel comte a défendu Paris lors du grand siège viking de 885-886 ?',
 'qcm',
 '["Charles le Chauve","Eudes de Paris","Rollon le Marcheur","Robert le Fort"]',
 'Eudes de Paris',
 'Eudes (Odo), comte de Paris, a tenu la ville avec quelques centaines d''hommes contre peut-être 30 000 Vikings. Le roi Charles le Gros, arrivé avec une armée, a préféré payer les Vikings pour qu''ils partent — ce qui lui a coûté sa couronne. Eudes est devenu roi des Francs en 888.',
 true),

-- 31 · Romain · Medium
('daily', 'medium', 'faction-romaine',
 'Les ingénieurs romains amenaient l''eau des montagnes jusqu''au cœur des villes, parfois sur plus de 50 km. Ils maintenaient une pente constante de quelques centimètres par kilomètre — sans GPS ni laser.',
 'Quel aqueduc romain du sud de la France, classé au patrimoine mondial, enjambe le Gardon sur trois niveaux d''arches ?',
 'qcm',
 '["L''aqueduc de Ségovie","Le pont du Gard","L''aqueduc de Zaghouan","Les arches de Valens"]',
 'Le pont du Gard',
 'Construit au Ier siècle pour alimenter Nîmes (Nemausus), le pont du Gard culmine à 49 mètres. L''aqueduc complet faisait 50 km avec une pente de seulement 24,8 cm par kilomètre. Les blocs de 6 tonnes sont assemblés sans mortier — et tiennent toujours.',
 true),

-- 32 · Byzantin · Medium
('daily', 'medium', 'faction-byzantine',
 'Avant la boussole, avant les GPS, les marins byzantins naviguaient grâce à un texte secret : un guide détaillé de chaque port, courant et récif de la Méditerranée, mis à jour par les capitaines de la flotte impériale.',
 'Comment appelle-t-on les manuels de navigation antiques et byzantins décrivant les côtes et les ports ?',
 'qcm',
 '["Les portulans","Les périples","Les itinéraires","Les cosmographies"]',
 'Les périples',
 'Le plus ancien est le Périple de la mer Érythrée (Ier siècle), décrivant les routes commerciales jusqu''en Inde. Les Byzantins ont maintenu cette tradition de cartographie maritime pendant des siècles. Le mot vient du grec "periplus" — littéralement "navigation autour".',
 true),

-- 33 · Celtique · Medium
('daily', 'medium', 'faction-celtique',
 'Un chaudron d''argent retrouvé dans une tourbière danoise en 1891, couvert de scènes de sacrifices, de dieux cornus et de guerriers. Œuvre celtique retrouvée en terre germanique — un mystère en soi.',
 'Comment s''appelle le célèbre chaudron d''argent celtique découvert au Danemark, orné de divinités gauloises ?',
 'qcm',
 '["Le chaudron de Bra","Le chaudron de Gundestrup","Le chaudron de Battersea","Le vase de Vix"]',
 'Le chaudron de Gundestrup',
 'Datant du IIe-Ier siècle av. J.-C., ce chaudron de 9 kg d''argent montre des divinités celtiques (dont Cernunnos aux bois de cerf) et une scène d''immersion rituelle. Fabriqué probablement en Thrace avec une iconographie gauloise, il illustre les réseaux d''échange à travers l''Europe celtique.',
 true),

-- 34 · Nordique · Medium
('daily', 'medium', 'faction-nordique',
 'Une île volcanique au milieu de l''Atlantique Nord. Les Vikings y ont fondé le premier parlement d''Europe — en plein air, au pied d''une falaise, en 930.',
 'Comment s''appelle l''assemblée islandaise fondée en 930, considérée comme le plus ancien parlement encore en activité ?',
 'qcm',
 '["Le Folketing","L''Althing","Le Storting","Le Løgting"]',
 'L''Althing',
 'L''Althing (Alþingi) se réunissait à Þingvellir, dans un rift tectonique spectaculaire. Les chefs (goðar) y débattaient des lois, réglaient les disputes et prononçaient les mises hors-la-loi. Pas de roi, pas de château — la démocratie nordique fonctionnait en plein vent, devant tout le peuple.',
 true),

-- 35 · Romain · Medium
('daily', 'medium', 'faction-romaine',
 'Sous l''Empire, un réseau de messagers reliait Rome aux provinces les plus lointaines. Les relais étaient espacés de 12 à 18 km — la distance qu''un cheval pouvait galoper à pleine vitesse.',
 'Comment s''appelait le service postal impérial romain, avec ses relais de chevaux sur toutes les routes de l''Empire ?',
 'qcm',
 '["Le Cursus Publicum","La Via Sacra","Le Tabellarius","Le Praefectus"]',
 'Le Cursus Publicum',
 'Créé par Auguste, le Cursus Publicum permettait de transmettre un message de Rome à la frontière du Rhin en 5-7 jours (1 500 km). Les mansiones (auberges) et mutationes (relais) jalonnaient le réseau. Seuls les porteurs d''un diploma (laissez-passer impérial) pouvaient l''utiliser.',
 true),

-- 36 · Byzantin · Medium
('daily', 'medium', 'faction-byzantine',
 'La monnaie byzantine a été la référence internationale pendant 700 ans. Stable, fiable, acceptée de l''Irlande à la Chine — le dollar de l''Antiquité tardive et du Moyen Âge.',
 'Comment s''appelle la pièce d''or byzantine qui a servi de monnaie de référence internationale pendant des siècles ?',
 'qcm',
 '["Le denier","Le solidus (bezant)","Le ducat","Le florin"]',
 'Le solidus (bezant)',
 'Le solidus, introduit par Constantin en 309, est resté à 4,5 g d''or pur pendant 700 ans — une stabilité monétaire unique dans l''histoire. En Occident, on l''appelait « bezant » (de Byzance). Il était accepté de la Scandinavie à Ceylan et a inspiré le dinar arabe.',
 true),

-- 37 · Celtique · Medium
('daily', 'medium', 'faction-celtique',
 'En 1953, au pied du mont Lassois en Bourgogne, des archéologues ouvrent la tombe d''une femme celtique du VIe siècle av. J.-C. À ses côtés : le plus grand vase en bronze jamais retrouvé du monde antique.',
 'Dans quelle ville bourguignonne a-t-on découvert la tombe princière celtique contenant un immense cratère grec en bronze ?',
 'qcm',
 '["Bibracte","Alésia","Vix","Gergovie"]',
 'Vix',
 'Le cratère de Vix mesure 1,64 m de haut et pèse 208 kg — un chef-d''œuvre grec probablement offert en cadeau diplomatique. La défunte, surnommée « la Dame de Vix », portait un torque en or de 480 g. Cette découverte prouve les liens commerciaux directs entre l''élite celtique et la Méditerranée.',
 true),

-- 38 · Nordique · Medium
('daily', 'medium', 'faction-nordique',
 'En 911, le roi de France cède un territoire à un chef viking pour qu''il arrête de piller. Le marché fonctionne — les anciens pillards deviennent les seigneurs les plus redoutables de l''Europe médiévale.',
 'Quel chef viking a reçu la Normandie du roi Charles le Simple par le traité de Saint-Clair-sur-Epte en 911 ?',
 'qcm',
 '["Ragnar Lothbrok","Ivar le Désossé","Rollon","Harald à la Belle Chevelure"]',
 'Rollon',
 'Rollon (Hrólfr) a reçu le comté de Rouen en échange de sa conversion et de la défense du territoire contre les autres Vikings. En 150 ans, ses descendants normands ont conquis l''Angleterre (1066), la Sicile, et fondé des États croisés — un retour sur investissement spectaculaire pour Charles le Simple.',
 true),

-- 39 · Romain · Medium
('daily', 'medium', 'faction-romaine',
 'Sur les murs de Pompéi, des inscriptions peintes appellent à voter pour tel candidat, insultent des rivaux, ou annoncent des combats de gladiateurs. La plus ancienne publicité murale d''Europe.',
 'Comment appelle-t-on les inscriptions peintes sur les murs de Pompéi qui servaient d''affiches électorales et publicitaires ?',
 'qcm',
 '["Les dipinti","Les graffiti","Les libelli","Les acta diurna"]',
 'Les dipinti',
 'On a retrouvé plus de 2 800 dipinti électoraux à Pompéi. « Votez pour Lucius, c''est un homme bien ! » côtoie « Les petits voleurs demandent l''élection de Vatia ». Contrairement aux graffiti (gravés), les dipinti étaient peints — souvent par des professionnels engagés pour la campagne.',
 true),

-- 40 · Transversale · Medium
('daily', 'medium', NULL,
 'Sur les routes de l''ambre, de la soie et de l''étain, Celtes, Romains, Vikings et Byzantins se croisaient plus souvent qu''on ne le croit. Le commerce ignorait les frontières que les historiens traceraient plus tard.',
 'Quelle matière, résine fossile venue de la Baltique, était commercée à travers toute l''Europe et la Méditerranée depuis le Néolithique ?',
 'qcm',
 '["Le jade","L''ambre","Le corail","Le jais"]',
 'L''ambre',
 'L''ambre de la Baltique a été retrouvé dans des tombes mycéniennes (Grèce, 1500 av. J.-C.) et des sépultures égyptiennes. La « route de l''ambre » reliait la mer du Nord à l''Adriatique. Les Romains l''appelaient "succinum" (suc de pierre) et Néron en faisait décorer ses arènes.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- HARD (10)
-- ═══════════════════════════════════════════════════════════════

-- 41 · Celtique · Hard
('daily', 'hard', 'faction-celtique',
 'César mentionne un calendrier gaulois complexe. En 1897, des fragments de bronze gravés ont été découverts à Coligny (Ain) — un calendrier luni-solaire de 5 ans, le plus élaboré du monde celtique.',
 'Comment s''appelle le calendrier gaulois en bronze découvert en 1897, le plus complet vestige de l''astronomie celtique ?',
 'qcm',
 '["Le calendrier de Bibracte","Le calendrier de Coligny","Le calendrier de Hallstatt","Le calendrier de Gournay"]',
 'Le calendrier de Coligny',
 'Gravé en gaulois sur des plaques de bronze, ce calendrier couvre 5 ans (62 mois lunaires + 2 mois intercalaires). Il note les jours « MAT » (favorables) et « ANM » (défavorables). Sa sophistication prouve que les druides étaient des astronomes rigoureux, pas des sorciers de village.',
 true),

-- 42 · Nordique · Hard
('daily', 'hard', 'faction-nordique',
 'Des pierres levées couvertes de runes racontent les exploits des morts. L''une d''elles, en Suède, mentionne un guerrier parti « très loin à l''est, en Serkland » — la terre des Sarrasins.',
 'Comment appelle-t-on les pierres commémoratives couvertes de runes et d''entrelacs, typiques de la Suède viking (Xe-XIe siècle) ?',
 'qcm',
 '["Les menhirs","Les pierres runiques","Les bautasteinar","Les dolmens"]',
 'Les pierres runiques',
 'La Suède compte plus de 2 500 pierres runiques, la plupart du XIe siècle. Les « pierres du Serkland » mentionnent des Vikings morts dans le monde musulman. Les pierres d''Ingvar commémorent une expédition désastreuse vers la Caspienne en 1036 — aucun des participants n''est rentré.',
 true),

-- 43 · Byzantin · Hard
('daily', 'hard', 'faction-byzantine',
 'Avant que les Croisés ne la mettent à sac, Constantinople abritait la plus grande bibliothèque du monde chrétien. Des textes grecs antiques y ont survécu un millénaire — puis ont disparu.',
 'Quel patriarche du IXe siècle a compilé le « Myriobiblon », résumé de 279 ouvrages antiques dont beaucoup sont aujourd''hui perdus ?',
 'qcm',
 '["Jean Chrysostome","Photios Ier","Basile de Césarée","Michel Psellos"]',
 'Photios Ier',
 'Le Myriobiblon (ou Bibliotheca) de Photios résume des œuvres d''historiens, médecins, romanciers et théologiens grecs — nombre de ces textes n''existent plus que grâce à ses résumés. Photios, l''un des esprits les plus brillants de Byzance, a aussi provoqué le schisme avec Rome en 863.',
 true),

-- 44 · Romain · Hard
('daily', 'hard', 'faction-romaine',
 'L''armée romaine ne se contentait pas de combattre. Chaque légionnaire portait 30 kg de matériel et creusait des tranchées chaque soir. Leur surnom en dit long sur leur quotidien.',
 'Quel surnom les légionnaires romains se donnaient-ils eux-mêmes, en référence au poids de leur équipement de marche ?',
 'qcm',
 '["Les Aigles","Les mules de Marius","Les fils de Mars","Les loups de Rome"]',
 'Les mules de Marius',
 'C''est le consul Marius (107 av. J.-C.) qui a réformé l''armée en imposant que chaque soldat porte son propre équipement au lieu de dépendre d''un train de bagages. Les légionnaires portaient armes, outils, rations et piquets — environ 30 kg — sur des marches de 30 km par jour.',
 true),

-- 45 · Celtique · Hard
('daily', 'hard', 'faction-celtique',
 'Pline l''Ancien rapporte que les Gaulois maîtrisaient une technique que les Romains leur enviaient : le placage de métaux. Ils savaient aussi « argenter » le cuivre si habilement qu''on ne voyait pas la différence.',
 'Quel procédé métallurgique, attribué aux Gaulois par Pline l''Ancien, consistait à recouvrir un métal d''une fine couche d''étain ?',
 'qcm',
 '["La dorure","L''étamage","Le damasquinage","L''émaillage"]',
 'L''étamage',
 'Pline (Histoire naturelle, XXXIV) attribue l''invention de l''étamage aux Gaulois Bituriges (Bourges). Cette technique protégeait le cuivre de la corrosion et imitait l''argent. Les artisans gaulois étaient aussi pionniers de l''émaillage — leur maîtrise métallurgique impressionnait Rome.',
 true),

-- 46 · Nordique · Hard
('daily', 'hard', 'faction-nordique',
 'Des archéologues ont retrouvé des cristaux translucides dans des épaves vikings. Certains pensent que ces « pierres de soleil » permettaient de naviguer même par temps couvert, en localisant le soleil à travers les nuages.',
 'Quel type de cristal est aujourd''hui considéré comme la probable « pierre de soleil » des navigateurs vikings ?',
 'qcm',
 '["Le quartz rose","Le spath d''Islande (calcite)","La tourmaline","Le feldspath"]',
 'Le spath d''Islande (calcite)',
 'Le spath d''Islande (cristal de calcite transparent) possède une propriété de biréfringence : il dédouble les images et, tourné face au ciel, permet de localiser la position du soleil même par temps couvert. Une étude de 2018 (Royal Society) a montré que cette méthode fonctionne avec une précision de 4°.',
 true),

-- 47 · Byzantin · Hard
('daily', 'hard', 'faction-byzantine',
 'Un empereur juriste a ordonné la compilation de tout le droit romain en un seul corpus. Ce travail titanesque, achevé en 534, est devenu le fondement du droit civil dans la moitié de l''Europe.',
 'Comment s''appelle la grande compilation du droit romain ordonnée par Justinien, base du droit civil européen ?',
 'qcm',
 '["Les Douze Tables","Le Corpus Juris Civilis","Le Code Théodosien","Les Pandectes de Tribonien"]',
 'Le Corpus Juris Civilis',
 'Compilé en 4 ans par le juriste Tribonien, le Corpus comprend le Code (lois impériales), le Digeste (jurisprudence), les Institutes (manuel) et les Novelles (nouvelles lois). Redécouvert au XIe siècle à Bologne, il a fondé la tradition juridique de l''Europe continentale — du Code Napoléon au BGB allemand.',
 true),

-- 48 · Romain · Hard
('daily', 'hard', 'faction-romaine',
 'Sous l''Empire, un réseau d''espions et d''informateurs quadrillait les provinces. Les « agentes in rebus » étaient les yeux et les oreilles de l''empereur — et personne ne savait exactement qui ils étaient.',
 'Quel corps de fonctionnaires romains, créé au IVe siècle, servait à la fois de messagers, d''inspecteurs et d''agents de renseignement ?',
 'qcm',
 '["Les frumentarii","Les agentes in rebus","Les speculatores","Les bénéficiaires"]',
 'Les agentes in rebus',
 'Les agentes in rebus (« ceux qui agissent dans les affaires ») ont remplacé les frumentarii, jugés trop corrompus. Officiellement inspecteurs du cursus publicum, ils surveillaient surtout les gouverneurs de province et rapportaient directement à l''empereur. Ammien Marcellin les décrit comme omniprésents et redoutés.',
 true),

-- 49 · Transversale · Hard
('daily', 'hard', NULL,
 'Quatre civilisations, quatre systèmes juridiques — mais un concept traverse le temps : l''idée qu''il existe des lois supérieures au pouvoir du roi. Des lois sacrées celtes aux tables romaines, chaque peuple a cherché à limiter l''arbitraire.',
 'Quel texte romain gravé sur des tables de bronze, vers 450 av. J.-C., est considéré comme le premier code de lois écrit de Rome ?',
 'qcm',
 '["Le Corpus Juris Civilis","La Loi des Douze Tables","L''Édit du Préteur","Le Code Théodosien"]',
 'La Loi des Douze Tables',
 'Gravées en 451-449 av. J.-C. sous la pression des plébéiens, les Douze Tables fixent pour la première fois le droit par écrit, limitant l''arbitraire des patriciens. Cicéron rapporte que les écoliers les apprenaient encore par cœur 400 ans plus tard. Les tables originales ont été détruites lors du sac gaulois de 390 av. J.-C.',
 true),

-- 50 · Celtique · Hard
('daily', 'hard', 'faction-celtique',
 'Dans une grotte des Pyrénées, des archéologues ont découvert un trésor votif gaulois : des centaines d''objets en or et en argent jetés dans l''eau depuis des siècles. Les Celtes offraient leurs richesses aux eaux — rivières, lacs, sources — qu''ils considéraient comme des passages vers l''Autre Monde.',
 'Comment appelle-t-on les dépôts d''objets précieux dans les eaux (rivières, lacs, sources) pratiqués par les Celtes ?',
 'qcm',
 '["Les cairns","Les dépôts votifs aquatiques","Les tumulus","Les sanctuaires rupestres"]',
 'Les dépôts votifs aquatiques',
 'Des milliers d''épées, casques, bijoux et monnaies ont été retrouvés dans les rivières et lacs d''Europe celtique. Le lac de Toulouse (Strabon), les sources de la Seine (statuettes votives), la Tamise (bouclier de Battersea) : les Celtes considéraient l''eau comme un seuil entre les mondes, et les offrandes comme un dialogue avec les forces souterraines.',
 true);
