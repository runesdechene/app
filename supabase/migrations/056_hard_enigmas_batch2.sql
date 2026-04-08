-- 056_hard_enigmas_batch2.sql
-- Seed : 65 énigmes quotidiennes difficiles (~16 par faction)

INSERT INTO enigmas (type, difficulty, heritage_id, lore_text, question, format, choices, answer, explanation, active) VALUES

-- ═══════════════════════════════════════════════════════════════
-- FACTION CELTIQUE (17)
-- ═══════════════════════════════════════════════════════════════

-- C-01
('daily', 'hard', 'faction-celtique',
 'En 279 av. J.-C., une armée de guerriers celtes envahit la Macédoine, puis la Grèce, et pilla Delphes — le centre du monde grec. Mais leur chef fut tué lors de la retraite, et les sources grecques brodèrent une légende sur leur défaite.',
 'Quel chef gaulois mena le raid sur Delphes en 279 av. J.-C. ?',
 'qcm',
 '["Brenn","Vercingétorix","Ambiorix","Dumnorix"]',
 'Brenn',
 'Brenn (ou Brennos) conduisit une coalition de tribus celtes jusqu''à Delphes, pillant le sanctuaire apollinien. Les sources grecques (Pausanias, Diodore) affirment que le dieu lui-même repoussa les Gaulois par des prodiges, mais la version historique montre simplement une retraite après la mort de Brenn, blessé. Il ne faut pas le confondre avec un autre Brenn qui avait pris Rome en 390 av. J.-C.',
 true),

-- C-02
('daily', 'hard', 'faction-celtique',
 'Les Celtes de l''âge du fer ne vivaient pas dans des huttes misérables : certains de leurs oppida couvraient des centaines d''hectares et produisaient des biens de luxe exportés jusqu''aux rives de la Méditerranée.',
 'Quel oppidum arverne, fouillé depuis le XIXe siècle, est considéré comme la capitale de Vercingétorix ?',
 'qcm',
 '["Alésia","Gergovie","Bibracte","Uxellodunum"]',
 'Gergovie',
 'Gergovie (Gergovia) était la capitale des Arvernes, sur le plateau de Merdogne près de Clermont-Ferrand. C''est là que Vercingétorix infligea à César sa seule grande défaite tactique en 52 av. J.-C. Alésia fut sa dernière bataille. Les fouilles du XIXe et du XXe siècle ont mis au jour les remparts et des structures de l''oppidum.',
 true),

-- C-03
('daily', 'hard', 'faction-celtique',
 'Strabon décrit une île au large des côtes armoricaines où des femmes aux pouvoirs surnaturels vivaient isolées des hommes, tisseraient des vents et soignaient les blessés de guerre. Certains y voient la survivance d''un culte réel.',
 'Selon Strabon, quel peuple insulaire aux rites mystérieux vivait sur une île proche de l''embouchure de la Loire ?',
 'qcm',
 '["Les Namnètes","Les Samnites","Les femmes de Sena","Les Vénètes d''Armorique"]',
 'Les femmes de Sena',
 'Strabon (Géographie, IV, 4) mentionne l''île de Sena (probablement l''Île de Sein) habitée par des femmes gauloises consacrées à un dieu — peut-être un écho d''un collège de prêtresses celtiques. Elles auraient le pouvoir de déchaîner tempêtes et maladies, et d''accueillir les héros mourants. Ce passage rare est l''un des seuls témoignages grecs d''un sacerdoce féminin celtique organisé.',
 true),

-- C-04
('daily', 'hard', 'faction-celtique',
 'L''un des trésors archéologiques majeurs de l''Europe celtique est un chaudron en argent repoussé, découvert en 1891 dans un tourbière danoise. Ses plaques intérieures représentent des divinités, des serpents à cornes et des sacrifices.',
 'Comment appelle-t-on ce chaudron en argent de l''âge du fer, trouvé à Gundestrup ?',
 'qcm',
 '["Le chaudron de Gundestrup","Le chaudron de Sutton Hoo","Le vase de Vix","Le cratère de Hochdorf"]',
 'Le chaudron de Gundestrup',
 'Le chaudron de Gundestrup (Ier s. av. J.-C.) est le plus grand objet en argent de l''âge du fer européen. Il représente des scènes mythologiques celtiques, dont le célèbre panneau du Cernunnos aux bois de cerf entouré d''animaux. Son origine exacte est débattue : fabriqué peut-être en Thrace ou dans les Balkans, il représente néanmoins une iconographie clairement celtique.',
 true),

-- C-05
('daily', 'hard', 'faction-celtique',
 'Parmi les dieux gaulois, l''un porte un maillet et un tonneau — symboles de fécondité et de l''autre monde. César l''identifie maladroitement à Dis Pater, le dieu des morts romains.',
 'Quel dieu gaulois au maillet était assimilé par César à Dis Pater ?',
 'qcm',
 '["Esus","Sucellus","Teutates","Épona"]',
 'Sucellus',
 'Sucellus (« le bon frappeur ») est représenté avec un maillet à long manche et un tonneau ou une patère. Il est associé à la forêt, à la bière, à la prospérité et aux morts. César (Guerre des Gaules, VI, 18) mentionne que les Gaulois se prétendent descendants de Dis Pater, ce que les épigraphistes modernes associent à Sucellus ou à d''autres divinités chtoniennes gauloises. Son épouse est Nantosvelta.',
 true),

-- C-06
('daily', 'hard', 'faction-celtique',
 'La tombe d''une femme de haut rang découverte à Vix (Côte-d''Or) en 1953 a bouleversé la compréhension de la société hallstattienne. Elle renfermait l''un des plus grands vases de bronze de l''Antiquité.',
 'Quelle est la contenance approximative du cratère de bronze retrouvé dans la tombe de Vix ?',
 'qcm',
 '["208 litres","84 litres","500 litres","1 200 litres"]',
 '208 litres',
 'Le cratère de Vix (vers 500 av. J.-C.) mesure 1,64 m de hauteur et peut contenir 1 100 litres selon certaines estimations, mais sa capacité réelle estimée lors de la fouille était de 208 litres de liquide. C''est le plus grand vase métallique connu de l''Antiquité. Fabriqué en Grande-Grèce (Laconie), il témoigne des réseaux d''échange entre élites celtiques et Méditerranée.',
 true),

-- C-07
('daily', 'hard', 'faction-celtique',
 'Les druides gaulois refusaient de coucher par écrit leurs enseignements sacrés — pourtant ils utilisaient l''alphabet grec pour leurs transactions commerciales, selon César lui-même.',
 'Combien d''années César indique-t-il que les jeunes druides passaient à mémoriser leur enseignement oral ?',
 'qcm',
 '["6 ans","20 ans","12 ans","40 ans"]',
 '20 ans',
 'César (Guerre des Gaules, VI, 14) précise que certains disciples passent jusqu''à vingt ans à apprendre par cœur les vers sacrés des druides. Ce refus de l''écriture était délibéré : il préservait le savoir de la diffusion profane et forçait une transmission vivante de maître à disciple. César note qu''ils utilisaient l''alphabet grec pour leurs lettres et comptes ordinaires.',
 true),

-- C-08
('daily', 'hard', 'faction-celtique',
 'Le calendrier de Coligny, découvert en 1897 dans l''Ain, est la plus longue inscription gauloise connue. C''est un calendrier lunaire-solaire gravé sur bronze, datant du IIe siècle ap. J.-C.',
 'Combien de mois le calendrier gaulois de Coligny comptait-il dans son cycle complet de 5 ans ?',
 'qcm',
 '["60 mois","62 mois","48 mois","70 mois"]',
 '62 mois',
 'Le calendrier de Coligny articule un cycle de 5 ans (quinquennal) comprenant 62 mois lunaires, dont 2 mois intercalaires pour synchroniser le calendrier lunaire avec l''année solaire. Chaque mois est classé en MAT (favorable) ou ANM (défavorable). C''est la preuve que les druides avaient développé un système astronomique sophistiqué, bien avant que les Romains ne le leur attribuent.',
 true),

-- C-09
('daily', 'hard', 'faction-celtique',
 'L''armée gauloise qui écrasa les Romains au lac Trébie en 218 av. J.-C. combattait sous les ordres d''Hannibal — mais des Gaulois cisalpins avaient déjà battu Rome seuls, un siècle et demi plus tôt.',
 'Lors de quelle bataille les Gaulois Sénons mirent-ils Rome à sac, vers 390 av. J.-C. ?',
 'qcm',
 '["Bataille d''Allia","Bataille de Cannes","Bataille de Trasimène","Bataille de Sentinum"]',
 'Bataille d''Allia',
 'La bataille de l''Allia (18 juillet 390 av. J.-C., date maudite dans le calendrier romain) vit les Sénons de Brenn écraser l''armée romaine sur les rives du fleuve Allia. Rome fut ensuite pillée pendant plusieurs mois — seul le Capitole résista. Tite-Live et Polybe décrivent l''événement comme un traumatisme fondateur. Les Romains qualifièrent le 18 juillet de dies nefastus à perpétuité.',
 true),

-- C-10
('daily', 'hard', 'faction-celtique',
 'Les Celtes insulaires (Irlande, Galles) ont conservé une littérature mythologique orale transmise à l''écrit par des moines chrétiens à partir du VIIe siècle. Le cycle ulstérien en est le cœur.',
 'Quel héros irlandais du cycle ulstérien est connu pour avoir tué le chien du forgeron Culann étant enfant, et pris sa place comme gardien ?',
 'qcm',
 '["Finn Mac Cumhaill","Cú Chulainn","Conall Cernach","Lugh Lamhfhada"]',
 'Cú Chulainn',
 'Cú Chulainn (« le chien de Culann ») tira son nom de l''exploit qu''il accomplit enfant : ayant tué le chien de garde du forgeron Culann d''un coup de sliotar, il proposa de prendre la place de l''animal jusqu''à ce qu''un remplaçant soit élevé. Son vrai nom était Sétanta. Il est le héros central de la Táin Bó Cúailnge, l''épopée irlandaise comparable à l''Iliade.',
 true),

-- C-11
('daily', 'hard', 'faction-celtique',
 'Parmi les objets celtiques les plus mystérieux figurent de petites roues à quatre ou six rayons en or ou en bronze, que l''on retrouve dans des contextes cultuels à travers toute l''Europe.',
 'À quelle divinité gauloise les roues à rayons sont-elles principalement associées selon l''épigraphie et l''iconographie ?',
 'qcm',
 '["Taranis","Lugh","Ogmios","Cernunnos"]',
 'Taranis',
 'Taranis (« le tonnant ») est le dieu gaulois du tonnerre, identifié parfois à Jupiter par interpretatio romana. La roue à rayons est son attribut principal — symbole solaire mais aussi sonore (le grondement du tonnerre évoquant une roue qui roule). Des roues votive en bronze miniatures ont été retrouvées dans des puits rituels et des dépôts de l''âge du fer dans toute la Gaule et en Britannie.',
 true),

-- C-12
('daily', 'hard', 'faction-celtique',
 'Le massacre de l''île de Môn (Anglesey) en 60 ap. J.-C. est l''un des épisodes les plus dramatiques de la conquête romaine de la Bretagne. Tacite en livre un témoignage troublant.',
 'Quel général romain détruisit le dernier grand sanctuaire druidique de l''île de Môn (Anglesey) en 60 ap. J.-C. ?',
 'qcm',
 '["Agricola","Suetonius Paulinus","Ostorius Scapula","Vespasien"]',
 'Suetonius Paulinus',
 'Suetonius Paulinus mena ses légions jusqu''en Anglesey (Môn), dernier refuge des druides britanniques, et fit abattre les bois sacrés. Tacite (Annales, XIV, 30) décrit les druides et les femmes en noir brandissant des torches, les légionnaires paralysés de stupeur avant de reprendre leurs sens. La révolte de Boadicée éclata au même moment, forçant Paulinus à rebrousser chemin.',
 true),

-- C-13
('daily', 'hard', 'faction-celtique',
 'La pratique du torque — ce collier d''or torsadé — est l''un des marqueurs les plus distinctifs de l''aristocratie celtique. Il apparaît aussi sur des représentations divines, porté non par des humains.',
 'Le dieu Cernunnos est souvent représenté portant un torque et en tenant un autre. Quel animal tient-il généralement dans l''autre main sur les représentations les plus célèbres ?',
 'qcm',
 '["Un loup","Un sanglier","Un serpent à tête de bélier","Un cerf"]',
 'Un serpent à tête de bélier',
 'Sur le chaudron de Gundestrup et d''autres représentations, Cernunnos (dieu aux bois de cerf) tient un torque d''une main et un serpent à tête de bélier de l''autre. Ce reptile cornu est un symbole de fertilité et de l''inframonde celtique, sans équivalent dans les mythologies méditerranéennes. Sa présence aux côtés de Cernunnos renforce le caractère chthonien de cette divinité.',
 true),

-- C-14
('daily', 'hard', 'faction-celtique',
 'En 225 av. J.-C., une coalition de tribus gauloises traversa les Alpes et envahit l''Italie du Nord. Les Romains les arrêtèrent dans un étau entre deux armées consulaires.',
 'À quelle bataille les Romains écrasèrent-ils une grande coalition gauloise en 225 av. J.-C., dans ce qui est aujourd''hui la Toscane ?',
 'qcm',
 '["Bataille de Télamon","Bataille de Clastidium","Bataille de Sentinum","Bataille du Tessin"]',
 'Bataille de Télamon',
 'La bataille de Télamon (Talamone, Toscane) en 225 av. J.-C. vit les armées consulaires de Lucius Aemilius Papus et de Caius Atilius Regulus prendre en tenaille une coalition de Gaesates (mercenaires celtes transalpins), d''Insubres et de Boïens. Polybe (II, 27-31) décrit les Gaesates combattant nus — leur nudité rituelle étant à la fois un geste sacré et une démonstration de bravoure. 40 000 Gaulois furent tués.',
 true),

-- C-15
('daily', 'hard', 'faction-celtique',
 'L''archéologie a mis au jour de nombreux sanctuaires gaulois appelés "enclos cultuels" — des espaces quadrangulaires clos où l''on déposait des offrandes, parfois des restes humains. Les Romains les désignaient par un terme latin.',
 'Comment appelle-t-on en latin ces enclos cultuels gaulois quadrangulaires, souvent trouvés en fouille ?',
 'qcm',
 '["Fanum","Templum","Mundus","Lucus"]',
 'Fanum',
 'Le fanum (pl. fana) est le terme latin désignant les sanctuaires indigènes gaulois — souvent de plan carré avec une cella centrale entourée d''une galerie. Ils perdurent et s''adaptent à l''époque gallo-romaine. On les distingue des temples romains classiques (templum) par leur plan et leur contexte. Des milliers ont été fouillés à travers la Gaule, certains révélant des dépôts d''armes, d''ossements animaux et d''offrandes.',
 true),

-- C-16
('daily', 'hard', 'faction-celtique',
 'Ammien Marcellin, historien du IVe siècle, décrit les Gaulois comme de grands orateurs mais aussi comme des mangeurs voraces, leur donnant un trait culturel précis qui les distinguait des Romains.',
 'Selon Ammien Marcellin, quel comportement à table était caractéristique des Gaulois nobles et étrangeait les Romains ?',
 'qcm',
 '["Manger debout","Partager leur repas avec des inconnus","Se battre pour la meilleure portion","Boire de la bière plutôt que du vin"]',
 'Se battre pour la meilleure portion',
 'Ammien Marcellin (Res Gestae, XV, 12) note que lors des banquets, les Gaulois se disputaient parfois la portion d''honneur (la cuisse du porc rôti) au point d''en venir aux mains. Cette coutume — la "portion du héros" ou curadmír — est confirmée par les sources irlandaises médiévales : le meilleur morceau revenait de droit au plus brave, et la contester était une déclaration de supériorité.',
 true),

-- C-17
('daily', 'hard', 'faction-celtique',
 'L''or gaulois ne venait pas que du pillage. Les Gaulois exploitaient des mines et des rivières aurifères, notamment dans le Massif Central et les Pyrénées. Certaines tribus en tiraient une richesse considérable.',
 'Quelle tribu gauloise du sud de la Gaule était particulièrement renommée pour ses mines d''or et sa richesse métallurgique, selon Strabon ?',
 'qcm',
 '["Les Rutènes","Les Volques Tectosages","Les Bituriges","Les Lingons"]',
 'Les Volques Tectosages',
 'Strabon (Géographie, IV, 1) décrit les Volques Tectosages (autour de Toulouse/Tolosa) comme détenteurs d''immenses richesses en or, en partie issues de pillages (dont le trésor de Delphes selon la légende), en partie de mines locales. Le "trésor de Toulouse" (Aurum Tolosanum), saisi par le consul Caepio en 106 av. J.-C. et mystérieusement disparu, est entré dans la légende comme l''or maudit des Tectosages.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION NORDIQUE (16)
-- ═══════════════════════════════════════════════════════════════

-- N-01
('daily', 'hard', 'faction-nordique',
 'L''Edda poétique et l''Edda en prose contiennent les deux sources principales de la mythologie nordique — mais elles furent rédigées des siècles après la christianisation, par des lettrés islandais qui cherchaient à sauver une mémoire.',
 'Qui rédigea l''Edda en prose vers 1220, synthétisant la mythologie nordique pour les poètes skaldiques ?',
 'qcm',
 '["Saxo Grammaticus","Snorri Sturluson","Adam de Brême","Ari Þorgilsson"]',
 'Snorri Sturluson',
 'Snorri Sturluson (1179-1241), chef politique islandais et poète, rédigea l''Edda en prose (Prose Edda) vers 1220 comme manuel de poésie skaldique — incluant la Gylfaginning (tromperie de Gylfi), récit de la mythologie nordique. Saxo Grammaticus rédigit les Gesta Danorum au même siècle, mais en latin et avec une vision différente. Sans Snorri, une grande partie de la mythologie nordique aurait été perdue.',
 true),

-- N-02
('daily', 'hard', 'faction-nordique',
 'Les Vikings ne se contentaient pas de razzier : ils fondèrent des États durables. L''un d''eux créa la première assemblée parlementaire d''Europe occidentale, sur une île isolée au milieu de l''Atlantique Nord.',
 'En quelle année fut fondé l''Althing islandais, considéré comme l''un des plus anciens parlements du monde ?',
 'qcm',
 '["930","870","1000","1066"]',
 '930',
 'L''Althing (Alþingi) fut fondé en 930 à Þingvellir (les Plaines du Parlement), dans une fissure tectonique entre les plaques eurasienne et nord-américaine. C''était une assemblée annuelle de chefs locaux (goðar) qui légiférait et rendait la justice. L''Islande n''avait pas de roi — l''Althing était sa structure politique unique. En l''an 1000, c''est l''Althing qui vota la christianisation de l''île.',
 true),

-- N-03
('daily', 'hard', 'faction-nordique',
 'Dans la cosmologie nordique, le monde n''est pas sphérique mais plat, suspendu dans le vide cosmique. Les neuf mondes sont organisés autour d''un axe vertical dont la nature exacte est souvent mal rappelée.',
 'Yggdrasil est l''arbre cosmique nordique. Quelle essence d''arbre est-il selon les textes de l''Edda ?',
 'qcm',
 '["Un chêne","Un frêne","Un if","Un orme"]',
 'Un frêne',
 'Yggdrasil est explicitement décrit comme un frêne (askr) dans l''Edda poétique (Völuspá, Grímnismál). L''association du frêne avec la magie et la connaissance est répandue dans les cultures germaniques. Le nom Yggdrasil signifie probablement "le destrier d''Ygg" (Ygg étant un surnom d''Odin) — en référence à la pendaison d''Odin sur l''arbre pour obtenir les runes. C''est une confusion fréquente de l''associer au chêne (symbole des Celtes).',
 true),

-- N-04
('daily', 'hard', 'faction-nordique',
 'La ruée vers l''est des Vikings — les Varègues — est moins connue que leurs raids à l''ouest. Ils descendirent les fleuves russes jusqu''à la mer Noire et Caspienne, fondant des comptoirs qui devinrent des villes.',
 'Quel prince varègue est traditionnellement considéré comme le fondateur de la Rus'' de Kiev, vers 882 ?',
 'qcm',
 '["Rurik","Oleg","Sviatoslav","Igor"]',
 'Oleg',
 'Selon la Chronique des temps passés (Povest'' vremennykh let), c''est Oleg (Helgi en norrois) qui s''empara de Kiev vers 882, en tuant Askold et Dir, et en fit sa capitale, déclarant : "Que Kiev soit la mère des villes russes." Rurik fonda Novgorod (~862) mais mourut avant Kiev. Oleg étendit le territoire jusqu''à Constantinople, contre laquelle il mena deux expéditions et obtint des traités commerciaux favorables en 907 et 911.',
 true),

-- N-05
('daily', 'hard', 'faction-nordique',
 'La poésie skaldique est l''une des formes littéraires les plus complexes de l''histoire européenne — ses kenningar (périphrases poétiques) transforment chaque concept en une énigme élaborée.',
 'Dans la poésie skaldique nordique, que désigne la kenning "sang de Kvasir" ou "miel de Kvasir" ?',
 'qcm',
 '["L''hydromel de la poésie","Le sang versé au combat","La bière sacrée d''Odin","Le miel de l''immortalité"]',
 'L''hydromel de la poésie',
 'Selon le mythe nordique, Kvasir fut créé du crachat mêlé des Ases et des Vanes lors de leur traité de paix. Les nains Fjalarr et Galarr le tuèrent et mélangèrent son sang avec du miel pour créer le Mead of Poetry (hydromel poétique), qui confère le don de poésie et de sagesse à qui le boit. "Sang de Kvasir" est donc une kenning classique pour désigner ce breuvage — et par extension, la poésie elle-même.',
 true),

-- N-06
('daily', 'hard', 'faction-nordique',
 'Les Vikings en Amérique du Nord ne sont pas une légende : ils y établirent un campement archéologiquement attesté, cinq siècles avant Christophe Colomb. Son nom norrois signifie "Anse aux Méduses".',
 'Dans quelle province canadienne actuelle se trouve le site archéologique viking de L''Anse aux Meadows, inscrit à l''UNESCO ?',
 'qcm',
 '["Nouvelle-Écosse","Terre-Neuve","Labrador","Île-du-Prince-Édouard"]',
 'Terre-Neuve',
 'L''Anse aux Meadows, à la pointe nord de Terre-Neuve, fut découvert en 1960 par Helge et Anne Ingstad. Les fouilles révélèrent des vestiges norrois datés autour de l''an 1000, correspondant aux sagas de Leif Erikson. C''est le seul site viking authentifié en Amérique du Nord. Les Norrois y fabriquaient du métal — preuve qu''il ne s''agissait pas d''un simple camp de pêche mais d''un établissement plus ambitieux.',
 true),

-- N-07
('daily', 'hard', 'faction-nordique',
 'Le rituel funéraire nordique le plus élaboré n''était pas toujours la crémation sur bateau. L''archéologie révèle une grande diversité de pratiques, dont certaines inhumations de femmes de haut rang avec du matériel exceptionnel.',
 'La tombe d''Oseberg (Norvège, 834 ap. J.-C.) contenait deux femmes et un navire intact. Quelle hypothèse sur l''identité de la principale défunte est aujourd''hui la plus acceptée ?',
 'qcm',
 '["Une reine consort","Une völva (voyante-chamane)","Une valkyrie divinisée","Une marchande de luxe"]',
 'Une völva (voyante-chamane)',
 'La tombe d''Oseberg (fouillée en 1904) contenait un navire de 22 mètres, deux femmes (l''une âgée, l''autre jeune), et une richesse matérielle extraordinaire. La femme plus âgée présente des signes de haute noblesse ou de statut sacerdotal. Le contenu — seau de cannabis, plantes hallucinogènes, bâton de voyante — a conduit Neil Price et d''autres chercheurs à identifier la défunte principale comme une völva, chamane de haut rang dans la société nordique.',
 true),

-- N-08
('daily', 'hard', 'faction-nordique',
 'Ragnarök n''est pas simplement une "fin du monde" — c''est un cycle. Les textes nordiques prévoient ce qui advient après la destruction, et certains dieux survivent.',
 'Lequel de ces dieux survit à Ragnarök selon l''Edda poétique ?',
 'qcm',
 '["Thor","Odin","Víðarr","Tyr"]',
 'Víðarr',
 'Víðarr (le silencieux) survit à Ragnarök en vengeant la mort d''Odin : il tue le loup Fenrir en lui perçant le palais avec sa chaussure renforcée (symbole des rognures de cuir données par les cordonniers à Víðarr). Baldr, revenu de Hel, et Höðr survivent également. Thor et Odin meurent — le premier tué par le serpent Jörmungandr, le second avalé par Fenrir. Tyr et Freyr tombent aussi lors de la bataille finale.',
 true),

-- N-09
('daily', 'hard', 'faction-nordique',
 'La grande armée viking (Micel Here) qui débarqua en Angleterre en 865 ne venait pas piller et repartir — elle cherchait à conquérir. En quelques années, elle mit à bas trois royaumes anglo-saxons.',
 'Qui était le chef légendaire de cette Grande Armée Danoise de 865, fils de Ragnar selon la tradition ?',
 'qcm',
 '["Sigurd Serpent-dans-l''Œil","Ivar le Désossé","Halfdan Ragnarsson","Björn Côte-de-Fer"]',
 'Ivar le Désossé',
 'Ivar le Désossé (Ívarr hinn Beinlausi) est mentionné dans les sagas comme le stratège principal de la Grande Armée Danoise. Son surnom énigmatique ("désossé") pourrait désigner une maladie osseuse, une souplesse exceptionnelle, ou être une métaphore poétique de sa cruauté. Il fut l''un des architectes de la chute de Northumbrie (867) et fit exécuter le roi Ælla par le rituel du "l''aigle de sang" selon les sagas. L''historicité de certains éléments reste débattue.',
 true),

-- N-10
('daily', 'hard', 'faction-nordique',
 'Les runes ne sont pas qu''un alphabet — elles sont une cosmologie. Chaque rune porte un nom, un poème associé, et des usages magiques codifiés. Mais les systèmes runiques diffèrent selon les époques et les régions.',
 'Combien de runes compte le Futhark ancien (Elder Futhark), utilisé jusqu''au VIIIe siècle environ ?',
 'qcm',
 '["16","24","33","18"]',
 '24',
 'Le Futhark ancien (Elder Futhark) comprend 24 runes, réparties en trois groupes de 8 (les ættir). C''est le système runique le plus répandu en Europe du Nord entre le IIe et le VIIIe siècle, attesté sur des objets allant de la Scandinavie à l''Europe centrale. Au VIIIe siècle, il fut réduit au Younger Futhark (16 runes) en Scandinavie — paradoxalement, une simplification qui coïncide avec l''âge des Vikings. L''Anglo-Saxon Futhorc étendit le système à 28-33 runes.',
 true),

-- N-11
('daily', 'hard', 'faction-nordique',
 'Le siège de Paris par les Vikings en 885-886 est l''un des événements fondateurs de la France. La résistance de la ville contre une flotte immense décida du sort de la Francie occidentale.',
 'Quel comte carolingien défendit Paris contre le siège viking de 885-886 et devint une légende de son vivant ?',
 'qcm',
 '["Robert le Fort","Eudes de Paris","Charles le Gros","Hugues l''Abbé"]',
 'Eudes de Paris',
 'Eudes (Odo), comte de Paris, mena la défense héroïque de la ville contre la flotte de Sigfried et Rollo pendant plus d''un an. Quand Charles le Gros (roi carolingien) arriva avec son armée et préféra payer les Vikings plutôt que les combattre, sa réputation s''effondra. Eudes devint tellement populaire qu''il fut élu roi de Francie occidentale en 888 — premier roi non carolingien. Sa famille donnera plus tard les Capétiens.',
 true),

-- N-12
('daily', 'hard', 'faction-nordique',
 'Harald à la Belle Chevelure n''unifia pas la Norvège par la diplomatie — mais par la conquête. Sa victoire lors d''une bataille navale décisive scella l''unification du pays vers 872.',
 'Lors de quelle bataille navale Harald Hårfagre unifia-t-il la Norvège vers 872 ?',
 'qcm',
 '["Bataille de Hafrsfjord","Bataille de Stiklestad","Bataille de Svolder","Bataille de Bråvalla"]',
 'Bataille de Hafrsfjord',
 'La bataille de Hafrsfjord (près de Stavanger) vers 872 opposa Harald Hårfagre à une coalition de rois régionaux norvégiens. Sa victoire lui permit de contrôler l''ensemble du pays. Selon Snorri Sturluson, Harald avait promis de ne pas couper ses cheveux avant d''avoir unifié la Norvège — d''où son surnom. L''émigration massive vers l''Islande qui suivit fut partiellement provoquée par le refus de nombreux chefs de se soumettre à son autorité.',
 true),

-- N-13
('daily', 'hard', 'faction-nordique',
 'La coutume nordique du "holmgang" est souvent romanisée comme un simple duel d''honneur. Mais ses règles codifiées en faisaient une procédure juridique précise, avec des conséquences légales définies.',
 'Qu''advenait-il légalement à un homme qui refusait un holmgang (duel) en Scandinavie médiévale ?',
 'qcm',
 '["Il était banni","Il perdait sa réputation mais rien de juridique","Il était déclaré niding (lâche hors-la-loi)","Il payait une amende au roi"]',
 'Il était déclaré niding (lâche hors-la-loi)',
 'Refuser un holmgang était une honte absolue — on était déclaré niding (níðingr), terme désignant le pire des lâches, un homme sans honneur. Le statut de niding impliquait une mise hors-la-loi sociale : on pouvait être tué sans conséquences juridiques, on perdait ses droits et sa propriété, et aucun homme d''honneur ne vous adressait plus la parole. Le holmgang avait lieu sur une peau de bête délimitant le terrain, avec des règles strictes sur les coups portés.',
 true),

-- N-14
('daily', 'hard', 'faction-nordique',
 'L''archéologie nordique a mis au jour une figure de proue de bateau exceptionnelle, sculptée avec une sophistication qui stupéfia les historiens de l''art. Elle fut découverte dans un marais irlandais au XIXe siècle.',
 'Quel trésor archéologique viking, découvert à Killaloe en Irlande en 1840, représente une tête de dragon en bois sculpté ?',
 'qcm',
 '["La tête de Borre","La tête de Ringerike","La figure de Scheibe","La figure de Lough Derg"]',
 'La figure de Lough Derg',
 'La figure de proue de Lough Derg (Killaloe, Irlande), découverte en 1840 dans le lac, est l''un des rares exemples de sculpture sur bois viking conservée. Elle date probablement du Xe siècle et représente une tête zoomorphe finement décorée de style Ringerike. Les bois celtes conservent les sculptures organiques là où d''autres environnements les détruisent. Ce type de trouvaille permet de comprendre l''art décoratif nordique en dehors des pierres runiques.',
 true),

-- N-15
('daily', 'hard', 'faction-nordique',
 'La ville de Hedeby (Haithabu), sur le territoire du Danemark actuel, était l''une des plus grandes villes du monde viking — un carrefour commercial entre mer du Nord et Baltique, entre Francie et Scandinavie.',
 'Quelle armée mit définitivement fin à la ville de Hedeby en la brûlant vers 1050 ?',
 'qcm',
 '["L''armée norvégienne de Harald Hardrada","Les Slaves Obodrites","L''armée des Croisés","Les Saxons de l''Empire"]',
 'L''armée norvégienne de Harald Hardrada',
 'Hedeby fut pillée et brûlée par Harald Hardrada (Harald III de Norvège) vers 1049-1050, lors d''un conflit avec le roi danois Sven Estridsen. La ville, déjà affaiblie par des raids précédents (notamment des Obodrites vers 983 et un incendie de 1000), ne se releva pas. La population migra vers Schleswig, de l''autre côté du fjord. Les fouilles d''Hedeby ont mis au jour des artefacts de toute l''Europe : soie de Byzance, épices d''Orient, verre rhénan.',
 true),

-- N-16
('daily', 'hard', 'faction-nordique',
 'Odin n''est pas seulement le dieu de la guerre — c''est le dieu de la connaissance obtenue par le sacrifice de soi. Il pendit neuf nuits sur Yggdrasil pour acquérir les runes, et sacrifia un œil pour boire à la source de Mimir.',
 'Quel nom porte la source où Odin sacrifia un œil pour obtenir la sagesse, selon l''Edda ?',
 'qcm',
 '["La source d''Urðr","La source de Mimir","La source de Hvergelmir","La fontaine de Gjöll"]',
 'La source de Mimir',
 'La source de Mimir (Mímisbrunnr) se trouve sous l''une des racines d''Yggdrasil, du côté des Géants du Givre. Mimir en est le gardien — une figure de sagesse primordiale, parfois décrite comme un géant, parfois comme un être distinct. Odin lui offrit son œil en gage pour obtenir le droit de boire. La source d''Urðr (Urðarbrunnr) est celle des Nornes, sous la racine du côté des Ases. Hvergelmir est la source originelle de tous les fleuves, sous la racine du côté de Niflheim.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION ROMAINE (16)
-- ═══════════════════════════════════════════════════════════════

-- R-01
('daily', 'hard', 'faction-romaine',
 'La réforme militaire qui transforma l''armée romaine d''une milice de citoyens propriétaires en une armée professionnelle des pauvres fut l''une des plus lourdes de conséquences de toute l''histoire de Rome.',
 'Quel général romain reforma l''armée vers 107 av. J.-C. en ouvrant le service aux citoyens sans propriété (capite censi) ?',
 'qcm',
 '["Scipion l''Africain","Caius Marius","Sylla","Pompée"]',
 'Caius Marius',
 'La réforme de Marius (107 av. J.-C.) permit aux capite censi — citoyens trop pauvres pour s''équiper eux-mêmes — de rejoindre les légions, l''équipement étant fourni par l''État. En contrepartie, ces soldats devinrent fidèles à leur général plutôt qu''à Rome, puisque c''est lui qui garantissait leur solde et leur retraite (une concession de terres). Cette transformation explique directement les guerres civiles du Ier siècle av. J.-C. : Marius lui-même l''utilisa le premier.',
 true),

-- R-02
('daily', 'hard', 'faction-romaine',
 'Les Romains classifiaient leurs légions avec une précision maniaque — numéros, cognomina, symboles animaux. Certaines légions portaient des numéros identiques à d''autres en simultané, ce qui confond encore les historiens.',
 'Quelle légion romaine, surnommée "Fulminata" (la Foudroyante), est associée à l''épisode du "Miracle de la Pluie" sous Marc Aurèle vers 172 ap. J.-C. ?',
 'qcm',
 '["Legio XII Fulminata","Legio III Augusta","Legio X Gemina","Legio I Adiutrix"]',
 'Legio XII Fulminata',
 'La Legio XII Fulminata est au cœur du "Miracle de la Pluie" (Columna de Marc Aurèle, colonne de Trajan) : assoiffée lors d''une campagne contre les Quades, la légion aurait été sauvée par une pluie providentielle. Chrétiens et partisans des cultes romains se disputaient la paternité du miracle. Tertullien l''attribuait à des soldats chrétiens en prière ; les sources officielles à Jupiter ou à des pratiques égyptiennes. La Legio XII est attestée en Orient depuis Auguste.',
 true),

-- R-03
('daily', 'hard', 'faction-romaine',
 'Le droit romain est l''une des contributions intellectuelles les plus durables de Rome — mais sa codification définitive n''eut lieu que sous un empereur qui ne parlait pas latin couramment.',
 'Sous quel empereur fut compilé le Corpus Juris Civilis, la codification majeure du droit romain, au VIe siècle ?',
 'qcm',
 '["Théodose II","Justinien Ier","Dioclétien","Constantin Ier"]',
 'Justinien Ier',
 'Le Corpus Juris Civilis fut compilé entre 529 et 534 sous Justinien Ier, par une commission dirigée par le juriste Tribonien. Il comprend le Code (constitutions impériales), le Digeste (jurisprudence classique), les Institutes (manuel) et les Novelles (nouvelles lois). Justinien, natif d''Illyrie latinophone, parlait le grec comme langue de cour — son empire était en réalité grec dans sa culture quotidienne. Le Corpus est le fondement de la quasi-totalité des systèmes juridiques européens continentaux.',
 true),

-- R-04
('daily', 'hard', 'faction-romaine',
 'Rome n''a pas toujours été une République, ni toujours un Empire. Entre la royauté légendaire et la République, une transition violente eut lieu qui imprima durablement la haine des rois dans l''ADN politique romain.',
 'En quelle année traditionnelle les Romains chassèrent-ils leur dernier roi Tarquin le Superbe, fondant la République ?',
 'qcm',
 '["509 av. J.-C.","476 av. J.-C.","264 av. J.-C.","753 av. J.-C."]',
 '509 av. J.-C.',
 'La tradition romaine (Tite-Live, Denys d''Halicarnasse) fixe la fondation de la République en 509 av. J.-C., après l''expulsion de Tarquin le Superbe par Brutus et ses alliés, en réaction au viol de Lucrèce par le fils du roi. Cette date, bien que symbolique et peut-être partiellement légendaire, est ancrée dans la conscience romaine : l''interdiction du titre de "roi" (rex) dura jusqu''à la fin de Rome. César fut assassiné en partie parce qu''on le soupçonnait de vouloir ce titre.',
 true),

-- R-05
('daily', 'hard', 'faction-romaine',
 'La formation de combat romaine la plus célèbre n''est pas la légion entière — c''est l''unité tactique qui la composait, capable de manœuvrer indépendamment sur un terrain accidenté.',
 'Comment appelle-t-on l''unité tactique de base de la légion romaine de l''époque républicaine tardive, composée d''environ 80 légionnaires ?',
 'qcm',
 '["La cohorte","Le manipule","Le century","L''ala"]',
 'Le century',
 'Le century (centuria, littéralement "centurie") était la cellule de base de la légion impériale, commandée par un centurion. Dans la légion républicaine, le manipule (80-160 hommes, deux centuries) était l''unité tactique clé — c''est lui qui permettait la manœuvrabilité supérieure face aux phalanges hellénistiques. Avec la réforme marienne, la cohorte (6 centuries, ~480 hommes) devint l''unité tactique principale. L''ala désignait la cavalerie alliée sur les flancs.',
 true),

-- R-06
('daily', 'hard', 'faction-romaine',
 'Certains empereurs romains ne moururent pas à Rome — ni même en Italie. L''Empire était si vaste que ses maîtres passaient parfois toute leur règne en campagne, mourant sur les marches d''un monde inconnu.',
 'Où mourut l''empereur Julien, dit "l''Apostat", en 363 ap. J.-C. ?',
 'qcm',
 '["En Perse, lors de la retraite après sa campagne contre Ctésiphon","En Gaule, lors d''une rébellion","À Constantinople, de maladie","En Bretagne, lors d''une campagne contre les Pictes"]',
 'En Perse, lors de la retraite après sa campagne contre Ctésiphon',
 'Julien (l''Apostat) mourut le 26 juin 363, frappé d''une lance lors de la retraite de son armée après l''échec à prendre Ctésiphon (capitale sassanide, dans l''Iraq actuel). Ses hommes avaient brûlé la flotte romaine pour couper la retraite — une décision catastrophique. Julien refusa les médecins et mourut en philosophe, selon ses biographes. Ammien Marcellin, présent lors de la campagne, en donne un récit détaillé. Jovien lui succéda et signa une paix humiliante avec les Perses.',
 true),

-- R-07
('daily', 'hard', 'faction-romaine',
 'L''aqueduc romain n''est pas seulement un chef-d''œuvre hydraulique — c''est un système politique. L''accès à l''eau conditionnait la hiérarchie sociale des villes romaines, avec des droits d''eau accordés comme privilèges impériaux.',
 'Quel aqueduc romain, le plus long jamais construit, atteignait 132 km de longueur pour alimenter Carthage en Afrique du Nord ?',
 'qcm',
 '["Aqueduc de Zaghouan","Aqueduc de Carthage","Aqua Claudia","Aqueduc de Valens"]',
 'Aqueduc de Zaghouan',
 'L''aqueduc de Zaghouan (ou aqueduc de Carthage), construit sous Hadrien et Antonin le Pieux (IIe siècle), s''étendait sur environ 132 km depuis les sources du Jebel Zaghouan jusqu''à Carthage — le plus long aqueduc romain connu. Il alimentait les thermes d''Antonin, parmi les plus grands de l''Empire. Des vestiges importants subsistent en Tunisie. L''aqua Claudia (Rome) et l''aqueduc de Valens (Constantinople) sont également remarquables mais plus courts.',
 true),

-- R-08
('daily', 'hard', 'faction-romaine',
 'La bataille qui mit fin à la République romaine ne fut pas Actium — ce fut une série de batailles. Mais Actium scella définitivement la victoire d''Auguste sur son dernier rival.',
 'Lors de la bataille d''Actium (31 av. J.-C.), quel était le général commandant les forces d''Antoine et de Cléopâtre, qui trahit en traversant avec ses navires vers Auguste ?',
 'qcm',
 '["Quintus Dellius","Agrippa","Ahenobarbus","Canidius Crassus"]',
 'Ahenobarbus',
 'Gnaeus Domitius Ahenobarbus (arrière-grand-père de Néron) commanda une partie de la flotte d''Antoine et déserta vers Octave peu avant la bataille d''Actium, malade et désenchanté par la politique orientale d''Antoine. Agrippa commandait la flotte d''Octave — c''est lui le vrai vainqueur naval d''Actium. Quintus Dellius avait trahi encore plus tôt. La bataille réelle fut peut-être moins héroïque qu''on ne le dit : la fuite de Cléopâtre et d''Antoine décida du sort avant même la fin des combats.',
 true),

-- R-09
('daily', 'hard', 'faction-romaine',
 'Les Romains appelaient "naumachie" une reconstitution navale de bataille — un spectacle si coûteux et complexe qu''il était réservé aux occasions les plus exceptionnelles de l''histoire impériale.',
 'Combien de combattants Suétone dit-il que César engagea dans la première grande naumachie romaine organisée en 46 av. J.-C. ?',
 'qcm',
 '["4 000 rameurs et 1 000 combattants","6 000 hommes","16 000 hommes","2 000 gladiateurs"]',
 '16 000 hommes',
 'Suétone (Vie de César, 39) indique que César fit creuser un lac artificiel dans le Champ de Mars pour sa naumachie de 46 av. J.-C., qui opposa des trirèmes et quadrirèmes tyriennes contre égyptiennes, avec 4 000 rameurs et 1 000 combattants selon certaines sources — mais d''autres références antiques évoquent jusqu''à 16 000 participants (rameurs inclus). C''est la première naumachie romaine attestée à grande échelle. Auguste, Claude et Domitien en organisèrent d''autres encore plus spectaculaires.',
 true),

-- R-10
('daily', 'hard', 'faction-romaine',
 'Le réseau routier romain n''était pas qu''une infrastructure militaire — c''était un système de communication politique et économique. Mais toutes les routes ne se valaient pas : leur classification avait des implications juridiques précises.',
 'Comment appelait-on les voies romaines privées, construites et entretenues par des propriétaires fonciers, par opposition aux voies publiques ?',
 'qcm',
 '["Viae vicinales","Viae privatae","Viae municipales","Actus"]',
 'Viae privatae',
 'Le droit romain distinguait plusieurs catégories de voies : les viae publicae (routes d''État, entretenues par les caisses publiques), les viae vicinales (chemins de villages, entretenus par les riverains), et les viae privatae (propriété de particuliers, accessibles ou non selon leur bon vouloir). Les juristes romains (notamment Ulpien dans le Digeste) définissent avec précision ces catégories et les droits de passage (jus eundi, jus agendi) associés à chacune.',
 true),

-- R-11
('daily', 'hard', 'faction-romaine',
 'Le ciment romain (opus caementicium) est un mystère de la technologie ancienne — ses formules permettaient de construire sous l''eau et de résister aux séismes mieux que certains bétons modernes.',
 'Quel ingrédient volcanique spécifique, extrait des environs de Pouzzoles (Campanie), donnait au ciment romain sa résistance à l''eau ?',
 'qcm',
 '["La pozzolane","La chaux vive","Le tuf volcanique","Le basalte"]',
 'La pozzolane',
 'La pouzzolane (pulvis puteolanus, "poussière de Pouzzoles") est une cendre volcanique riche en silicates alumino-alumineux qui réagit avec la chaux et l''eau pour former un ciment hydraulique — capable de durcir même sous l''eau. Vitruve (De Architectura) en décrit l''usage. Des études récentes (2017, UC Berkeley) ont montré que les cristaux d''aluminosilicate de tobermorite qui se forment dans le béton romain au fil des siècles le rendent plus résistant avec le temps, contrairement au béton Portland moderne qui se dégrade.',
 true),

-- R-12
('daily', 'hard', 'faction-romaine',
 'Le Sénat romain n''était pas élu — ses membres y siégeaient à vie une fois qualifiés. Mais l''institution avait ses propres rites, ses propres tabous, et ses propres formes de violence institutionnelle.',
 'Que signifiait la procédure de "damnatio memoriae" décidée par le Sénat contre un empereur défunt ?',
 'qcm',
 '["L''exil posthume de sa famille","L''effacement systématique de son nom et de son image dans tout l''Empire","L''annulation de toutes ses lois","La confiscation de ses biens au profit du peuple"]',
 'L''effacement systématique de son nom et de son image dans tout l''Empire',
 'La damnatio memoriae ("condamnation de la mémoire") visait à effacer l''existence d''un individu de la mémoire officielle : martelage des inscriptions, suppression du visage sur les statues (souvent remplacé par celui du successeur), suppression du nom dans les documents officiels. Elle frappa des empereurs comme Domitien, Commode et Caracalla. Paradoxalement, nous connaissons bien ces empereurs précisément parce que les sources historiques mentionnent cette condamnation — ce qui préserva leur souvenir.',
 true),

-- R-13
('daily', 'hard', 'faction-romaine',
 'La gens Julia prétendait descendre d''Énée, fils de la déesse Vénus. Cette généalogie divine était un instrument politique autant qu''une conviction religieuse — Auguste l''exploita habilement.',
 'Quel culte Auguste établit-il à Rome pour honorer l''ancêtre divin de la gens Julia, en construisant un temple sur le Forum d''Auguste ?',
 'qcm',
 '["Mars Ultor","Vénus Genetrix","Apollon Palatin","Jupiter Capitolin"]',
 'Mars Ultor',
 'Auguste fit construire le temple de Mars Ultor ("Mars le Vengeur") sur le Forum d''Auguste, promis après la bataille de Philippes (42 av. J.-C.) où il vengea César. Mais le culte dynastique de Vénus Genetrix (Vénus mère, ancêtre de la gens Julia) avait été établi par César lui-même sur le Forum de César. Auguste joua des deux références divines : Vénus pour la légitimité julienne, Mars pour la légitimité militaire. L''Ara Pacis combina les deux thèmes dans la sculpture officielle.',
 true),

-- R-14
('daily', 'hard', 'faction-romaine',
 'La période des "empereurs-soldats" (235-284 ap. J.-C.) vit Rome traverser une crise d''une violence exceptionnelle — des dizaines d''empereurs en cinquante ans, la plupart assassinés.',
 'Quel est l''unique "empereur-soldat" de la période 235-284 à avoir abdiqué volontairement et survécu pour cultiver ses choux ?',
 'qcm',
 '["Aurélien","Dioclétien","Gallien","Dèce"]',
 'Dioclétien',
 'Dioclétien (règne 284-305) est le seul des empereurs de la crise du IIIe siècle à avoir abdiqué volontairement (1er mai 305), se retirant dans son palais de Split (Croatie actuelle). À des courtisans qui le suppliaient de reprendre le pouvoir, il répondit — selon une anecdote peut-être apocryphe mais célèbre — qu''ils devraient voir les choux qu''il cultivait. La crise des empereurs-soldats (235-284) vit 26 empereurs reconnus, presque tous assassinés. Dioclétien réorganisa l''Empire en tétrarchie.',
 true),

-- R-15
('daily', 'hard', 'faction-romaine',
 'La frontière romaine du Rhin et du Danube n''était pas un simple mur — c''était un système défensif en profondeur, avec des forts, des tours de guet, et des routes de patrouille. Son nom latin est encore utilisé en archéologie.',
 'Quel terme latin désigne le système de fortifications frontalières romaines (murs, fossés, tours, forts) formant la frontière de l''Empire ?',
 'qcm',
 '["Limes","Vallum","Fossa","Clausura"]',
 'Limes',
 'Le limes (pl. limites) désignait à l''origine simplement une "voie de frontière" ou un "chemin". Il prit progressivement le sens de frontière militarisée sous les empereurs. Le Limes Germanicus (entre Rhin et Danube) s''étendait sur 550 km, le Limes Raeticus sur 166 km — inscrits à l''UNESCO. Le vallum désigne spécifiquement le fossé derrière le Mur d''Hadrien. La fossa est un fossé simple. Le terme limes est aujourd''hui utilisé pour désigner toute frontière romaine fortifiée.',
 true),

-- R-16
('daily', 'hard', 'faction-romaine',
 'Rome avait ses banquiers, ses spéculateurs et ses sociétés de capitalistes. Le système financier romain était bien plus sophistiqué que ce qu''on imagine souvent, avec des instruments proches des actions modernes.',
 'Comment appelait-on les sociétés de fermiers de l''impôt romain qui émettaient des parts (partes) négociables, ancêtres des sociétés par actions ?',
 'qcm',
 '["Les negotiatores","Les argentarii","Les societates publicanorum","Les mensarii"]',
 'Les societates publicanorum',
 'Les societates publicanorum (sociétés de publicains) collectaient les impôts pour l''État romain en échange d''un contrat de concession. Elles émettaient des partes — des parts de propriété négociables sur le Forum — que les investisseurs achetaient et vendaient. Polybe mentionne que ces parts étaient très répandues. Cicéron (De Republique, De Officiis) décrit leur fonctionnement. Certains historiens (Ulrike Malmendier) les considèrent comme les premières sociétés par actions de l''histoire.',
 true),

-- ═══════════════════════════════════════════════════════════════
-- FACTION BYZANTINE (16)
-- ═══════════════════════════════════════════════════════════════

-- B-01
('daily', 'hard', 'faction-byzantine',
 'Le feu grégeois reste l''une des armes les plus mystérieuses de l''histoire militaire. Son secret, jalousement gardé par Constantinople, lui permit de survivre à des assauts navals qui auraient détruit tout autre empire.',
 'Lors de quel siège arabe de Constantinople le feu grégeois fut-il utilisé pour la première fois avec un effet décisif, vers 672-678 ap. J.-C. ?',
 'qcm',
 '["Premier siège arabe de Constantinople (672-678)","Siège de Thessalonique (904)","Siège de Syracuse (827)","Siège de Dorostolon (971)"]',
 'Premier siège arabe de Constantinople (672-678)',
 'C''est lors du premier grand siège arabe de Constantinople (672-678) que le feu grégeois, inventé selon la tradition par Callínicos d''Héliopolis (un ingénieur grec réfugié de Syrie), fut utilisé contre la flotte omeyyade. L''amiral arabe fut repoussé avec de lourdes pertes. La composition exacte du feu grégeois reste inconnue (probablement naphte, chaux vive, résine), mais il brûlait sur l''eau et ne pouvait être éteint — ce qui en faisait une arme psychologique autant que militaire.',
 true),

-- B-02
('daily', 'hard', 'faction-byzantine',
 'La querelle iconoclaste déchira l''Empire byzantin pendant plus d''un siècle, mêlant théologie, politique impériale et pression islamique. Elle eut deux phases distinctes, séparées par une restauration orthodoxe.',
 'En quelle année le Concile de Nicée II restaura-t-il officiellement le culte des images dans l''Empire byzantin, mettant fin à la première iconoclasie ?',
 'qcm',
 '["787","843","726","815"]',
 '787',
 'Le Concile de Nicée II (7e concile œcuménique, 787) présidé par la régente Irène d''Athènes restaura le culte des icônes, distinguant la "vénération" (proskynesis) de l''"adoration" (latrie) réservée à Dieu seul. La seconde iconoclasie éclata en 815 sous Léon V l''Arménien et prit fin définitivement en 843 — date célébrée comme le "Triomphe de l''Orthodoxie" dans l''Église orthodoxe jusqu''à aujourd''hui. L''icône de la Vierge Hodegetria fut au cœur de ces conflits.',
 true),

-- B-03
('daily', 'hard', 'faction-byzantine',
 'Byzance ne se contentait pas de résister — elle reconquérait. Le Xe siècle fut un âge d''or militaire, avec des généraux qui repoussèrent les frontières de l''Empire jusqu''en Syrie et en Mésopotamie.',
 'Quel général byzantin, surnommé "Pâle-de-Mort" (Nikephoros Phokas), reconquit la Crète aux Arabes en 961 ap. J.-C. ?',
 'qcm',
 '["Jean Tzimiskès","Niképhore II Phokas","Basile II","Bardas Sklèros"]',
 'Niképhore II Phokas',
 'Niképhore Phokas (futur Niképhore II, r. 963-969) reconquit la Crète en 961 après un siège de plusieurs mois d''Héraklion (Chandax), mettant fin à 135 ans de domination arabe sur l''île. Il reconquit ensuite Chypre et Cilicie, et ses campagnes syriennes atteignirent Alep. Il devint empereur en 963 et fut assassiné en 969 par son neveu Jean Tzimiskès (avec la complicité de l''impératrice Théophano). Liutprand de Crémone, ambassadeur à Byzance, le décrit avec une antipathie teintée d''admiration.',
 true),

-- B-04
('daily', 'hard', 'faction-byzantine',
 'La garde varègue de Constantinople était l''élite personnelle des empereurs byzantins — des guerriers nordiques recrutés pour leur loyauté envers l''or plutôt que pour des liens dynastiques byzantins.',
 'En quelle année et à la suite de quel événement Basile II reçut-il les 6 000 guerriers varègues qui formèrent le noyau de la garde varègue ?',
 'qcm',
 '["En 988, à la suite de l''alliance avec Vladimir de Kiev","En 1000, après la conquête bulgare","En 960, lors de la campagne de Crète","En 1025, à la mort de Basile II"]',
 'En 988, à la suite de l''alliance avec Vladimir de Kiev',
 'Basile II, menacé par la rébellion de Bardas Phocas, demanda l''aide de Vladimir Ier de Kiev (le Grand). Vladimir envoya 6 000 Varègues en échange de la main de la princesse Anne (sœur de Basile) — condition extraordinaire pour un "barbare". Ces guerriers aidèrent à écraser la rébellion. Vladimir se convertit au christianisme orthodoxe (988) et fit baptiser la Rus'' de Kiev — décision aux conséquences historiques incalculables pour la civilisation russe.',
 true),

-- B-05
('daily', 'hard', 'faction-byzantine',
 'La diplomatie byzantine était aussi sophistiquée que son armée — peut-être plus. L''Empire convertissait ses voisins au christianisme, créait des alphabets pour les barbares, et piégeait ses ennemis dans des dépendances spirituelles et commerciales.',
 'Quels missionnaires byzantins créèrent l''alphabet glagolitique pour écrire le slave au IXe siècle, ouvrant la voie à la civilisation slave chrétienne ?',
 'qcm',
 '["Photios et Méthode","Cyrille et Méthode","Clément et Naum","Basile et Méthode"]',
 'Cyrille et Méthode',
 'Cyrille (Constantin, 826-869) et Méthode (815-885), frères thessaloniciens envoyés en mission en Moravie en 863, créèrent le premier alphabet slave : le glagolitique (l''alphabet cyrillique, nommé en l''honneur de Cyrille, fut développé par leurs disciples). Ils traduisirent les Évangiles en vieux-slave liturgique. Leur mission fut contestée par les évêques francs qui exigeaient le latin comme seule langue liturgique — Rome trancha en leur faveur. Ils sont considérés comme les "apôtres des Slaves".',
 true),

-- B-06
('daily', 'hard', 'faction-byzantine',
 'La chute de Constantinople en 1453 n''était pas inévitable — plusieurs tentatives de sauvetage occidental échouèrent, en partie à cause des divisions religieuses entre orthodoxes et catholiques.',
 'Quelle bataille de 1444, si elle avait été une victoire chrétienne, aurait peut-être sauvé Constantinople de la chute ottomane ?',
 'qcm',
 '["Bataille de Varna","Bataille de Kosovo (1389)","Bataille de Nicopolis","Bataille de Mohács"]',
 'Bataille de Varna',
 'La bataille de Varna (10 novembre 1444) opposa une croisade chrétienne (Hongrois, Polonais, Valaques, chevaliers occidentaux) à Murad II. La mort du roi Vladislas III de Pologne/Hongrie et la désintégration de la coalition entraînèrent une défaite totale. Constantinople tomba neuf ans plus tard. Si la croisade avait gagné, elle aurait pu consolider les Balkans et peut-être renverser la pression ottomane. La bataille de Nicopolis (1396) avait été la première grande défaite croisée dans la région.',
 true),

-- B-07
('daily', 'hard', 'faction-byzantine',
 'L''administration byzantine était remarquablement centralisée — et les titres honorifiques étaient distribués avec une précision calculée pour créer des hiérarchies de loyauté autour de l''empereur.',
 'Comment appelait-on le haut dignitaire byzantin qui gérait les finances impériales et la trésorerie, deuxième personnage de l''administration civile ?',
 'qcm',
 '["Le logothète du drome","Le sacellaire","Le mégas logariaste","Le sakellarios"]',
 'Le sakellarios',
 'Le sakellarios (σακελλάριος) était le haut fonctionnaire responsable du trésor impérial (sakellion) et de la surveillance des finances de l''État byzantin. Il contrôlait les autres logothètes (ministres de département). Le logothète du drome gérait les postes et la diplomatie. Au fil des siècles, les titres et fonctions byzantins évolèrent considérablement — le mégas logariaste devint plus tard le chef de la comptabilité impériale sous les Paléologues. La complexité de la bureaucratie byzantine est un trait distinctif de l''Empire.',
 true),

-- B-08
('daily', 'hard', 'faction-byzantine',
 'Le schisme de 1054 entre Rome et Constantinople n''est pas une séparation soudaine — il fut la conclusion d''une longue dérive qui dura des siècles. Son acte symbolique fut spectaculairement précis.',
 'Qui fut le légat papal qui déposa la bulle d''excommunication sur l''autel de Sainte-Sophie en 1054, provoquant le Grand Schisme ?',
 'qcm',
 '["Humbert de Moyenmoutier","Hildebrand (futur Grégoire VII)","Pierre Damien","Anselme de Canterbury"]',
 'Humbert de Moyenmoutier',
 'Humbert de Moyenmoutier (ou Humbert de Silva Candida), cardinal légat du pape Léon IX (déjà mort à ce moment), déposa une bulle d''excommunication sur l''autel de Sainte-Sophie le 16 juillet 1054, visant le patriarche Cérulaire. La réponse de Cérulaire fut d''excommunier les légats. Le schisme résulta d''un cumul de griefs : le Filioque (ajout au Credo), la primauté papale, les rites azymes latins vs levés orthodoxes. Il ne fut "formellement" reconnu irréversible que beaucoup plus tard.',
 true),

-- B-09
('daily', 'hard', 'faction-byzantine',
 'L''art byzantin est rarement compris dans sa logique interne — ce n''est pas un art "primitif" figé, mais un art théologique où chaque détail (la couleur, la position des mains, le regard) a une signification codifiée.',
 'Dans l''iconographie byzantine, que signifie le fond d''or (chrysos) omniprésent sur les icônes ?',
 'qcm',
 '["La richesse de l''Église","La lumière divine incréée","La royauté impériale","La sainteté du personnage représenté"]',
 'La lumière divine incréée',
 'Le fond d''or des icônes byzantines représente la lumière divine incréée (la lumière de la Tabor, selon la théologie hésychaste développée par Grégoire Palamas au XIVe siècle). Ce n''est pas un fond décoratif : c''est l''absence de perspective spatiale — le personnage sacré n''existe pas dans l''espace terrestre mais dans l''éternité divine. L''or est une lumière, pas une surface. Cette théologie explique pourquoi l''art byzantin refusa délibérément le naturalisme occidental jusqu''à sa fin.',
 true),

-- B-10
('daily', 'hard', 'faction-byzantine',
 'L''Empire byzantin pratiquait une politique matrimoniale complexe, mariant ses princesses à des souverains étrangers pour créer des liens diplomatiques — mais refusant parfois ce qu''il accordait à d''autres, selon des calculs de prestige précis.',
 'Quel titre honorifique l''Empire byzantin accordait-il aux souverains étrangers qui entraient dans son système d''alliances, les intégrant symboliquement à la "famille des rois" centrée sur l''empereur ?',
 'qcm',
 '["César","Patricios","Fils spirituel","Protospatharios"]',
 'Fils spirituel',
 'La diplomatie byzantine créait des relations de "parenté spirituelle" — l''empereur devenait le parrain (koumbaros) ou le père spirituel de rois étrangers après leur conversion ou leur alliance. Ce titre de "fils spirituel" (teknon) intégrait symboliquement le roi barbare dans la hiérarchie universelle centrée sur Constantinople. Constantine VII Porphyrogénète (De Administrando Imperio) décrit en détail quels peuples méritaient quels titres — et surtout lesquels ne devaient JAMAIS recevoir la pourpre impériale ni épouser des princesses de sang.',
 true),

-- B-11
('daily', 'hard', 'faction-byzantine',
 'La bataille de Manzikert (1071) est souvent présentée comme le coup mortel porté à Byzance — mais les Byzantins auraient pu survivre à cette défaite si leurs propres élites ne les avaient pas déchirés de l''intérieur.',
 'Qui captura l''empereur byzantin Romain IV Diogène lors de la bataille de Manzikert en 1071 ?',
 'qcm',
 '["Alp Arslan","Toghrul Beg","Kilij Arslan","Malik-Chah"]',
 'Alp Arslan',
 'Alp Arslan, sultan seldjoukide, captura l''empereur Romain IV Diogène lors de la bataille de Manzikert (26 août 1071, en Arménie actuelle). Il traita son prisonnier avec une courtoisie notable — libération contre rançon et traité de paix. Mais à son retour, Romain IV fut destitué, aveuglé et tué par ses rivaux byzantins. Le traité fut ignoré. Les Seldjoukides envahirent alors massivement l''Anatolie, privant Byzance de ses provinces les plus riches et de ses réserves de recrutement.',
 true),

-- B-12
('daily', 'hard', 'faction-byzantine',
 'La quatrième croisade (1202-1204) n''atteignit jamais l''Égypte — elle se perdit à Constantinople, qu''elle prit d''assaut et pilla pendant trois jours. Cet événement divisa la chrétienté pour toujours.',
 'Quel doge de Venise, âgé et presque aveugle, dirigea personnellement la prise de Constantinople en 1204 depuis la proue de son navire ?',
 'qcm',
 '["Enrico Dandolo","Pietro Ziani","Giovanni Michiel","Raniero Zeno"]',
 'Enrico Dandolo',
 'Enrico Dandolo, doge de Venise, avait environ 90 ans lors de la prise de Constantinople (avril 1204). Aveugle ou presque — peut-être à la suite d''un séjour à Constantinople dans sa jeunesse où il aurait été maltraité par les Byzantins — il monta le premier sur les murailles ou dirigea l''assaut depuis son navire selon les chroniques. Il mourut à Constantinople en 1205 et y fut enterré dans Sainte-Sophie. La prise de Constantinople par des croisés chrétiens choqua même le pape Innocent III.',
 true),

-- B-13
('daily', 'hard', 'faction-byzantine',
 'Les Byzantins n''oublièrent jamais la prise de leur capitale — même après sa restauration, ils gardèrent la mémoire du sac latin. Et quand Constantinople tomba definitvement en 1453, certains Byzantins choisirent les Turcs aux Latins.',
 'Quelle formule prononcée par le Grand Duc Lucas Notaras avant 1453 résume le sentiment de nombreux Byzantins envers l''union avec Rome ?',
 'qcm',
 '["\"Mieux vaut la mort que l''union latine\"","\"Mieux vaut le turban du sultan que la tiare du pape\"","\"Constantinople mourra mais jamais ne se rendra\"","\"La Croix vaut plus que la couronne\""]',
 '"Mieux vaut le turban du sultan que la tiare du pape"',
 'Lucas Notaras (Loukas Notaras), mégas doux (amiral en chef) byzantin, aurait dit : "Je préfère voir dans cette ville le turban des Turcs que la tiare latine" — une formule qui résume le ressentiment orthodoxe après des siècles d''humiliations latines culminant avec 1204. Notaras s''opposa à l''Union de Florence (1439). Paradoxalement, il fut exécuté par Mehmed II après la chute de Constantinople en 1453, ses fils étant réclamés pour le harem du sultan.',
 true),

-- B-14
('daily', 'hard', 'faction-byzantine',
 'La science et la philosophie ne moururent pas à la chute de Rome — elles survécurent à Byzance, et les Byzantins transmirent à l''Occident renaissant les textes grecs que les Arabes avaient déjà en partie préservés.',
 'Quelle académie ou école philosophique byzantine, active au XVe siècle à Mistra (Péloponnèse), influença directement la Renaissance florentine ?',
 'qcm',
 '["L''école de Trébizonde","L''école de Thessalonique","L''école de Mistra (Pléthon)","L''Académie de Nicée"]',
 'L''école de Mistra (Pléthon)',
 'Gémiste Pléthon (vers 1355-1452/54), philosophe byzantin platonicien basé à Mistra (cité byzantine du Péloponnèse), participa au Concile de Florence (1438-39) et y répandit l''enthousiasme pour Platon parmi les humanistes italiens. Côme de Médicis, impressionné, fonda l''Académie platonicienne de Florence. Pléthon lui-même proposa de remplacer le christianisme par un néo-paganisme grec — une œuvre brûlée après sa mort par le patriarche Gennadios. Il fut l''un des catalyseurs de la Renaissance.',
 true),

-- B-15
('daily', 'hard', 'faction-byzantine',
 'La succession impériale byzantine n''obéissait pas à des règles fixes de primogéniture — la légitimité se gagnait aussi par la naissance dans la chambre pourpre du palais, une distinction aux conséquences durables.',
 'Que signifiait le titre de "Porphyrogénète" (né dans la pourpre) dans la hiérarchie byzantine ?',
 'qcm',
 '["Né pendant le règne de son père","Né dans la chambre pourpre du Palais Sacré","Baptisé avec la pourpre impériale","Désigné héritier avant sa naissance"]',
 'Né dans la chambre pourpre du Palais Sacré',
 'Le titre de Porphyrogénète (Πορφυρογέννητος, "né dans la pourpre") désignait un enfant né dans la chambre revêtue de porphyre rouge du Palais Sacré de Constantinople, réservée aux accouchements impériaux. Cela donnait une légitimité spéciale — une naissance "dans la pourpre" valait plus qu''une naissance royale ordinaire. Constantin VII, qui régna au Xe siècle, était si fier de ce titre qu''il signa de nombreux ouvrages "Constantin Porphyrogénète". Le porphyre rouge, extrait d''une seule carrière en Égypte, était la couleur du pouvoir impérial.',
 true),

-- B-16
('daily', 'hard', 'faction-byzantine',
 'L''Empire byzantin survécut à sa propre chute — de petits États successeurs se proclamèrent héritiers de Byzance pendant des décennies après 1453, dont l''un persista jusqu''en 1461.',
 'Quel empire byzantin en exil, fondé après 1204, survécut à la chute de Constantinople de 1453 et ne fut conquis par les Ottomans qu''en 1461 ?',
 'qcm',
 '["L''Empire de Nicée","L''Empire de Trébizonde","L''Despotat de Mistra","L''Empire de Thessalonique"]',
 'L''Empire de Trébizonde',
 'L''Empire de Trébizonde (1204-1461), fondé par Alexis et David Comnène sur les rives de la mer Noire (Trabzon, Turquie actuelle), fut le dernier État successeur byzantin. Il survécut à la chute de Constantinople de 1453 de huit ans, avant d''être conquis par Mehmed II en 1461. Riche grâce au commerce de la Route de la Soie et aux mines d''argent pontiques, il avait maintenu une culture byzantine remarquable et des contacts avec la Géorgie, l''Arménie et les khans mongols.',
 true);
