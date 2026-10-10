-- WHY: le choix du calendrier (spec docs/superpowers/specs/2026-10-09-choix-du-calendrier-design.md).
-- Les dates des énigmes sont balisées entre accolades — {52 av. J.-C.}, {IIIe siècle} — pour que l'appli
-- les convertisse dans le calendrier du joueur. En chrétien, le texte affiché reste celui d'avant.
-- Liste avant/après relue et validée par Uriel le 10/10/2026 (251 énigmes).
-- Chaque UPDATE ne touche une énigme que si ses textes sont encore ceux relus : si l'une a été modifiée
-- entre-temps, la migration entière échoue au lieu d'écraser la modification.

DO $migration$
DECLARE
  n integer;
  total integer := 0;
BEGIN
  UPDATE enigmas SET
    lore_text = $t$En {330}, Constantin déplace le cœur de l'Empire vers l'Orient. La ville qu'il fonde survivra mille ans à celle qu'il quitte.$t$,
    explanation = $t$La cité grecque de Byzance, fondée vers {657 av. J.-C.} par des colons de Mégare, contrôlait le détroit du Bosphore. Constantin y vit l'emplacement stratégique parfait pour sa nouvelle capitale, entre Europe et Asie.$t$
  WHERE id = 3
    AND lore_text IS NOT DISTINCT FROM $t$En 330, Constantin déplace le cœur de l'Empire vers l'Orient. La ville qu'il fonde survivra mille ans à celle qu'il quitte.$t$
    AND question IS NOT DISTINCT FROM $t$Quel nom portait Constantinople avant que Constantin ne la rebaptise ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La cité grecque de Byzance, fondée vers 657 av. J.-C. par des colons de Mégare, contrôlait le détroit du Bosphore. Constantin y vit l'emplacement stratégique parfait pour sa nouvelle capitale, entre Europe et Asie.$t$
    AND answer IS NOT DISTINCT FROM $t$Byzance$t$
    AND choices IS NOT DISTINCT FROM $t$["Nicée","Antioche","Byzance","Éphèse"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le futhark ancien (du nom de ses six premières lettres : F-U-Þ-A-R-K) compte 24 runes. Chaque signe avait un nom et une signification au-delà du son : *fehu* (bétail/richesse), *ansuz* (dieu/Odin). Les plus anciennes inscriptions runiques datent du {IIe siècle}.$t$
  WHERE id = 6
    AND lore_text IS NOT DISTINCT FROM $t$L'écriture des peuples germaniques et scandinaves n'utilisait ni parchemin ni encre. Chaque signe était taillé dans le bois ou la pierre, fait de lignes droites — plus faciles à graver qu'à tracer.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on l'alphabet utilisé par les peuples nordiques avant la christianisation ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le futhark ancien (du nom de ses six premières lettres : F-U-Þ-A-R-K) compte 24 runes. Chaque signe avait un nom et une signification au-delà du son : *fehu* (bétail/richesse), *ansuz* (dieu/Odin). Les plus anciennes inscriptions runiques datent du IIe siècle.$t$
    AND answer IS NOT DISTINCT FROM $t$Les runes$t$
    AND choices IS NOT DISTINCT FROM $t$["Les hiéroglyphes","Les runes","Les ogham","Les cunéiformes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Quand les barbares ont submergé Rome en {476}, une moitié de l'Empire a continué comme si de rien n'était. Pendant mille ans encore, elle a maintenu le droit, la foi et les routes commerciales.$t$,
    explanation = $t$Le 29 mai {1453}, après un siège de 53 jours, Mehmed II entre dans la ville. Les murailles théodosiennes, imprenables pendant un millénaire, ont cédé face aux canons géants de l'ingénieur hongrois Urbain. Le dernier empereur, Constantin XI, est mort les armes à la main.$t$,
    answer = $t${1453}$t$,
    choices = $t$["{1204}","{1389}","{1453}","{1492}"]$t$::jsonb
  WHERE id = 7
    AND lore_text IS NOT DISTINCT FROM $t$Quand les barbares ont submergé Rome en 476, une moitié de l'Empire a continué comme si de rien n'était. Pendant mille ans encore, elle a maintenu le droit, la foi et les routes commerciales.$t$
    AND question IS NOT DISTINCT FROM $t$En quelle année Constantinople est-elle finalement tombée aux mains des Ottomans ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le 29 mai 1453, après un siège de 53 jours, Mehmed II entre dans la ville. Les murailles théodosiennes, imprenables pendant un millénaire, ont cédé face aux canons géants de l'ingénieur hongrois Urbain. Le dernier empereur, Constantin XI, est mort les armes à la main.$t$
    AND answer IS NOT DISTINCT FROM $t$1453$t$
    AND choices IS NOT DISTINCT FROM $t$["1204","1389","1453","1492"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Auguste fit ériger le Milliarium Aureum (borne milliaire dorée) au Forum en {20 av. J.-C.} Toutes les distances de l'Empire étaient mesurées depuis ce point. Le réseau routier romain couvrait 400 000 km — dont certains tronçons sont encore visibles aujourd'hui.$t$
  WHERE id = 8
    AND lore_text IS NOT DISTINCT FROM $t$Une route droite, pavée de pierres taillées, bordée de bornes milliaires. On dit qu'elle menait partout — et c'était presque vrai.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle expression latine signifie que « tous les chemins mènent à Rome » et désigne la borne d'or du Forum ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Auguste fit ériger le Milliarium Aureum (borne milliaire dorée) au Forum en 20 av. J.-C. Toutes les distances de l'Empire étaient mesurées depuis ce point. Le réseau routier romain couvrait 400 000 km — dont certains tronçons sont encore visibles aujourd'hui.$t$
    AND answer IS NOT DISTINCT FROM $t$Milliarium Aureum$t$
    AND choices IS NOT DISTINCT FROM $t$["Via Appia","Milliarium Aureum","Cursus Publicum","Pax Romana"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les alignements de Carnac comptent près de 3 000 menhirs répartis sur 4 km, érigés entre {4500 av. J.-C.} et {3300 av. J.-C.} — bien avant les pyramides. Leur fonction exacte reste débattue : calendrier astronomique, chemin processionnaire, marqueur territorial ?$t$
  WHERE id = 9
    AND lore_text IS NOT DISTINCT FROM $t$Des milliers de pierres dressées, alignées sur des kilomètres, dans la lande bretonne. Personne ne sait vraiment pourquoi elles sont là — et ça dure depuis 6 000 ans.$t$
    AND question IS NOT DISTINCT FROM $t$Dans quelle commune bretonne trouve-t-on le plus célèbre alignement mégalithique d'Europe ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les alignements de Carnac comptent près de 3 000 menhirs répartis sur 4 km, érigés entre 4500 et 3300 av. J.-C. — bien avant les pyramides. Leur fonction exacte reste débattue : calendrier astronomique, chemin processionnaire, marqueur territorial ?$t$
    AND answer IS NOT DISTINCT FROM $t$Carnac$t$
    AND choices IS NOT DISTINCT FROM $t$["Locmariaquer","Carnac","Brocéliande","Stonehenge"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les thermes de Caracalla à Rome ({216 ap. J.-C.}) pouvaient accueillir 1 600 baigneurs simultanément. On y trouvait bibliothèques, jardins, salles de sport et boutiques. L'entrée était gratuite ou quasi gratuite — c'était un service public essentiel.$t$
  WHERE id = 11
    AND lore_text IS NOT DISTINCT FROM $t$Sous la République puis l'Empire, un citoyen romain pouvait se baigner, faire du sport, lire, discuter philosophie et conclure des affaires — le tout dans un seul bâtiment public.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on les grands complexes de bains publics romains ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les thermes de Caracalla à Rome (216 ap. J.-C.) pouvaient accueillir 1 600 baigneurs simultanément. On y trouvait bibliothèques, jardins, salles de sport et boutiques. L'entrée était gratuite ou quasi gratuite — c'était un service public essentiel.$t$
    AND answer IS NOT DISTINCT FROM $t$Les thermes$t$
    AND choices IS NOT DISTINCT FROM $t$["Les arènes","Les thermes","Les basiliques","Les gymnases"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel monument Justinien a-t-il fait construire à Constantinople en {537} ?$t$
  WHERE id = 12
    AND lore_text IS NOT DISTINCT FROM $t$Justinien voulait bâtir un lieu de culte qui ferait oublier le temple de Salomon. Il y a consacré les revenus fiscaux de l'Empire pendant cinq ans. Le résultat a stupéfié le monde.$t$
    AND question IS NOT DISTINCT FROM $t$Quel monument Justinien a-t-il fait construire à Constantinople en 537 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La basilique Sainte-Sophie (Hagia Sophia) possédait la plus grande coupole du monde pendant près de 1 000 ans (31 mètres de diamètre). À sa consécration, Justinien aurait déclaré : « Salomon, je t'ai surpassé. »$t$
    AND answer IS NOT DISTINCT FROM $t$Sainte-Sophie$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Palais de Topkapi","La Mosquée bleue","Sainte-Sophie","Sainte-Irène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La coupole du Panthéon (43,3 m de diamètre) n'a été surpassée qu'au {XVe siècle} par Brunelleschi à Florence. Le béton romain, à base de cendres volcaniques (pouzzolane), se renforce avec le temps au contact de l'eau — l'exact opposé du béton moderne.$t$
  WHERE id = 14
    AND lore_text IS NOT DISTINCT FROM $t$Deux mille ans après sa construction, il est toujours debout, avec son oculus ouvert sur le ciel. Quand il pleut, l'eau entre — et s'évacue par un système de drainage toujours fonctionnel.$t$
    AND question IS NOT DISTINCT FROM $t$Quel temple romain, bâti sous Hadrien, possède la plus grande coupole en béton non armé jamais construite ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La coupole du Panthéon (43,3 m de diamètre) n'a été surpassée qu'au XVe siècle par Brunelleschi à Florence. Le béton romain, à base de cendres volcaniques (pouzzolane), se renforce avec le temps au contact de l'eau — l'exact opposé du béton moderne.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Panthéon$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Colisée","Le Panthéon","Le temple de Jupiter","La Maison carrée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le futhark ancien ({IIe siècle}-{VIIIe siècle}) compte 24 runes, divisées en trois groupes de huit (ættir). Les Vikings l'ont simplifié en futhark récent à 16 runes — paradoxalement, moins de signes pour noter plus de sons, rendant les inscriptions plus ambiguës.$t$
  WHERE id = 15
    AND lore_text IS NOT DISTINCT FROM $t$Un alphabet de glace et de feu, gravé sur des pierres dressées dans toute la Scandinavie. Chaque inscription est un message laissé aux vivants par ceux qui savaient tailler la pierre.$t$
    AND question IS NOT DISTINCT FROM $t$Combien de runes compte le futhark ancien, l'alphabet runique le plus répandu ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le futhark ancien (IIe-VIIIe siècle) compte 24 runes, divisées en trois groupes de huit (ættir). Les Vikings l'ont simplifié en futhark récent à 16 runes — paradoxalement, moins de signes pour noter plus de sons, rendant les inscriptions plus ambiguës.$t$
    AND answer IS NOT DISTINCT FROM $t$24$t$
    AND choices IS NOT DISTINCT FROM $t$["16","20","24","32"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Cyrille a d'abord créé l'alphabet glagolitique vers {863}. Ses disciples ont ensuite développé le cyrillique, plus simple et basé sur l'onciale grecque. Aujourd'hui, plus de 250 millions de personnes utilisent cet alphabet au quotidien.$t$
  WHERE id = 16
    AND lore_text IS NOT DISTINCT FROM $t$Deux frères de Thessalonique, envoyés en mission chez les Slaves, ont inventé un système d'écriture pour traduire la Bible. Leur héritage se lit encore dans la moitié de l'Europe.$t$
    AND question IS NOT DISTINCT FROM $t$Quel alphabet, créé par les disciples de Cyrille et Méthode, est encore utilisé en Russie, Serbie et Bulgarie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Cyrille a d'abord créé l'alphabet glagolitique vers 863. Ses disciples ont ensuite développé le cyrillique, plus simple et basé sur l'onciale grecque. Aujourd'hui, plus de 250 millions de personnes utilisent cet alphabet au quotidien.$t$
    AND answer IS NOT DISTINCT FROM $t$L'alphabet cyrillique$t$
    AND choices IS NOT DISTINCT FROM $t$["L'alphabet glagolitique","L'alphabet cyrillique","L'alphabet copte","L'alphabet arménien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {52 av. J.-C.}, un jeune chef arverne unit les tribus gauloises pour la première — et dernière — fois. Sa défaite finale est devenue le mythe fondateur de la résistance gauloise.$t$,
    question = $t$Quel chef gaulois a mené la grande révolte contre César en {52 av. J.-C.} ?$t$,
    explanation = $t$Son nom signifie « roi suprême des guerriers » (ver-cingeto-rix). Après sa victoire à Gergovie, il a été vaincu à Alésia par le siège de César. Emprisonné six ans à Rome, il a été étranglé lors du triomphe de César en {46 av. J.-C.}$t$
  WHERE id = 17
    AND lore_text IS NOT DISTINCT FROM $t$En 52 av. J.-C., un jeune chef arverne unit les tribus gauloises pour la première — et dernière — fois. Sa défaite finale est devenue le mythe fondateur de la résistance gauloise.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef gaulois a mené la grande révolte contre César en 52 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Son nom signifie « roi suprême des guerriers » (ver-cingeto-rix). Après sa victoire à Gergovie, il a été vaincu à Alésia par le siège de César. Emprisonné six ans à Rome, il a été étranglé lors du triomphe de César en 46 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Vercingétorix$t$
    AND choices IS NOT DISTINCT FROM $t$["Ambiorix","Vercingétorix","Brennus","Diviciacus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {79}, le Vésuve a englouti deux villes sous des mètres de cendres. Dix-sept siècles plus tard, les archéologues ont retrouvé des pains intacts, des fresques éclatantes et des corps figés dans leur dernier geste.$t$,
    question = $t$Quelle ville romaine, ensevelie par le Vésuve en {79 ap. J.-C.}, est le site archéologique le plus visité d'Italie ?$t$
  WHERE id = 18
    AND lore_text IS NOT DISTINCT FROM $t$En 79, le Vésuve a englouti deux villes sous des mètres de cendres. Dix-sept siècles plus tard, les archéologues ont retrouvé des pains intacts, des fresques éclatantes et des corps figés dans leur dernier geste.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ville romaine, ensevelie par le Vésuve en 79 ap. J.-C., est le site archéologique le plus visité d'Italie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Pompéi comptait environ 11 000 habitants. Les cendres ont préservé un instantané de la vie quotidienne romaine : tavernes, lupanars, graffitis politiques. On y a retrouvé des slogans électoraux peints sur les murs — la plus ancienne propagande politique conservée.$t$
    AND answer IS NOT DISTINCT FROM $t$Pompéi$t$
    AND choices IS NOT DISTINCT FROM $t$["Herculanum","Pompéi","Stabies","Oplontis"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les Bleus (aristocrates, orthodoxes) et les Verts (marchands, monophysites) étaient bien plus que des clubs sportifs. En {532}, leur révolte commune (sédition Nika) a failli renverser Justinien et détruit la moitié de Constantinople avant d'être écrasée dans le sang — 30 000 morts dans l'hippodrome.$t$
  WHERE id = 20
    AND lore_text IS NOT DISTINCT FROM $t$L'hippodrome de Constantinople n'était pas qu'un cirque — c'était le cœur politique de l'Empire. Les factions de supporters y faisaient et défaisaient les empereurs.$t$
    AND question IS NOT DISTINCT FROM $t$Quelles étaient les deux principales factions rivales de l'hippodrome de Constantinople ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Bleus (aristocrates, orthodoxes) et les Verts (marchands, monophysites) étaient bien plus que des clubs sportifs. En 532, leur révolte commune (sédition Nika) a failli renverser Justinien et détruit la moitié de Constantinople avant d'être écrasée dans le sang — 30 000 morts dans l'hippodrome.$t$
    AND answer IS NOT DISTINCT FROM $t$Bleus et Verts$t$
    AND choices IS NOT DISTINCT FROM $t$["Rouges et Noirs","Bleus et Verts","Blancs et Pourpres","Or et Argent"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Des crânes trépanés avec repousse osseuse (donc survie du patient) ont été retrouvés à Ensisheim (Alsace, {5000 av. J.-C.}). Le taux de survie estimé dépasse 50 % — comparable à celui des chirurgiens de la guerre de Sécession, 7 000 ans plus tard.$t$
  WHERE id = 21
    AND lore_text IS NOT DISTINCT FROM $t$Les archéologues ont retrouvé des crânes percés datant du Néolithique, avec des signes de cicatrisation — preuve que le patient a survécu. Nos ancêtres ouvraient le crâne des vivants, et certains s'en remettaient.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on l'opération chirurgicale consistant à percer un trou dans le crâne, pratiquée dès le Néolithique en Europe ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Des crânes trépanés avec repousse osseuse (donc survie du patient) ont été retrouvés à Ensisheim (Alsace, 5000 av. J.-C.). Le taux de survie estimé dépasse 50 % — comparable à celui des chirurgiens de la guerre de Sécession, 7 000 ans plus tard.$t$
    AND answer IS NOT DISTINCT FROM $t$La trépanation$t$
    AND choices IS NOT DISTINCT FROM $t$["La trépanation","La craniotomie","La lobotomie","La cautérisation"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Comment les Vikings appelaient-ils la terre qu'ils ont découverte en Amérique du Nord vers l'an {1000} ?$t$,
    explanation = $t$Leif Eriksson a atteint le Vinland (« terre de la vigne ») vers l'an {1000}. Le site de L'Anse aux Meadows (Terre-Neuve), fouillé en {1960}, a confirmé la présence viking en Amérique. Les sagas mentionnent des conflits avec les autochtones (Skrælings) qui ont forcé l'abandon de la colonie.$t$
  WHERE id = 22
    AND lore_text IS NOT DISTINCT FROM $t$Bien avant Christophe Colomb, des marins nordiques ont posé le pied sur un continent inconnu. Ils y ont trouvé du raisin sauvage et des prairies verdoyantes — mais n'ont pas pu s'y maintenir.$t$
    AND question IS NOT DISTINCT FROM $t$Comment les Vikings appelaient-ils la terre qu'ils ont découverte en Amérique du Nord vers l'an 1000 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Leif Eriksson a atteint le Vinland (« terre de la vigne ») vers l'an 1000. Le site de L'Anse aux Meadows (Terre-Neuve), fouillé en 1960, a confirmé la présence viking en Amérique. Les sagas mentionnent des conflits avec les autochtones (Skrælings) qui ont forcé l'abandon de la colonie.$t$
    AND answer IS NOT DISTINCT FROM $t$Vinland$t$
    AND choices IS NOT DISTINCT FROM $t$["Groenland","Markland","Vinland","Helluland"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Inventé vers {672}, le feu grégeois brûlait sur l'eau et ne pouvait être éteint qu'avec du sable ou du vinaigre. Sa recette était un secret d'État si bien gardé qu'il s'est perdu à la chute de l'Empire. Les historiens pensent à un mélange de naphte, résine et chaux vive, mais aucune reconstitution moderne n'a reproduit tous les effets décrits.$t$
  WHERE id = 23
    AND lore_text IS NOT DISTINCT FROM $t$Sur les murs de la flotte impériale, des siphons crachaient un feu liquide que l'eau ne pouvait éteindre. L'arme la plus redoutée de la Méditerranée médiévale — et personne ne connaît la recette.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on l'arme incendiaire secrète utilisée par la marine byzantine, dont la composition reste inconnue ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Inventé vers 672, le feu grégeois brûlait sur l'eau et ne pouvait être éteint qu'avec du sable ou du vinaigre. Sa recette était un secret d'État si bien gardé qu'il s'est perdu à la chute de l'Empire. Les historiens pensent à un mélange de naphte, résine et chaux vive, mais aucune reconstitution moderne n'a reproduit tous les effets décrits.$t$
    AND answer IS NOT DISTINCT FROM $t$Le feu grégeois$t$
    AND choices IS NOT DISTINCT FROM $t$["Le naphta","Le feu grégeois","L'huile ardente","Le soufre liquide"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La pouzzolane (cendres volcaniques de Pouzzoles) réagit avec la chaux et l'eau de mer pour former des cristaux d'aluminium tobermorite, qui se renforcent avec le temps. Une étude de {2017} (University of Utah) a montré que l'eau de mer renforce le béton romain au lieu de le détruire — l'exact inverse du béton Portland moderne.$t$
  WHERE id = 24
    AND lore_text IS NOT DISTINCT FROM $t$Le béton romain résiste depuis deux millénaires. Les ports romains immergés sont toujours solides. Notre béton moderne commence à se fissurer au bout de 50 ans. Leur secret ? Une réaction chimique que nous venons à peine de comprendre.$t$
    AND question IS NOT DISTINCT FROM $t$Quel ingrédient volcanique donne au béton romain sa résistance exceptionnelle à l'eau de mer ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La pouzzolane (cendres volcaniques de Pouzzoles) réagit avec la chaux et l'eau de mer pour former des cristaux d'aluminium tobermorite, qui se renforcent avec le temps. Une étude de 2017 (University of Utah) a montré que l'eau de mer renforce le béton romain au lieu de le détruire — l'exact inverse du béton Portland moderne.$t$
    AND answer IS NOT DISTINCT FROM $t$La pouzzolane$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La Garde varangienne (du norrois "væringi", « ceux qui ont prêté serment ») a protégé les empereurs byzantins du {Xe siècle} au {XIVe siècle}. Harald Hardrada, futur roi de Norvège, en a fait partie. Ils étaient payés en or et avaient le droit de « piller le palais » à la mort de chaque empereur.$t$
  WHERE id = 26
    AND lore_text IS NOT DISTINCT FROM $t$Des guerriers scandinaves se sont mis au service de l'empereur de Constantinople. Ils formaient sa garde personnelle — les hommes les plus grands, les mieux armés, et les plus loyaux de l'Empire.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait la garde d'élite de l'empereur byzantin, composée de guerriers scandinaves ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Garde varangienne (du norrois "væringi", « ceux qui ont prêté serment ») a protégé les empereurs byzantins du Xe au XIVe siècle. Harald Hardrada, futur roi de Norvège, en a fait partie. Ils étaient payés en or et avaient le droit de « piller le palais » à la mort de chaque empereur.$t$
    AND answer IS NOT DISTINCT FROM $t$La Garde varangienne$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Jomsvikings","La Garde varangienne","Les Housecarls","Les Thegns"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {1204}, une armée chrétienne censée libérer Jérusalem s'est retournée contre la plus grande ville chrétienne du monde. Le sac qui a suivi a choqué l'Europe entière.$t$,
    question = $t$Quelle croisade a abouti au sac de Constantinople par les croisés eux-mêmes en {1204} ?$t$
  WHERE id = 27
    AND lore_text IS NOT DISTINCT FROM $t$En 1204, une armée chrétienne censée libérer Jérusalem s'est retournée contre la plus grande ville chrétienne du monde. Le sac qui a suivi a choqué l'Europe entière.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle croisade a abouti au sac de Constantinople par les croisés eux-mêmes en 1204 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Détournée par Venise (qui finançait la flotte), la quatrième croisade a pillé Constantinople pendant trois jours. Les croisés ont volé les chevaux de bronze de l'hippodrome (aujourd'hui à Venise), fondu des œuvres d'art en lingots, et profané Sainte-Sophie. L'Empire latin qu'ils ont fondé n'a duré que 57 ans.$t$
    AND answer IS NOT DISTINCT FROM $t$La quatrième croisade$t$
    AND choices IS NOT DISTINCT FROM $t$["La deuxième croisade","La troisième croisade","La quatrième croisade","La cinquième croisade"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Construit en {142} sous Antonin le Pieux, ce mur de tourbe et de bois s'étendait sur 63 km entre le Firth of Forth et le Firth of Clyde. Abandonné vers {162}, il marque la limite nord de l'expansion romaine. Les Pictes au-delà n'ont jamais été soumis — Rome a renoncé.$t$
  WHERE id = 28
    AND lore_text IS NOT DISTINCT FROM $t$Les Romains ont construit un mur de 117 km à travers l'Angleterre — puis un second, plus au nord, en Écosse. Le mur d'Écosse a été abandonné après seulement 20 ans. Trop de résistance picte.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle le mur romain construit en Écosse, plus au nord que le mur d'Hadrien, et rapidement abandonné ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Construit en 142 sous Antonin le Pieux, ce mur de tourbe et de bois s'étendait sur 63 km entre le Firth of Forth et le Firth of Clyde. Abandonné vers 162, il marque la limite nord de l'expansion romaine. Les Pictes au-delà n'ont jamais été soumis — Rome a renoncé.$t$
    AND answer IS NOT DISTINCT FROM $t$Le mur d'Antonin$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {390 av. J.-C.}, des guerriers gaulois entrent dans Rome elle-même. Le chef qui mène le sac exige une rançon en or — et quand les Romains protestent contre les poids truqués, il jette son épée dans la balance.$t$,
    explanation = $t$Brennus et ses Sénons ont pris Rome en {390 av. J.-C.} (date traditionnelle). Seul le Capitole a résisté, sauvé — selon la légende — par les oies sacrées de Junon. Le traumatisme du « dies Alliensis » a hanté Rome pendant des siècles et motivé la future conquête de la Gaule.$t$
  WHERE id = 29
    AND lore_text IS NOT DISTINCT FROM $t$En 390 av. J.-C., des guerriers gaulois entrent dans Rome elle-même. Le chef qui mène le sac exige une rançon en or — et quand les Romains protestent contre les poids truqués, il jette son épée dans la balance.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef gaulois, lors du sac de Rome, aurait lancé « Vae victis ! » (Malheur aux vaincus !) ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Brennus et ses Sénons ont pris Rome en 390 av. J.-C. (date traditionnelle). Seul le Capitole a résisté, sauvé — selon la légende — par les oies sacrées de Junon. Le traumatisme du « dies Alliensis » a hanté Rome pendant des siècles et motivé la future conquête de la Gaule.$t$
    AND answer IS NOT DISTINCT FROM $t$Brennus$t$
    AND choices IS NOT DISTINCT FROM $t$["Vercingétorix","Ambiorix","Brennus","Diviciacos"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {885}, une flotte de centaines de navires remonte la Seine. Paris est assiégée pendant un an. Mais cette fois, la ville résiste — et un comte franc entre dans la légende.$t$,
    question = $t$Quel comte a défendu Paris lors du grand siège viking de {885}-{886} ?$t$,
    explanation = $t$Eudes (Odo), comte de Paris, a tenu la ville avec quelques centaines d'hommes contre peut-être 30 000 Vikings. Le roi Charles le Gros, arrivé avec une armée, a préféré payer les Vikings pour qu'ils partent — ce qui lui a coûté sa couronne. Eudes est devenu roi des Francs en {888}.$t$
  WHERE id = 30
    AND lore_text IS NOT DISTINCT FROM $t$En 885, une flotte de centaines de navires remonte la Seine. Paris est assiégée pendant un an. Mais cette fois, la ville résiste — et un comte franc entre dans la légende.$t$
    AND question IS NOT DISTINCT FROM $t$Quel comte a défendu Paris lors du grand siège viking de 885-886 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Eudes (Odo), comte de Paris, a tenu la ville avec quelques centaines d'hommes contre peut-être 30 000 Vikings. Le roi Charles le Gros, arrivé avec une armée, a préféré payer les Vikings pour qu'ils partent — ce qui lui a coûté sa couronne. Eudes est devenu roi des Francs en 888.$t$
    AND answer IS NOT DISTINCT FROM $t$Eudes de Paris$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Construit au {Ier siècle} pour alimenter Nîmes (Nemausus), le pont du Gard culmine à 49 mètres. L'aqueduc complet faisait 50 km avec une pente de seulement 24,8 cm par kilomètre. Les blocs de 6 tonnes sont assemblés sans mortier — et tiennent toujours.$t$
  WHERE id = 31
    AND lore_text IS NOT DISTINCT FROM $t$Les ingénieurs romains amenaient l'eau des montagnes jusqu'au cœur des villes, parfois sur plus de 50 km. Ils maintenaient une pente constante de quelques centimètres par kilomètre — sans GPS ni laser.$t$
    AND question IS NOT DISTINCT FROM $t$Quel aqueduc romain du sud de la France, classé au patrimoine mondial, enjambe le Gardon sur trois niveaux d'arches ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Construit au Ier siècle pour alimenter Nîmes (Nemausus), le pont du Gard culmine à 49 mètres. L'aqueduc complet faisait 50 km avec une pente de seulement 24,8 cm par kilomètre. Les blocs de 6 tonnes sont assemblés sans mortier — et tiennent toujours.$t$
    AND answer IS NOT DISTINCT FROM $t$Le pont du Gard$t$
    AND choices IS NOT DISTINCT FROM $t$["L'aqueduc de Ségovie","Le pont du Gard","L'aqueduc de Zaghouan","Les arches de Valens"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le plus ancien est le Périple de la mer Érythrée ({Ier siècle}), décrivant les routes commerciales jusqu'en Inde. Les Byzantins ont maintenu cette tradition de cartographie maritime pendant des siècles. Le mot vient du grec "periplus" — littéralement "navigation autour".$t$
  WHERE id = 32
    AND lore_text IS NOT DISTINCT FROM $t$Avant la boussole, avant les GPS, les marins byzantins naviguaient grâce à un texte secret : un guide détaillé de chaque port, courant et récif de la Méditerranée, mis à jour par les capitaines de la flotte impériale.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on les manuels de navigation antiques et byzantins décrivant les côtes et les ports ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le plus ancien est le Périple de la mer Érythrée (Ier siècle), décrivant les routes commerciales jusqu'en Inde. Les Byzantins ont maintenu cette tradition de cartographie maritime pendant des siècles. Le mot vient du grec "periplus" — littéralement "navigation autour".$t$
    AND answer IS NOT DISTINCT FROM $t$Les périples$t$
    AND choices IS NOT DISTINCT FROM $t$["Les portulans","Les périples","Les itinéraires","Les cosmographies"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Un chaudron d'argent retrouvé dans une tourbière danoise en {1891}, couvert de scènes de sacrifices, de dieux cornus et de guerriers. Œuvre celtique retrouvée en terre germanique — un mystère en soi.$t$,
    explanation = $t$Datant du {IIe siècle av. J.-C.}-{Ier siècle av. J.-C.}, ce chaudron de 9 kg d'argent montre des divinités celtiques (dont Cernunnos aux bois de cerf) et une scène d'immersion rituelle. Fabriqué probablement en Thrace avec une iconographie gauloise, il illustre les réseaux d'échange à travers l'Europe celtique.$t$
  WHERE id = 33
    AND lore_text IS NOT DISTINCT FROM $t$Un chaudron d'argent retrouvé dans une tourbière danoise en 1891, couvert de scènes de sacrifices, de dieux cornus et de guerriers. Œuvre celtique retrouvée en terre germanique — un mystère en soi.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle le célèbre chaudron d'argent celtique découvert au Danemark, orné de divinités gauloises ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Datant du IIe-Ier siècle av. J.-C., ce chaudron de 9 kg d'argent montre des divinités celtiques (dont Cernunnos aux bois de cerf) et une scène d'immersion rituelle. Fabriqué probablement en Thrace avec une iconographie gauloise, il illustre les réseaux d'échange à travers l'Europe celtique.$t$
    AND answer IS NOT DISTINCT FROM $t$Le chaudron de Gundestrup$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Une île volcanique au milieu de l'Atlantique Nord. Les Vikings y ont fondé le premier parlement d'Europe — en plein air, au pied d'une falaise, en {930}.$t$,
    question = $t$Comment s'appelle l'assemblée islandaise fondée en {930}, considérée comme le plus ancien parlement encore en activité ?$t$
  WHERE id = 34
    AND lore_text IS NOT DISTINCT FROM $t$Une île volcanique au milieu de l'Atlantique Nord. Les Vikings y ont fondé le premier parlement d'Europe — en plein air, au pied d'une falaise, en 930.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle l'assemblée islandaise fondée en 930, considérée comme le plus ancien parlement encore en activité ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Althing (Alþingi) se réunissait à Þingvellir, dans un rift tectonique spectaculaire. Les chefs (goðar) y débattaient des lois, réglaient les disputes et prononçaient les mises hors-la-loi. Pas de roi, pas de château — la démocratie nordique fonctionnait en plein vent, devant tout le peuple.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Althing$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Folketing","L'Althing","Le Storting","Le Løgting"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le solidus, introduit par Constantin en {309}, est resté à 4,5 g d'or pur pendant 700 ans — une stabilité monétaire unique dans l'histoire. En Occident, on l'appelait « bezant » (de Byzance). Il était accepté de la Scandinavie à Ceylan et a inspiré le dinar arabe.$t$
  WHERE id = 36
    AND lore_text IS NOT DISTINCT FROM $t$La monnaie byzantine a été la référence internationale pendant 700 ans. Stable, fiable, acceptée de l'Irlande à la Chine — le dollar de l'Antiquité tardive et du Moyen Âge.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle la pièce d'or byzantine qui a servi de monnaie de référence internationale pendant des siècles ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le solidus, introduit par Constantin en 309, est resté à 4,5 g d'or pur pendant 700 ans — une stabilité monétaire unique dans l'histoire. En Occident, on l'appelait « bezant » (de Byzance). Il était accepté de la Scandinavie à Ceylan et a inspiré le dinar arabe.$t$
    AND answer IS NOT DISTINCT FROM $t$Le solidus (bezant)$t$
    AND choices IS NOT DISTINCT FROM $t$["Le denier","Le solidus (bezant)","Le ducat","Le florin"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {1953}, au pied du mont Lassois en Bourgogne, des archéologues ouvrent la tombe d'une femme celtique du {VIe siècle av. J.-C.} À ses côtés : le plus grand vase en bronze jamais retrouvé du monde antique.$t$
  WHERE id = 37
    AND lore_text IS NOT DISTINCT FROM $t$En 1953, au pied du mont Lassois en Bourgogne, des archéologues ouvrent la tombe d'une femme celtique du VIe siècle av. J.-C. À ses côtés : le plus grand vase en bronze jamais retrouvé du monde antique.$t$
    AND question IS NOT DISTINCT FROM $t$Dans quelle ville bourguignonne a-t-on découvert la tombe princière celtique contenant un immense cratère grec en bronze ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le cratère de Vix mesure 1,64 m de haut et pèse 208 kg — un chef-d'œuvre grec probablement offert en cadeau diplomatique. La défunte, surnommée « la Dame de Vix », portait un torque en or de 480 g. Cette découverte prouve les liens commerciaux directs entre l'élite celtique et la Méditerranée.$t$
    AND answer IS NOT DISTINCT FROM $t$Vix$t$
    AND choices IS NOT DISTINCT FROM $t$["Bibracte","Alésia","Vix","Gergovie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {911}, le roi de France cède un territoire à un chef viking pour qu'il arrête de piller. Le marché fonctionne — les anciens pillards deviennent les seigneurs les plus redoutables de l'Europe médiévale.$t$,
    question = $t$Quel chef viking a reçu la Normandie du roi Charles le Simple par le traité de Saint-Clair-sur-Epte en {911} ?$t$,
    explanation = $t$Rollon (Hrólfr) a reçu le comté de Rouen en échange de sa conversion et de la défense du territoire contre les autres Vikings. En 150 ans, ses descendants normands ont conquis l'Angleterre ({1066}), la Sicile, et fondé des États croisés — un retour sur investissement spectaculaire pour Charles le Simple.$t$
  WHERE id = 38
    AND lore_text IS NOT DISTINCT FROM $t$En 911, le roi de France cède un territoire à un chef viking pour qu'il arrête de piller. Le marché fonctionne — les anciens pillards deviennent les seigneurs les plus redoutables de l'Europe médiévale.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef viking a reçu la Normandie du roi Charles le Simple par le traité de Saint-Clair-sur-Epte en 911 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Rollon (Hrólfr) a reçu le comté de Rouen en échange de sa conversion et de la défense du territoire contre les autres Vikings. En 150 ans, ses descendants normands ont conquis l'Angleterre (1066), la Sicile, et fondé des États croisés — un retour sur investissement spectaculaire pour Charles le Simple.$t$
    AND answer IS NOT DISTINCT FROM $t$Rollon$t$
    AND choices IS NOT DISTINCT FROM $t$["Ragnar Lothbrok","Ivar le Désossé","Rollon","Harald à la Belle Chevelure"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'ambre de la Baltique a été retrouvé dans des tombes mycéniennes (Grèce, {1500 av. J.-C.}) et des sépultures égyptiennes. La « route de l'ambre » reliait la mer du Nord à l'Adriatique. Les Romains l'appelaient "succinum" (suc de pierre) et Néron en faisait décorer ses arènes.$t$
  WHERE id = 40
    AND lore_text IS NOT DISTINCT FROM $t$Sur les routes de l'ambre, de la soie et de l'étain, Celtes, Romains, Vikings et Byzantins se croisaient plus souvent qu'on ne le croit. Le commerce ignorait les frontières que les historiens traceraient plus tard.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle matière, résine fossile venue de la Baltique, était commercée à travers toute l'Europe et la Méditerranée depuis le Néolithique ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'ambre de la Baltique a été retrouvé dans des tombes mycéniennes (Grèce, 1500 av. J.-C.) et des sépultures égyptiennes. La « route de l'ambre » reliait la mer du Nord à l'Adriatique. Les Romains l'appelaient "succinum" (suc de pierre) et Néron en faisait décorer ses arènes.$t$
    AND answer IS NOT DISTINCT FROM $t$L'ambre$t$
    AND choices IS NOT DISTINCT FROM $t$["Le jade","L'ambre","Le corail","Le jais"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$César mentionne que les druides maîtrisaient un comput du temps d'une grande complexité. En {1897}, dans l'Ain, des fragments de bronze gravés refirent surface : un calendrier luni-solaire de cinq ans, le plus élaboré qu'ait laissé le monde celtique — une astronomie savante là où Rome ne voyait que des barbares.$t$,
    question = $t$Comment s'appelle le calendrier gaulois en bronze découvert en {1897}, le plus complet vestige de l'astronomie celtique ?$t$
  WHERE id = 41
    AND lore_text IS NOT DISTINCT FROM $t$César mentionne que les druides maîtrisaient un comput du temps d'une grande complexité. En 1897, dans l'Ain, des fragments de bronze gravés refirent surface : un calendrier luni-solaire de cinq ans, le plus élaboré qu'ait laissé le monde celtique — une astronomie savante là où Rome ne voyait que des barbares.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle le calendrier gaulois en bronze découvert en 1897, le plus complet vestige de l'astronomie celtique ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gravé en gaulois sur des plaques de bronze, ce calendrier couvre 5 ans (62 mois lunaires + 2 mois intercalaires). Il note les jours « MAT » (favorables) et « ANM » (défavorables). Sa sophistication prouve que les druides étaient des astronomes rigoureux, pas des sorciers de village.$t$
    AND answer IS NOT DISTINCT FROM $t$Le calendrier de Coligny$t$
    AND choices IS NOT DISTINCT FROM $t$["Le calendrier de Bibracte","Le calendrier de Coligny","Le calendrier de Hallstatt","Le calendrier de Gournay"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Comment appelle-t-on ces monuments de pierre que les Vikings de Suède dressaient et gravaient en mémoire de leurs morts ({Xe siècle}-{XIe siècle}) ?$t$,
    explanation = $t$La Suède compte plus de 2 500 pierres runiques, la plupart du {XIe siècle}. Les « pierres du Serkland » mentionnent des Vikings morts dans le monde musulman. Les pierres d'Ingvar commémorent une expédition désastreuse vers la Caspienne en {1036} — aucun des participants n'est rentré.$t$
  WHERE id = 42
    AND lore_text IS NOT DISTINCT FROM $t$En Suède se dressent des milliers de monuments de granit, gravés d'entrelacs et de récits. L'un d'eux honore un guerrier parti « très loin à l'est, en Serkland » — la terre des Sarrasins, à des milliers de lieues des fjords.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on ces monuments de pierre que les Vikings de Suède dressaient et gravaient en mémoire de leurs morts (Xe-XIe siècle) ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Suède compte plus de 2 500 pierres runiques, la plupart du XIe siècle. Les « pierres du Serkland » mentionnent des Vikings morts dans le monde musulman. Les pierres d'Ingvar commémorent une expédition désastreuse vers la Caspienne en 1036 — aucun des participants n'est rentré.$t$
    AND answer IS NOT DISTINCT FROM $t$Les pierres runiques$t$
    AND choices IS NOT DISTINCT FROM $t$["Les menhirs","Les pierres runiques","Les bautasteinar","Les dolmens"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel patriarche du {IXe siècle} a compilé le « Myriobiblon », résumé de 279 ouvrages antiques dont beaucoup sont aujourd'hui perdus ?$t$,
    explanation = $t$Le Myriobiblon (ou Bibliotheca) de Photios résume des œuvres d'historiens, médecins, romanciers et théologiens grecs — nombre de ces textes n'existent plus que grâce à ses résumés. Photios, l'un des esprits les plus brillants de Byzance, a aussi provoqué le schisme avec Rome en {863}.$t$
  WHERE id = 43
    AND lore_text IS NOT DISTINCT FROM $t$Avant que les Croisés ne la mettent à sac, Constantinople abritait la plus grande bibliothèque du monde chrétien. Des textes grecs antiques y ont survécu un millénaire — puis ont disparu.$t$
    AND question IS NOT DISTINCT FROM $t$Quel patriarche du IXe siècle a compilé le « Myriobiblon », résumé de 279 ouvrages antiques dont beaucoup sont aujourd'hui perdus ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Myriobiblon (ou Bibliotheca) de Photios résume des œuvres d'historiens, médecins, romanciers et théologiens grecs — nombre de ces textes n'existent plus que grâce à ses résumés. Photios, l'un des esprits les plus brillants de Byzance, a aussi provoqué le schisme avec Rome en 863.$t$
    AND answer IS NOT DISTINCT FROM $t$Photios Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Jean Chrysostome","Photios Ier","Basile de Césarée","Michel Psellos"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$C'est le consul Marius ({107 av. J.-C.}) qui a réformé l'armée en imposant que chaque soldat porte son propre équipement au lieu de dépendre d'un train de bagages. Les légionnaires portaient armes, outils, rations et piquets — environ 30 kg — sur des marches de 30 km par jour.$t$
  WHERE id = 44
    AND lore_text IS NOT DISTINCT FROM $t$L'armée romaine ne se contentait pas de combattre. Chaque légionnaire portait 30 kg de matériel et creusait des tranchées chaque soir. Leur surnom en dit long sur leur quotidien.$t$
    AND question IS NOT DISTINCT FROM $t$Quel surnom les légionnaires romains se donnaient-ils eux-mêmes, en référence au poids de leur équipement de marche ?$t$
    AND explanation IS NOT DISTINCT FROM $t$C'est le consul Marius (107 av. J.-C.) qui a réformé l'armée en imposant que chaque soldat porte son propre équipement au lieu de dépendre d'un train de bagages. Les légionnaires portaient armes, outils, rations et piquets — environ 30 kg — sur des marches de 30 km par jour.$t$
    AND answer IS NOT DISTINCT FROM $t$Les mules de Marius$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Aigles","Les mules de Marius","Les fils de Mars","Les loups de Rome"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le spath d'Islande (cristal de calcite transparent) possède une propriété de biréfringence : il dédouble les images et, tourné face au ciel, permet de localiser la position du soleil même par temps couvert. Une étude de {2018} (Royal Society) a montré que cette méthode fonctionne avec une précision de 4°.$t$
  WHERE id = 46
    AND lore_text IS NOT DISTINCT FROM $t$Des archéologues ont retrouvé des cristaux translucides dans des épaves vikings. Certains pensent que ces « pierres de soleil » permettaient de naviguer même par temps couvert, en localisant le soleil à travers les nuages.$t$
    AND question IS NOT DISTINCT FROM $t$Quel type de cristal est aujourd'hui considéré comme la probable « pierre de soleil » des navigateurs vikings ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le spath d'Islande (cristal de calcite transparent) possède une propriété de biréfringence : il dédouble les images et, tourné face au ciel, permet de localiser la position du soleil même par temps couvert. Une étude de 2018 (Royal Society) a montré que cette méthode fonctionne avec une précision de 4°.$t$
    AND answer IS NOT DISTINCT FROM $t$Le spath d'Islande (calcite)$t$
    AND choices IS NOT DISTINCT FROM $t$["Le quartz rose","Le spath d'Islande (calcite)","La tourmaline","Le feldspath"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Un empereur juriste a ordonné la compilation de tout le droit romain en un seul corpus. Ce travail titanesque, achevé en {534}, est devenu le fondement du droit civil dans la moitié de l'Europe.$t$,
    explanation = $t$Compilé en 4 ans par le juriste Tribonien, le Corpus comprend le Code (lois impériales), le Digeste (jurisprudence), les Institutes (manuel) et les Novelles (nouvelles lois). Redécouvert au {XIe siècle} à Bologne, il a fondé la tradition juridique de l'Europe continentale — du Code Napoléon au BGB allemand.$t$
  WHERE id = 47
    AND lore_text IS NOT DISTINCT FROM $t$Un empereur juriste a ordonné la compilation de tout le droit romain en un seul corpus. Ce travail titanesque, achevé en 534, est devenu le fondement du droit civil dans la moitié de l'Europe.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle la grande compilation du droit romain ordonnée par Justinien, base du droit civil européen ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Compilé en 4 ans par le juriste Tribonien, le Corpus comprend le Code (lois impériales), le Digeste (jurisprudence), les Institutes (manuel) et les Novelles (nouvelles lois). Redécouvert au XIe siècle à Bologne, il a fondé la tradition juridique de l'Europe continentale — du Code Napoléon au BGB allemand.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Corpus Juris Civilis$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Douze Tables","Le Corpus Juris Civilis","Le Code Théodosien","Les Pandectes de Tribonien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel corps de fonctionnaires romains, créé au {IVe siècle}, servait à la fois de messagers, d'inspecteurs et d'agents de renseignement ?$t$
  WHERE id = 48
    AND lore_text IS NOT DISTINCT FROM $t$Sous l'Empire, un réseau d'informateurs quadrillait les provinces dans le plus grand secret. Officiellement, ils acheminaient les dépêches impériales ; en réalité, ils étaient les yeux et les oreilles du prince — et nul ne savait jamais à qui il avait vraiment affaire.$t$
    AND question IS NOT DISTINCT FROM $t$Quel corps de fonctionnaires romains, créé au IVe siècle, servait à la fois de messagers, d'inspecteurs et d'agents de renseignement ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les agentes in rebus (« ceux qui agissent dans les affaires ») ont remplacé les frumentarii, jugés trop corrompus. Officiellement inspecteurs du cursus publicum, ils surveillaient surtout les gouverneurs de province et rapportaient directement à l'empereur. Ammien Marcellin les décrit comme omniprésents et redoutés.$t$
    AND answer IS NOT DISTINCT FROM $t$Les agentes in rebus$t$
    AND choices IS NOT DISTINCT FROM $t$["Les frumentarii","Les agentes in rebus","Les speculatores","Les bénéficiaires"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel texte romain gravé sur des tables de bronze, vers {450 av. J.-C.}, est considéré comme le premier code de lois écrit de Rome ?$t$,
    explanation = $t$Gravées en {451 av. J.-C.}-{449 av. J.-C.} sous la pression des plébéiens, les Douze Tables fixent pour la première fois le droit par écrit, limitant l'arbitraire des patriciens. Cicéron rapporte que les écoliers les apprenaient encore par cœur 400 ans plus tard. Les tables originales ont été détruites lors du sac gaulois de {390 av. J.-C.}$t$
  WHERE id = 49
    AND lore_text IS NOT DISTINCT FROM $t$Quatre civilisations, quatre systèmes juridiques — mais un concept traverse le temps : l'idée qu'il existe des lois supérieures au pouvoir du roi. Des lois sacrées celtes aux tables romaines, chaque peuple a cherché à limiter l'arbitraire.$t$
    AND question IS NOT DISTINCT FROM $t$Quel texte romain gravé sur des tables de bronze, vers 450 av. J.-C., est considéré comme le premier code de lois écrit de Rome ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gravées en 451-449 av. J.-C. sous la pression des plébéiens, les Douze Tables fixent pour la première fois le droit par écrit, limitant l'arbitraire des patriciens. Cicéron rapporte que les écoliers les apprenaient encore par cœur 400 ans plus tard. Les tables originales ont été détruites lors du sac gaulois de 390 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$La Loi des Douze Tables$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Corpus Juris Civilis","La Loi des Douze Tables","L'Édit du Préteur","Le Code Théodosien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {52 av. J.-C.}, un jeune chef arverne rassembla les tribus gauloises pour un dernier combat...$t$
  WHERE id = 54
    AND lore_text IS NOT DISTINCT FROM $t$En 52 avant J.-C., un jeune chef arverne rassembla les tribus gauloises pour un dernier combat...$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef gaulois a mené la résistance contre Jules César à Alésia ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Vercingétorix, chef des Arvernes, unifia les tribus gauloises contre Rome. Sa reddition à Alésia marqua la fin de l'indépendance gauloise.$t$
    AND answer IS NOT DISTINCT FROM $t$Vercingétorix$t$
    AND choices IS NOT DISTINCT FROM $t$["Vercingétorix","Brennus","Ambiorix","Clovis"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Inauguré en {80 ap. J.-C.}, il pouvait accueillir plus de 50 000 spectateurs...$t$
  WHERE id = 59
    AND lore_text IS NOT DISTINCT FROM $t$Inauguré en 80 après J.-C., il pouvait accueillir plus de 50 000 spectateurs...$t$
    AND question IS NOT DISTINCT FROM $t$Quel célèbre amphithéâtre de Rome accueillait les combats de gladiateurs ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Colisée (amphithéâtre Flavien) est le plus grand amphithéâtre jamais construit. Les jeux pouvaient durer des semaines entières.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Colisée$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Colisée","Le Panthéon","Le Circus Maximus","Les Thermes de Caracalla"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Jules César conquit la Gaule entre {58 av. J.-C.} et {50 av. J.-C.} En franchissant le Rubicon en {49 av. J.-C.}, il déclencha la guerre civile qui fit de lui le maître de Rome.$t$
  WHERE id = 60
    AND lore_text IS NOT DISTINCT FROM $t$Ses légions ont soumis la Gaule en huit ans de campagne. Puis il marcha sur Rome elle-même...$t$
    AND question IS NOT DISTINCT FROM $t$Quel général romain a conquis la Gaule et franchi le Rubicon ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Jules César conquit la Gaule entre 58 et 50 av. J.-C. En franchissant le Rubicon en 49 av. J.-C., il déclencha la guerre civile qui fit de lui le maître de Rome.$t$
    AND answer IS NOT DISTINCT FROM $t$Jules César$t$
    AND choices IS NOT DISTINCT FROM $t$["Jules César","Auguste","Néron","Marc Aurèle"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel volcan a enseveli la ville de Pompéi en {79 ap. J.-C.} ?$t$,
    explanation = $t$L'éruption du Vésuve le 24 octobre {79} ensevelit Pompéi et Herculanum. Les fouilles, commencées au {XVIIIe siècle}, ont révélé une ville figée dans le temps.$t$
  WHERE id = 62
    AND lore_text IS NOT DISTINCT FROM $t$En un seul jour, une cité romaine prospère fut engloutie sous les cendres...$t$
    AND question IS NOT DISTINCT FROM $t$Quel volcan a enseveli la ville de Pompéi en 79 après J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'éruption du Vésuve le 24 octobre 79 ensevelit Pompéi et Herculanum. Les fouilles, commencées au XVIIIe siècle, ont révélé une ville figée dans le temps.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Vésuve$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Vésuve","L'Etna","Le Stromboli","L'Olympe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en {330}. Capitale de l'Empire byzantin pendant plus de 1000 ans, elle tomba aux mains des Ottomans en {1453}.$t$
  WHERE id = 63
    AND lore_text IS NOT DISTINCT FROM $t$Fondée par un empereur romain, elle fut le carrefour entre l'Europe et l'Asie pendant mille ans...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ville était la capitale de l'Empire byzantin ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en 330. Capitale de l'Empire byzantin pendant plus de 1000 ans, elle tomba aux mains des Ottomans en 1453.$t$
    AND answer IS NOT DISTINCT FROM $t$Constantinople$t$
    AND choices IS NOT DISTINCT FROM $t$["Constantinople","Athènes","Alexandrie","Jérusalem"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Sainte-Sophie (Hagia Sophia), construite en {537} sous Justinien, resta la plus grande cathédrale du monde pendant près de mille ans.$t$
  WHERE id = 64
    AND lore_text IS NOT DISTINCT FROM $t$Chef-d'œuvre d'architecture, sa coupole semblait flotter dans les airs...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle célèbre basilique de Constantinople est devenue mosquée puis musée ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Sainte-Sophie (Hagia Sophia), construite en 537 sous Justinien, resta la plus grande cathédrale du monde pendant près de mille ans.$t$
    AND answer IS NOT DISTINCT FROM $t$Sainte-Sophie$t$
    AND choices IS NOT DISTINCT FROM $t$["Sainte-Sophie","Saint-Pierre","Notre-Dame","Saint-Marc"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Constantin Ier ({272}-{337}) fonda Constantinople en {330} sur le site de l'ancienne Byzance. Il fut le premier empereur à se convertir au christianisme.$t$
  WHERE id = 65
    AND lore_text IS NOT DISTINCT FROM $t$Premier empereur chrétien, il déplaça la capitale de l'Empire vers l'Orient...$t$
    AND question IS NOT DISTINCT FROM $t$Quel empereur romain a fondé Constantinople ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Constantin Ier (272-337) fonda Constantinople en 330 sur le site de l'ancienne Byzance. Il fut le premier empereur à se convertir au christianisme.$t$
    AND answer IS NOT DISTINCT FROM $t$Constantin Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Constantin Ier","Justinien","Théodose","Dioclétien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les icônes sont des peintures religieuses sur panneaux de bois, caractéristiques de l'art byzantin et orthodoxe. La crise iconoclaste ({726}-{843}) divisa l'Empire sur leur vénération.$t$
  WHERE id = 66
    AND lore_text IS NOT DISTINCT FROM $t$Dans les églises d'Orient, ces images dorées étaient vénérées comme des fenêtres vers le divin...$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on les images sacrées peintes sur bois, typiques de l'art byzantin ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les icônes sont des peintures religieuses sur panneaux de bois, caractéristiques de l'art byzantin et orthodoxe. La crise iconoclaste (726-843) divisa l'Empire sur leur vénération.$t$
    AND answer IS NOT DISTINCT FROM $t$Les icônes$t$
    AND choices IS NOT DISTINCT FROM $t$["Les icônes","Les fresques","Les vitraux","Les mosaïques"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Comment s'appelait la grande défaite gauloise face à Jules César en {52 av. J.-C.} ?$t$
  WHERE id = 68
    AND lore_text IS NOT DISTINCT FROM $t$Sur ce plateau de Bourgogne, la résistance gauloise s'éteignit après un siège de plusieurs semaines...$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait la grande défaite gauloise face à Jules César en 52 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille d'Alésia marqua la fin de la résistance gauloise. César construisit deux lignes de fortifications en cercle pour piéger les assiégés et repousser les renforts. Vercingétorix capitula après plusieurs semaines.$t$
    AND answer IS NOT DISTINCT FROM $t$La bataille d'Alésia$t$
    AND choices IS NOT DISTINCT FROM $t$["La bataille d'Alésia","La bataille de Gergovie","La bataille de Magetobriga","La bataille du Teutoburg"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les Gaulois frappaient leurs propres monnaies depuis le {IIIe siècle av. J.-C.}, d'abord inspirées des statères grecs. Chaque peuple gaulois (Parisii, Éduens, Arvernes...) avait ses propres monnaies reconnaissables à leurs motifs stylisés.$t$
  WHERE id = 69
    AND lore_text IS NOT DISTINCT FROM $t$Bien avant les deniers romains, les marchands gaulois échangeaient des pièces frappées à leur propre effigie...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle était la monnaie principale des Gaulois ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Gaulois frappaient leurs propres monnaies depuis le IIIe siècle av. J.-C., d'abord inspirées des statères grecs. Chaque peuple gaulois (Parisii, Éduens, Arvernes...) avait ses propres monnaies reconnaissables à leurs motifs stylisés.$t$
    AND answer IS NOT DISTINCT FROM $t$Des pièces d'or et d'argent$t$
    AND choices IS NOT DISTINCT FROM $t$["Des pièces d'or et d'argent","Du sel","Des lingots de bronze","Des peaux d'animaux"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel peuple celtique a brûlé Rome vers {390 av. J.-C.} ?$t$,
    explanation = $t$Les Sénons, sous la conduite de Brennus, déferlèrent sur Rome en {390 av. J.-C.} Leur chef aurait déclaré "Vae victis !" (malheur aux vaincus) en jetant son épée dans la balance lors du pesage de la rançon.$t$
  WHERE id = 70
    AND lore_text IS NOT DISTINCT FROM $t$Ils franchirent les Alpes, battirent les Romains à l'Allia et poussèrent jusqu'au Capitole...$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple celtique a brûlé Rome vers 390 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Sénons, sous la conduite de Brennus, déferlèrent sur Rome en 390 av. J.-C. Leur chef aurait déclaré "Vae victis !" (malheur aux vaincus) en jetant son épée dans la balance lors du pesage de la rançon.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Sénons$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Sénons","Les Boïens","Les Helvètes","Les Galates"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$César les força à rebrousser chemin lors de leur grande migration vers l'ouest en {58 av. J.-C.}..$t$,
    explanation = $t$La migration des Helvètes en {58 av. J.-C.} fut le prétexte de l'intervention de César en Gaule. Ce peuple celte tentait de rejoindre les territoires atlantiques, mais César les battit à la bataille de Bibracte et les renvoya dans leur pays d'origine.$t$
  WHERE id = 74
    AND lore_text IS NOT DISTINCT FROM $t$César les força à rebrousser chemin lors de leur grande migration vers l'ouest en 58 av. J.-C...$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple celtique habitait la région qui deviendra la Suisse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La migration des Helvètes en 58 av. J.-C. fut le prétexte de l'intervention de César en Gaule. Ce peuple celte tentait de rejoindre les territoires atlantiques, mais César les battit à la bataille de Bibracte et les renvoya dans leur pays d'origine.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Helvètes$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Helvètes","Les Boïens","Les Allobroges","Les Séquanes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle reine brittonique a mené une révolte contre l'occupation romaine en {60 ap. J.-C.}-{61 ap. J.-C.} ?$t$
  WHERE id = 77
    AND lore_text IS NOT DISTINCT FROM $t$Cheveux roux au vent, elle conduisit ses chars de guerre contre les légions de Néron...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle reine brittonique a mené une révolte contre l'occupation romaine en 60-61 ap. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Boudicca, reine des Icènes, mena une rébellion dévastatrice contre Rome : Camulodunum (Colchester), Londinium et Verulamium furent incendiées. Son armée est estimée à 100 000 hommes avant d'être finalement écrasée par le gouverneur Suetonius Paulinus.$t$
    AND answer IS NOT DISTINCT FROM $t$Boudicca$t$
    AND choices IS NOT DISTINCT FROM $t$["Boudicca","La Morrigane","Cartimandua","Medb"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le chaudron de Gundestrup, découvert en {1891} dans une tourbière danoise, est fait de plaques d'argent presque pur. Il date du {Ier siècle av. J.-C.} et représente des divinités, des guerriers, des animaux sacrés et une scène de régénération dans un chaudron — peut-être le Chaudron de Dagda.$t$
  WHERE id = 80
    AND lore_text IS NOT DISTINCT FROM $t$Retrouvé dans un marais danois, ce récipient couvert de scènes mythologiques est l'un des plus beaux objets celtes jamais découverts...$t$
    AND question IS NOT DISTINCT FROM $t$De quel matériau était fabriqué le chaudron de Gundestrup, chef-d'œuvre de l'art celtique ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le chaudron de Gundestrup, découvert en 1891 dans une tourbière danoise, est fait de plaques d'argent presque pur. Il date du Ier siècle av. J.-C. et représente des divinités, des guerriers, des animaux sacrés et une scène de régénération dans un chaudron — peut-être le Chaudron de Dagda.$t$
    AND answer IS NOT DISTINCT FROM $t$L'argent$t$
    AND choices IS NOT DISTINCT FROM $t$["L'argent","L'or","Le bronze","Le fer"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel continent les Vikings ont-ils découvert vers l'an {1000}, bien avant Christophe Colomb ?$t$,
    explanation = $t$Leif Erikson atteignit l'Amérique du Nord vers l'an {1000}, qu'il appela Vinland. Le site de L'Anse aux Meadows, découvert en {1960} à Terre-Neuve (Canada), est la seule colonie viking confirmée en Amérique. Colomb n'arrivera que 500 ans plus tard.$t$
  WHERE id = 87
    AND lore_text IS NOT DISTINCT FROM $t$Leif Erikson y aborda et appela ce pays "Vinland" à cause des vignes sauvages qu'il y trouva...$t$
    AND question IS NOT DISTINCT FROM $t$Quel continent les Vikings ont-ils découvert vers l'an 1000, bien avant Christophe Colomb ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Leif Erikson atteignit l'Amérique du Nord vers l'an 1000, qu'il appela Vinland. Le site de L'Anse aux Meadows, découvert en 1960 à Terre-Neuve (Canada), est la seule colonie viking confirmée en Amérique. Colomb n'arrivera que 500 ans plus tard.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Amérique du Nord$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Amérique du Nord","L'Afrique","L'Australie","L'Asie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Son nom vient du pays des "Hommes du Nord" — Nortmanni — qui s'y installèrent au {Xe siècle}...$t$,
    explanation = $t$La Normandie tire son nom des Normands (Nortmanni, "hommes du Nord"). En {911}, le chef viking Rollon reçut cette région du roi franc Charles le Simple par le traité de Saint-Clair-sur-Epte. Les descendants de ces Vikings deviendront les ducs de Normandie, dont Guillaume le Conquérant.$t$
  WHERE id = 91
    AND lore_text IS NOT DISTINCT FROM $t$Son nom vient du pays des "Hommes du Nord" — Nortmanni — qui s'y installèrent au Xe siècle...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ville française a été fondée par les Vikings et porte encore leur nom dans son origine ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Normandie tire son nom des Normands (Nortmanni, "hommes du Nord"). En 911, le chef viking Rollon reçut cette région du roi franc Charles le Simple par le traité de Saint-Clair-sur-Epte. Les descendants de ces Vikings deviendront les ducs de Normandie, dont Guillaume le Conquérant.$t$
    AND answer IS NOT DISTINCT FROM $t$Rouen (Normandie)$t$
    AND choices IS NOT DISTINCT FROM $t$["Rouen (Normandie)","Nantes","Bordeaux","Lyon"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel peuple nordique a colonisé l'Islande à partir du {IXe siècle} ?$t$,
    explanation = $t$L'Islande fut colonisée principalement par des Norvégiens à partir de {874 ap. J.-C.}, date de l'arrivée d'Ingólfr Arnarson à Reykjavik. Cette colonisation est exceptionnellement bien documentée dans le Landnámabók (Livre des Établissements), qui liste plus de 400 colons et 3 000 personnes.$t$
  WHERE id = 92
    AND lore_text IS NOT DISTINCT FROM $t$Fuyant le pouvoir centralisateur du roi Harald à la Belle Chevelure, des familles entières prirent la mer vers l'ouest...$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple nordique a colonisé l'Islande à partir du IXe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Islande fut colonisée principalement par des Norvégiens à partir de 874 ap. J.-C., date de l'arrivée d'Ingólfr Arnarson à Reykjavik. Cette colonisation est exceptionnellement bien documentée dans le Landnámabók (Livre des Établissements), qui liste plus de 400 colons et 3 000 personnes.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Norvégiens$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Norvégiens","Les Danois","Les Suédois","Les Frisons"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel célèbre chef normand conquit l'Angleterre en {1066} ?$t$,
    explanation = $t$Guillaume le Conquérant, duc de Normandie et descendant des Vikings, vainquit le roi Harold II à la bataille de Hastings le 14 octobre {1066}. Sa conquête de l'Angleterre introduisit le français normand comme langue de la cour, modifiant durablement la langue anglaise.$t$
  WHERE id = 95
    AND lore_text IS NOT DISTINCT FROM $t$Sa victoire à Hastings changea à jamais la langue et la culture anglaise, y introduisant des milliers de mots français...$t$
    AND question IS NOT DISTINCT FROM $t$Quel célèbre chef normand conquit l'Angleterre en 1066 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Guillaume le Conquérant, duc de Normandie et descendant des Vikings, vainquit le roi Harold II à la bataille de Hastings le 14 octobre 1066. Sa conquête de l'Angleterre introduisit le français normand comme langue de la cour, modifiant durablement la langue anglaise.$t$
    AND answer IS NOT DISTINCT FROM $t$Guillaume le Conquérant$t$
    AND choices IS NOT DISTINCT FROM $t$["Guillaume le Conquérant","Rollon","Ragnar Lothbrok","Harald Hardrada"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Selon la légende, Romulus et Remus, fils du dieu Mars, furent abandonnés et allaités par une louve. Romulus fonda Rome en {753 av. J.-C.} et en devint le premier roi. Il tua son frère Remus qui avait sauté par-dessus les murs de la nouvelle cité en signe de mépris.$t$
  WHERE id = 97
    AND lore_text IS NOT DISTINCT FROM $t$Selon la tradition, des jumeaux élevés par une louve seraient à l'origine de la plus grande ville du monde antique...$t$
    AND question IS NOT DISTINCT FROM $t$Selon la légende, qui a fondé la ville de Rome ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Selon la légende, Romulus et Remus, fils du dieu Mars, furent abandonnés et allaités par une louve. Romulus fonda Rome en 753 av. J.-C. et en devint le premier roi. Il tua son frère Remus qui avait sauté par-dessus les murs de la nouvelle cité en signe de mépris.$t$
    AND answer IS NOT DISTINCT FROM $t$Romulus$t$
    AND choices IS NOT DISTINCT FROM $t$["Romulus","Remus","Énée","Numa Pompilius"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Panthéon de Rome, construit sous Hadrien vers {125 ap. J.-C.}, est l'édifice antique le mieux conservé au monde. Sa coupole de 43,3 mètres de diamètre était, jusqu'à la Renaissance, la plus grande coupole jamais construite. L'oculus central éclaire l'intérieur de lumière naturelle.$t$
  WHERE id = 100
    AND lore_text IS NOT DISTINCT FROM $t$Sa coupole en béton, percée d'un oculus ouvert sur le ciel, reste un prodige d'ingénierie après deux mille ans...$t$
    AND question IS NOT DISTINCT FROM $t$Quel bâtiment romain en forme de dôme, encore intact aujourd'hui, était dédié à tous les dieux ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Panthéon de Rome, construit sous Hadrien vers 125 ap. J.-C., est l'édifice antique le mieux conservé au monde. Sa coupole de 43,3 mètres de diamètre était, jusqu'à la Renaissance, la plus grande coupole jamais construite. L'oculus central éclaire l'intérieur de lumière naturelle.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Panthéon$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Panthéon","Le Colisée","L'Arc de Titus","Les thermes de Caracalla"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Auguste (né Octave) devint le premier empereur romain en {27 av. J.-C.} Son règne de 44 ans inaugura le Principat et le siècle d'or de la littérature latine (Virgile, Horace, Ovide). Son mois de naissance, Sextilis, fut rebaptisé Augustus en son honneur — d'où notre mois d'août.$t$
  WHERE id = 101
    AND lore_text IS NOT DISTINCT FROM $t$Neveu adoptif de César, il mit fin aux guerres civiles et instaura deux siècles de paix romaine...$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait le premier empereur de Rome ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Auguste (né Octave) devint le premier empereur romain en 27 av. J.-C. Son règne de 44 ans inaugura le Principat et le siècle d'or de la littérature latine (Virgile, Horace, Ovide). Son mois de naissance, Sextilis, fut rebaptisé Augustus en son honneur — d'où notre mois d'août.$t$
    AND answer IS NOT DISTINCT FROM $t$Auguste$t$
    AND choices IS NOT DISTINCT FROM $t$["Auguste","Jules César","Néron","Tibère"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Il gouverna l'Empire au {IIe siècle} tout en pratiquant la philosophie stoïcienne — un sage sur le trône...$t$,
    explanation = $t$Marc Aurèle ({121 ap. J.-C.}-{180 ap. J.-C.}) est souvent considéré comme le dernier des "Cinq bons empereurs". Ses "Méditations", écrites en grec pour lui-même, sont un chef-d'œuvre de la philosophie stoïcienne. Il gouverna avec sagesse tout en menant de longues guerres contre les Marcomans.$t$
  WHERE id = 103
    AND lore_text IS NOT DISTINCT FROM $t$Il gouverna l'Empire au IIe siècle tout en pratiquant la philosophie stoïcienne — un sage sur le trône...$t$
    AND question IS NOT DISTINCT FROM $t$Quel célèbre philosophe et empereur romain a écrit les "Pensées" (Méditations) ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Marc Aurèle (121-180 ap. J.-C.) est souvent considéré comme le dernier des "Cinq bons empereurs". Ses "Méditations", écrites en grec pour lui-même, sont un chef-d'œuvre de la philosophie stoïcienne. Il gouverna avec sagesse tout en menant de longues guerres contre les Marcomans.$t$
    AND answer IS NOT DISTINCT FROM $t$Marc Aurèle$t$
    AND choices IS NOT DISTINCT FROM $t$["Marc Aurèle","Cicéron","Sénèque","Hadrien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Première grande route romaine construite en {312 av. J.-C.}, elle fut pendant des siècles l'épine dorsale de l'Italie...$t$,
    explanation = $t$La Via Appia ("reine des routes") fut construite en {312 av. J.-C.} par le censeur Appius Claudius Caecus. Longue de 560 km, elle reliait Rome à Brindisi, port d'embarquement vers la Grèce et l'Orient. C'est sur ses bas-côtés que 6 000 esclaves de Spartacus furent crucifiés en {71 av. J.-C.}$t$
  WHERE id = 106
    AND lore_text IS NOT DISTINCT FROM $t$Première grande route romaine construite en 312 av. J.-C., elle fut pendant des siècles l'épine dorsale de l'Italie...$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait la grande route militaire qui reliait Rome à Brindisi, dans le talon de l'Italie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Via Appia ("reine des routes") fut construite en 312 av. J.-C. par le censeur Appius Claudius Caecus. Longue de 560 km, elle reliait Rome à Brindisi, port d'embarquement vers la Grèce et l'Orient. C'est sur ses bas-côtés que 6 000 esclaves de Spartacus furent crucifiés en 71 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$La Via Appia$t$
    AND choices IS NOT DISTINCT FROM $t$["La Via Appia","La Via Aurelia","La Via Flaminia","La Via Salaria"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$"Alea jacta est" ("Le sort en est jeté") aurait été prononcé par Jules César en franchissant le Rubicon en {49 av. J.-C.} avec sa légion. En traversant cette frontière en armes, il commettait un acte de guerre contre la République romaine, déclenchant la guerre civile contre Pompée.$t$
  WHERE id = 108
    AND lore_text IS NOT DISTINCT FROM $t$Cette rivière marquait la frontière légale — la franchir en armes était une déclaration de guerre contre Rome...$t$
    AND question IS NOT DISTINCT FROM $t$Quel est le nom de la célèbre sentence prononcée par César lors de sa traversée du Rubicon ?$t$
    AND explanation IS NOT DISTINCT FROM $t$"Alea jacta est" ("Le sort en est jeté") aurait été prononcé par Jules César en franchissant le Rubicon en 49 av. J.-C. avec sa légion. En traversant cette frontière en armes, il commettait un acte de guerre contre la République romaine, déclenchant la guerre civile contre Pompée.$t$
    AND answer IS NOT DISTINCT FROM $t$Alea jacta est$t$
    AND choices IS NOT DISTINCT FROM $t$["Alea jacta est","Veni vidi vici","Tu quoque, Brute","Carpe diem"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Bien qu'héritiers de Rome, les Byzantins utilisaient le grec comme langue officielle depuis le {VIIe siècle}. Le grec était la langue de la culture, de la religion (Septante, Nouveau Testament) et de l'administration. Les empereurs portaient le titre de "Basileus" (roi en grec) plutôt que d'imperator.$t$
  WHERE id = 112
    AND lore_text IS NOT DISTINCT FROM $t$L'Empire romain d'Orient abandonna progressivement la langue de Rome pour celle de la philosophie et des Évangiles...$t$
    AND question IS NOT DISTINCT FROM $t$En quelle langue écrivaient et gouvernaient les Byzantins, malgré leur héritage romain ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Bien qu'héritiers de Rome, les Byzantins utilisaient le grec comme langue officielle depuis le VIIe siècle. Le grec était la langue de la culture, de la religion (Septante, Nouveau Testament) et de l'administration. Les empereurs portaient le titre de "Basileus" (roi en grec) plutôt que d'imperator.$t$
    AND answer IS NOT DISTINCT FROM $t$Le grec$t$
    AND choices IS NOT DISTINCT FROM $t$["Le grec","Le latin","L'araméen","L'hébreu"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel célèbre code de lois, devenu la base du droit dans toute l'Europe occidentale, fut compilé par un empereur byzantin du {VIe siècle} ?$t$,
    explanation = $t$Le Corpus Juris Civilis, compilé entre {529} et {534} sous Justinien Ier, est la plus grande réalisation juridique de l'Antiquité tardive. Il rassembla des siècles de droit romain en un ensemble cohérent. Il forma la base du droit civil dans la plupart des pays européens et latino-américains.$t$
  WHERE id = 113
    AND lore_text IS NOT DISTINCT FROM $t$Ce monument juridique, compilé en quelques années, forma la base du droit dans toute l'Europe occidentale...$t$
    AND question IS NOT DISTINCT FROM $t$Quel célèbre code de lois, devenu la base du droit dans toute l'Europe occidentale, fut compilé par un empereur byzantin du VIe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Corpus Juris Civilis, compilé entre 529 et 534 sous Justinien Ier, est la plus grande réalisation juridique de l'Antiquité tardive. Il rassembla des siècles de droit romain en un ensemble cohérent. Il forma la base du droit civil dans la plupart des pays européens et latino-américains.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Code Justinien$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Code Justinien","La Loi Salique","Les Douze Tables","Le Code d'Hammurabi"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les Huns, sous Attila, ravagèrent les Balkans byzantins dans les années 440. L'Empire paya de lourds tributs pour acheter la paix. Après la mort d'Attila en {453}, leur confédération s'effondra rapidement, mais d'autres peuples des steppes (Avars, Petchénègues, Coumans) reprirent leur rôle de menace.$t$
  WHERE id = 114
    AND lore_text IS NOT DISTINCT FROM $t$Ces cavaliers redoutables vivaient à cheval, fondant soudainement sur les territoires frontaliers avant de disparaître...$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple nomade d'Asie centrale menaçait régulièrement les frontières byzantines depuis les steppes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Huns, sous Attila, ravagèrent les Balkans byzantins dans les années 440. L'Empire paya de lourds tributs pour acheter la paix. Après la mort d'Attila en 453, leur confédération s'effondra rapidement, mais d'autres peuples des steppes (Avars, Petchénègues, Coumans) reprirent leur rôle de menace.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Huns$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Huns","Les Mongols","Les Avars","Les Petchénègues"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le feu grégeois était une arme incendiaire byzantine dont la composition exacte reste un mystère. Utilisé dès le {VIIe siècle}, il brûlait sur l'eau et adhérait aux surfaces. Il sauva Constantinople lors des sièges arabes de {674}-{678} et {717}-{718}. Sa formule exacte ne fut jamais percée.$t$
  WHERE id = 115
    AND lore_text IS NOT DISTINCT FROM $t$Projetée depuis les navires de guerre, cette substance mystérieuse continuait à brûler même quand on l'arrosait d'eau...$t$
    AND question IS NOT DISTINCT FROM $t$Quel est le nom de l'arme secrète byzantine qui pouvait brûler sur l'eau et décima les flottes arabes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le feu grégeois était une arme incendiaire byzantine dont la composition exacte reste un mystère. Utilisé dès le VIIe siècle, il brûlait sur l'eau et adhérait aux surfaces. Il sauva Constantinople lors des sièges arabes de 674-678 et 717-718. Sa formule exacte ne fut jamais percée.$t$
    AND answer IS NOT DISTINCT FROM $t$Le feu grégeois$t$
    AND choices IS NOT DISTINCT FROM $t$["Le feu grégeois","Le naphte","La poix ardente","Le soufre liquide"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les habitants de l'Empire byzantin se nommaient "Romaioi" (Romains) et leur empire "Basileia Rhomaion" (Empire des Romains). Le terme "byzantin" fut inventé par des historiens occidentaux au {XVIe siècle}, tiré de l'ancien nom de Constantinople, Byzance. Ils auraient rejeté ce nom.$t$
  WHERE id = 116
    AND lore_text IS NOT DISTINCT FROM $t$Pour eux, ils n'étaient pas "byzantins" — ce terme est une invention d'historiens modernes. Ils se voyaient comme les héritiers directs d'une gloire millénaire...$t$
    AND question IS NOT DISTINCT FROM $t$Sous quel nom l'empire byzantin se désignait-il lui-même ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les habitants de l'Empire byzantin se nommaient "Romaioi" (Romains) et leur empire "Basileia Rhomaion" (Empire des Romains). Le terme "byzantin" fut inventé par des historiens occidentaux au XVIe siècle, tiré de l'ancien nom de Constantinople, Byzance. Ils auraient rejeté ce nom.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Empire romain$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Empire romain","L'Empire grec","L'Empire chrétien","L'Empire d'Orient"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle rupture religieuse de {1054} divisa définitivement le christianisme entre Rome et Constantinople ?$t$,
    explanation = $t$Le Schisme de {1054} divisa le christianisme en Église catholique romaine (pape de Rome) et Église orthodoxe (patriarche de Constantinople). Les divergences portaient sur la primauté du pape, le célibat des prêtres et la procession du Saint-Esprit (la querelle du Filioque). Cette division n'a jamais été réparée.$t$
  WHERE id = 117
    AND lore_text IS NOT DISTINCT FROM $t$L'Église de Rome et l'Église de Constantinople s'excommunièrent mutuellement, créant une fracture qui dure encore...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle rupture religieuse de 1054 divisa définitivement le christianisme entre Rome et Constantinople ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Schisme de 1054 divisa le christianisme en Église catholique romaine (pape de Rome) et Église orthodoxe (patriarche de Constantinople). Les divergences portaient sur la primauté du pape, le célibat des prêtres et la procession du Saint-Esprit (la querelle du Filioque). Cette division n'a jamais été réparée.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Grand Schisme d'Orient$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Grand Schisme d'Orient","La Réforme protestante","Le schisme d'Avignon","La querelle des investitures"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Bélisaire ({505}-{565}) est considéré comme le plus grand général de l'Antiquité tardive. Il reconquit l'Afrique du Nord en {533} (en détruisant le royaume vandale en 3 mois) et l'Italie entre {535} et {540}. Malgré ses succès, il fut disgrâcié plusieurs fois par un Justinien jaloux de sa gloire.$t$
  WHERE id = 118
    AND lore_text IS NOT DISTINCT FROM $t$Avec des armées souvent inférieures en nombre, ce stratège de génie renversa le royaume vandale et écrase les Ostrogoths...$t$
    AND question IS NOT DISTINCT FROM $t$Quel grand général byzantin reconquit l'Afrique du Nord et l'Italie sous Justinien Ier ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Bélisaire (505-565) est considéré comme le plus grand général de l'Antiquité tardive. Il reconquit l'Afrique du Nord en 533 (en détruisant le royaume vandale en 3 mois) et l'Italie entre 535 et 540. Malgré ses succès, il fut disgrâcié plusieurs fois par un Justinien jaloux de sa gloire.$t$
    AND answer IS NOT DISTINCT FROM $t$Bélisaire$t$
    AND choices IS NOT DISTINCT FROM $t$["Bélisaire","Narsès","Jean Troglita","Héraclius"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel peuple slave fut évangélisé au {IXe siècle} grâce à un alphabet créé par des moines byzantins ?$t$,
    explanation = $t$Saints Cyrille et Méthode, moines byzantins, créèrent l'alphabet glagolitique vers {862} pour transcrire les langues slaves. L'alphabet cyrillique (qui porte le nom de Cyrille) en est une adaptation ultérieure. Il est encore utilisé par des centaines de millions de personnes (Russie, Serbie, Bulgarie...).$t$
  WHERE id = 120
    AND lore_text IS NOT DISTINCT FROM $t$Cyrille et Méthode inventèrent un alphabet spécialement adapté à leur langue pour leur transmettre l'Évangile...$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple slave fut évangélisé au IXe siècle grâce à un alphabet créé par des moines byzantins ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Saints Cyrille et Méthode, moines byzantins, créèrent l'alphabet glagolitique vers 862 pour transcrire les langues slaves. L'alphabet cyrillique (qui porte le nom de Cyrille) en est une adaptation ultérieure. Il est encore utilisé par des centaines de millions de personnes (Russie, Serbie, Bulgarie...).$t$
    AND answer IS NOT DISTINCT FROM $t$Les Bulgares et Moraves (slaves)$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Bulgares et Moraves (slaves)","Les Germains","Les Scandinaves","Les Hongrois"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Hippodrome de Constantinople, adjacent au Grand Palais, était le centre politique et sportif de l'Empire. Les factions des Bleus et des Verts étaient de véritables partis politiques autant que clubs sportifs. La révolte de Nika ({532}) faillit coûter son trône à Justinien — il fut sauvé par la détermination de sa femme, l'impératrice Théodora.$t$
  WHERE id = 122
    AND lore_text IS NOT DISTINCT FROM $t$Les Bleus et les Verts s'affrontaient non seulement dans l'hippodrome mais aussi dans les rues, allant jusqu'à renverser des empereurs...$t$
    AND question IS NOT DISTINCT FROM $t$Quel sport hippique divisait la population de Constantinople en factions rivales fanatiques ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Hippodrome de Constantinople, adjacent au Grand Palais, était le centre politique et sportif de l'Empire. Les factions des Bleus et des Verts étaient de véritables partis politiques autant que clubs sportifs. La révolte de Nika (532) faillit coûter son trône à Justinien — il fut sauvé par la détermination de sa femme, l'impératrice Théodora.$t$
    AND answer IS NOT DISTINCT FROM $t$Les courses de chars$t$
    AND choices IS NOT DISTINCT FROM $t$["Les courses de chars","La joute à cheval","Le polo","La chasse à courre"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle puissance islamique a finalement conquis Constantinople en {1453} ?$t$,
    explanation = $t$Mehmed II, sultan ottoman âgé de 21 ans, conquit Constantinople le 29 mai {1453} après 53 jours de siège. Les canons géants de l'ingénieur Urbain percèrent les murailles théodosiennes. Cette date est souvent citée comme marquant la fin du Moyen Âge en Europe.$t$
  WHERE id = 123
    AND lore_text IS NOT DISTINCT FROM $t$Un sultan de 21 ans, armé des plus grands canons jamais construits, mit fin à un empire millénaire...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle puissance islamique a finalement conquis Constantinople en 1453 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Mehmed II, sultan ottoman âgé de 21 ans, conquit Constantinople le 29 mai 1453 après 53 jours de siège. Les canons géants de l'ingénieur Urbain percèrent les murailles théodosiennes. Cette date est souvent citée comme marquant la fin du Moyen Âge en Europe.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Empire ottoman$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Empire ottoman","Le califat abbasside","L'Empire seldjoukide","L'Égypte mamelouke"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle impératrice byzantine du {VIe siècle}, ancienne actrice, co-gouverna avec son mari Justinien ?$t$,
    explanation = $t$Théodora ({497}-{548}) était fille d'un dompteur d'ours et actrice avant d'épouser Justinien. Impératrice, elle joua un rôle politique crucial : lors de la révolte de Nika ({532}), c'est elle qui convainquit Justinien de ne pas fuir : "La pourpre est le plus beau linceul." Elle réforma aussi les lois sur les femmes et la prostitution.$t$
  WHERE id = 124
    AND lore_text IS NOT DISTINCT FROM $t$D'origine modeste, elle devint l'une des femmes les plus puissantes de l'histoire, guidant son empire lors des crises les plus graves...$t$
    AND question IS NOT DISTINCT FROM $t$Quelle impératrice byzantine du VIe siècle, ancienne actrice, co-gouverna avec son mari Justinien ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Théodora (497-548) était fille d'un dompteur d'ours et actrice avant d'épouser Justinien. Impératrice, elle joua un rôle politique crucial : lors de la révolte de Nika (532), c'est elle qui convainquit Justinien de ne pas fuir : "La pourpre est le plus beau linceul." Elle réforma aussi les lois sur les femmes et la prostitution.$t$
    AND answer IS NOT DISTINCT FROM $t$Théodora$t$
    AND choices IS NOT DISTINCT FROM $t$["Théodora","Irène","Zoé Porphyrogénète","Eudocie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La mosaïque byzantine est considérée comme le sommet de cet art. Les tessères (petits cubes de verre coloré ou de pierre) étaient posées à des angles légèrement différents pour mieux réfléchir la lumière des bougies. Les mosaïques de Ravenne ({VIe siècle}), notamment celles de San Vitale, sont les plus célèbres exemples subsistant.$t$
  WHERE id = 125
    AND lore_text IS NOT DISTINCT FROM $t$Ces compositions scintillantes de fonds dorés représentaient les saints dans une lumière qui semblait venue d'un autre monde...$t$
    AND question IS NOT DISTINCT FROM $t$Quel art décoratif byzantin, fait de petits cubes de verre ou pierre colorés, ornait les murs des églises ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La mosaïque byzantine est considérée comme le sommet de cet art. Les tessères (petits cubes de verre coloré ou de pierre) étaient posées à des angles légèrement différents pour mieux réfléchir la lumière des bougies. Les mosaïques de Ravenne (VIe siècle), notamment celles de San Vitale, sont les plus célèbres exemples subsistant.$t$
    AND answer IS NOT DISTINCT FROM $t$La mosaïque$t$
    AND choices IS NOT DISTINCT FROM $t$["La mosaïque","La fresque","L'enluminure","L'émail cloisonné"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La Basilissa était le titre officiel de l'impératrice byzantine, équivalent féminin du Basileus. Certaines Basilissai gouvernèrent effectivement l'Empire — Irène d'Athènes ({797}-{802}) fut la première femme à régner seule à Constantinople, allant jusqu'à se proclamer "Basileus" au masculin.$t$
  WHERE id = 126
    AND lore_text IS NOT DISTINCT FROM $t$Ce mot grec signifiant "celle qui règne" confèrait à l'impératrice un statut sacré et une autorité réelle...$t$
    AND question IS NOT DISTINCT FROM $t$Quel titre portait l'épouse de l'empereur byzantin ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Basilissa était le titre officiel de l'impératrice byzantine, équivalent féminin du Basileus. Certaines Basilissai gouvernèrent effectivement l'Empire — Irène d'Athènes (797-802) fut la première femme à régner seule à Constantinople, allant jusqu'à se proclamer "Basileus" au masculin.$t$
    AND answer IS NOT DISTINCT FROM $t$Basilissa$t$
    AND choices IS NOT DISTINCT FROM $t$["Basilissa","Augusta","Déspina","Kyria"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Comment s'appelait le chef gaulois qui mena la grande révolte contre César en {52 av. J.-C.} ?$t$
  WHERE id = 128
    AND lore_text IS NOT DISTINCT FROM $t$De la forteresse d'Alésia, un cri de guerre traversa les collines — et l'histoire retint son nom pour toujours.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait le chef gaulois qui mena la grande révolte contre César en 52 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Vercingétorix, chef des Arvernes, fédéra les tribus gauloises contre Rome et remporta la bataille de Gergovie. Vaincu à Alésia, il fut emmené à Rome et exécuté six ans plus tard.$t$
    AND answer IS NOT DISTINCT FROM $t$Vercingétorix$t$
    AND choices IS NOT DISTINCT FROM $t$["Vercingétorix","Ambiorix","Viriatus","Dumnorix"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En {390 av. J.-C.} (IVe siècle), les Gaulois Sénons commandés par Brennus défont l'armée romaine à l'Allia, puis pillent Rome. La phrase attribuée à Brennus, "Vae victis !" (malheur aux vaincus !), est restée célèbre.$t$,
    answer = $t${IVe siècle av. J.-C.}$t$,
    choices = $t$["{IVe siècle av. J.-C.}","{IIe siècle av. J.-C.}","{IIIe siècle av. J.-C.}","{Ve siècle av. J.-C.}"]$t$::jsonb
  WHERE id = 130
    AND lore_text IS NOT DISTINCT FROM $t$Les oies du Capitole criaient dans la nuit — mais les soldats romains dormaient, et les Gaulois montaient en silence.$t$
    AND question IS NOT DISTINCT FROM $t$En quel siècle les Gaulois ont-ils saccagé Rome pour la première fois ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 390 av. J.-C. (IVe siècle), les Gaulois Sénons commandés par Brennus défont l'armée romaine à l'Allia, puis pillent Rome. La phrase attribuée à Brennus, "Vae victis !" (malheur aux vaincus !), est restée célèbre.$t$
    AND answer IS NOT DISTINCT FROM $t$IVe siècle av. J.-C.$t$
    AND choices IS NOT DISTINCT FROM $t$["IVe siècle av. J.-C.","IIe siècle av. J.-C.","IIIe siècle av. J.-C.","Ve siècle av. J.-C."]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le siège d'Alésia ({52 av. J.-C.}) est un chef-d'œuvre de génie militaire romain. César fit construire deux lignes de fortifications (contrevallation et circonvallation) pour piéger Vercingétorix tout en repoussant une armée de secours.$t$
  WHERE id = 133
    AND lore_text IS NOT DISTINCT FROM $t$Les fossés s'étiraient sur des kilomètres, et deux armées gauloises ne purent briser l'étau romain.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle est la grande forteresse gauloise où Vercingétorix fut finalement vaincu par César ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le siège d'Alésia (52 av. J.-C.) est un chef-d'œuvre de génie militaire romain. César fit construire deux lignes de fortifications (contrevallation et circonvallation) pour piéger Vercingétorix tout en repoussant une armée de secours.$t$
    AND answer IS NOT DISTINCT FROM $t$Alésia$t$
    AND choices IS NOT DISTINCT FROM $t$["Alésia","Gergovie","Bibracte","Uxellodunum"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le raid sur le monastère de Lindisfarne en {793} marque traditionnellement le début de l'Âge Viking. Cette date du {VIIIe siècle} inaugure deux siècles d'expansion scandinave vers l'Irlande, la France, la Russie et même l'Amérique du Nord.$t$,
    answer = $t${VIIIe siècle}$t$,
    choices = $t$["{VIIIe siècle}","{VIe siècle}","{IXe siècle}","{Xe siècle}"]$t$::jsonb
  WHERE id = 145
    AND lore_text IS NOT DISTINCT FROM $t$Des drakkars surgirent de la brume, et les moines de Lindisfarne comprirent que le monde avait changé.$t$
    AND question IS NOT DISTINCT FROM $t$En quel siècle les Vikings commencèrent-ils leurs grandes expéditions en Europe occidentale ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le raid sur le monastère de Lindisfarne en 793 marque traditionnellement le début de l'Âge Viking. Cette date du VIIIe siècle inaugure deux siècles d'expansion scandinave vers l'Irlande, la France, la Russie et même l'Amérique du Nord.$t$
    AND answer IS NOT DISTINCT FROM $t$VIIIe siècle$t$
    AND choices IS NOT DISTINCT FROM $t$["VIIIe siècle","VIe siècle","IXe siècle","Xe siècle"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel chef viking donna son nom à la Normandie après s'y être installé au {Xe siècle} ?$t$,
    explanation = $t$Rollon (ou Hrólf) fut le premier duc de Normandie. En {911}, par le traité de Saint-Clair-sur-Epte, Charles le Simple lui céda le territoire en échange de sa conversion au christianisme et de sa protection contre d'autres raids vikings.$t$
  WHERE id = 146
    AND lore_text IS NOT DISTINCT FROM $t$Le roi des Francs lui céda la terre pour acheter la paix — et le Nord s'installa dans le cœur de la Gaule.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef viking donna son nom à la Normandie après s'y être installé au Xe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Rollon (ou Hrólf) fut le premier duc de Normandie. En 911, par le traité de Saint-Clair-sur-Epte, Charles le Simple lui céda le territoire en échange de sa conversion au christianisme et de sa protection contre d'autres raids vikings.$t$
    AND answer IS NOT DISTINCT FROM $t$Rollon$t$
    AND choices IS NOT DISTINCT FROM $t$["Rollon","Ragnar Lothbrok","Harald à la Belle Chevelure","Sigurd le Serpent de l'Œil"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel explorateur viking est considéré comme le premier Européen à avoir atteint l'Amérique du Nord, vers l'an {1000} ?$t$,
    explanation = $t$Leif Erikson, fils d'Erik le Rouge, atteignit le Vinland (probablement Terre-Neuve) vers l'an {1000}. Le site archéologique de L'Anse aux Meadows au Canada confirme la présence viking en Amérique du Nord, 500 ans avant Colomb.$t$
  WHERE id = 152
    AND lore_text IS NOT DISTINCT FROM $t$Au-delà de toutes les cartes connues, il vogua vers l'ouest — et trouva une terre que personne n'avait encore nommée.$t$
    AND question IS NOT DISTINCT FROM $t$Quel explorateur viking est considéré comme le premier Européen à avoir atteint l'Amérique du Nord, vers l'an 1000 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Leif Erikson, fils d'Erik le Rouge, atteignit le Vinland (probablement Terre-Neuve) vers l'an 1000. Le site archéologique de L'Anse aux Meadows au Canada confirme la présence viking en Amérique du Nord, 500 ans avant Colomb.$t$
    AND answer IS NOT DISTINCT FROM $t$Leif Erikson$t$
    AND choices IS NOT DISTINCT FROM $t$["Leif Erikson","Erik le Rouge","Bjarne Herjolfsson","Thorvald Erikson"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les runes sont le système d'écriture des peuples germaniques (alphabet futhark). L'Elder Futhark ({Ier siècle}-{VIIe siècle}) comporte 24 signes. Au-delà de leur usage pratique, les runes avaient une dimension magique et divinatoire.$t$
  WHERE id = 153
    AND lore_text IS NOT DISTINCT FROM $t$Chaque signe porte une force propre — graver une rune, c'est convoquer quelque chose d'ancien et de puissant.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelle le système d'écriture utilisé par les peuples germaniques et nordiques, aux caractères anguleux taillés dans le bois ou la pierre ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les runes sont le système d'écriture des peuples germaniques (alphabet futhark). L'Elder Futhark (Ier-VIIe siècle) comporte 24 signes. Au-delà de leur usage pratique, les runes avaient une dimension magique et divinatoire.$t$
    AND answer IS NOT DISTINCT FROM $t$Les runes$t$
    AND choices IS NOT DISTINCT FROM $t$["Les runes","Les glyphes","L'ogham","Les cunéiformes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La fondation de Rome par Romulus est traditionnellement datée de {753 av. J.-C.} (anno urbis conditae). Cette date, calculée par l'annaliste Varron, servait de référence au calendrier romain. Archéologiquement, des traces d'occupation du Palatin remontent au {VIIIe siècle av. J.-C.}$t$,
    answer = $t${753 av. J.-C.}$t$,
    choices = $t$["{753 av. J.-C.}","{509 av. J.-C.}","{264 av. J.-C.}","{44 av. J.-C.}"]$t$::jsonb
  WHERE id = 155
    AND lore_text IS NOT DISTINCT FROM $t$Deux jumeaux nourris par une louve, une cité tracée au soc d'une charrue — ainsi naquit l'Éternelle.$t$
    AND question IS NOT DISTINCT FROM $t$Selon la tradition, en quelle année Rome fut-elle fondée ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La fondation de Rome par Romulus est traditionnellement datée de 753 av. J.-C. (anno urbis conditae). Cette date, calculée par l'annaliste Varron, servait de référence au calendrier romain. Archéologiquement, des traces d'occupation du Palatin remontent au VIIIe siècle av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$753 av. J.-C.$t$
    AND choices IS NOT DISTINCT FROM $t$["753 av. J.-C.","509 av. J.-C.","264 av. J.-C.","44 av. J.-C."]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Colisée (Amphitheatrum Flavium) fut construit entre {70 ap. J.-C.} et {80 ap. J.-C.} sous les empereurs Vespasien et Titus. Il pouvait accueillir entre 50 000 et 80 000 spectateurs pour les combats de gladiateurs, les chasses aux animaux et les exécutions publiques.$t$
  WHERE id = 159
    AND lore_text IS NOT DISTINCT FROM $t$Ses arches encerclaient l'arène comme les bras d'un colosse — et le rugissement de la foule se mêlait au sang sur le sable.$t$
    AND question IS NOT DISTINCT FROM $t$Quel monument de Rome, le plus grand de son genre, pouvait accueillir près de 50 000 spectateurs pour les jeux et les combats ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Colisée (Amphitheatrum Flavium) fut construit entre 70 et 80 apr. J.-C. sous les empereurs Vespasien et Titus. Il pouvait accueillir entre 50 000 et 80 000 spectateurs pour les combats de gladiateurs, les chasses aux animaux et les exécutions publiques.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Colisée (Amphithéâtre Flavien)$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Colisée (Amphithéâtre Flavien)","Le Circus Maximus","Le Panthéon","Le Forum de Trajan"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel général carthaginois traversa les Alpes avec des éléphants pour attaquer Rome par le nord à la fin du {IIIe siècle av. J.-C.} ?$t$,
    explanation = $t$Hannibal Barca, général carthaginois, traversa les Alpes en {218 av. J.-C.} avec 37 éléphants de guerre lors de la Deuxième Guerre Punique. Il infligea plusieurs défaites sévères à Rome (Tessin, Trébie, Lac Trasimène, Cannes) mais ne put jamais prendre la ville.$t$
  WHERE id = 160
    AND lore_text IS NOT DISTINCT FROM $t$Les montagnes enneigées ne l'arrêtèrent pas — il descendit sur l'Italie comme une tempête venue du sud.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général carthaginois traversa les Alpes avec des éléphants pour attaquer Rome par le nord à la fin du IIIe siècle av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Hannibal Barca, général carthaginois, traversa les Alpes en 218 av. J.-C. avec 37 éléphants de guerre lors de la Deuxième Guerre Punique. Il infligea plusieurs défaites sévères à Rome (Tessin, Trébie, Lac Trasimène, Cannes) mais ne put jamais prendre la ville.$t$
    AND answer IS NOT DISTINCT FROM $t$Hannibal Barca$t$
    AND choices IS NOT DISTINCT FROM $t$["Hannibal Barca","Pyrrhus d'Épire","Mithridate","Viriatus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le mur d'Hadrien fut construit à partir de {122 ap. J.-C.} sur ordre de l'empereur Hadrien. Long de 117 km, il traversait l'Angleterre de la mer du Nord à la mer d'Irlande. Il marquait la limite nord-ouest de l'Empire romain.$t$
  WHERE id = 163
    AND lore_text IS NOT DISTINCT FROM $t$Une ligne de pierre et de tourbes traversait l'île d'un bout à l'autre — derrière elle, la civilisation ; devant, l'inconnu.$t$
    AND question IS NOT DISTINCT FROM $t$Quel empereur romain fit construire un mur défensif en Bretagne (actuelle Angleterre) pour marquer la frontière nord de l'Empire ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le mur d'Hadrien fut construit à partir de 122 apr. J.-C. sur ordre de l'empereur Hadrien. Long de 117 km, il traversait l'Angleterre de la mer du Nord à la mer d'Irlande. Il marquait la limite nord-ouest de l'Empire romain.$t$
    AND answer IS NOT DISTINCT FROM $t$Hadrien$t$
    AND choices IS NOT DISTINCT FROM $t$["Hadrien","Trajan","Constantin","Domitien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'hypocauste (hypocaustum) était un système de chauffage romain par le sol, inventé au {Ier siècle av. J.-C.} Des pilettes de briques (pilae) surélevaient le plancher, permettant à l'air chaud produit par un foyer (praefurnium) de circuler en dessous.$t$
  WHERE id = 164
    AND lore_text IS NOT DISTINCT FROM $t$Sous les mosaïques, un souffle chaud monte des entrailles de la maison — le confort romain, invisible mais omniprésent.$t$
    AND question IS NOT DISTINCT FROM $t$Quel est le nom du système de chauffage par le sol utilisé dans les thermes et villas romaines, où l'air chaud circulait sous les dalles ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'hypocauste (hypocaustum) était un système de chauffage romain par le sol, inventé au Ier siècle av. J.-C. Des pilettes de briques (pilae) surélevaient le plancher, permettant à l'air chaud produit par un foyer (praefurnium) de circuler en dessous.$t$
    AND answer IS NOT DISTINCT FROM $t$L'hypocauste$t$
    AND choices IS NOT DISTINCT FROM $t$["L'hypocauste","Le caldarium","Le tepidarium","L'apodyterium"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Empire romain d'Occident prit fin en {476 ap. J.-C.} ({Ve siècle}) quand Odoacre, chef barbare, déposa le dernier empereur Romulus Augustule. Cette date marque conventionnellement la fin de l'Antiquité et le début du Moyen Âge.$t$,
    answer = $t${Ve siècle ap. J.-C.}$t$,
    choices = $t$["{Ve siècle ap. J.-C.}","{IVe siècle ap. J.-C.}","{VIe siècle ap. J.-C.}","{IIIe siècle ap. J.-C.}"]$t$::jsonb
  WHERE id = 166
    AND lore_text IS NOT DISTINCT FROM $t$Les aigles se posèrent, les légions rentrèrent leurs étendards — et mille ans d'histoire s'arrêtèrent en un seul jour.$t$
    AND question IS NOT DISTINCT FROM $t$En quel siècle l'Empire romain d'Occident prit-il fin officiellement ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Empire romain d'Occident prit fin en 476 apr. J.-C. (Ve siècle) quand Odoacre, chef barbare, déposa le dernier empereur Romulus Augustule. Cette date marque conventionnellement la fin de l'Antiquité et le début du Moyen Âge.$t$
    AND answer IS NOT DISTINCT FROM $t$Ve siècle apr. J.-C.$t$
    AND choices IS NOT DISTINCT FROM $t$["Ve siècle apr. J.-C.","IVe siècle apr. J.-C.","VIe siècle apr. J.-C.","IIIe siècle apr. J.-C."]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Panthéon de Rome fut construit sous Hadrien vers {125 ap. J.-C.} Son dôme en béton de 43 mètres de diamètre reste le plus grand dôme non renforcé du monde. L'oculus (ouverture de 8,7 m) au sommet est la seule source de lumière.$t$
  WHERE id = 167
    AND lore_text IS NOT DISTINCT FROM $t$Son dôme parfait n'a pas de fenêtres — juste un œil ouvert sur le ciel, l'oculus par lequel entre la lumière divine.$t$
    AND question IS NOT DISTINCT FROM $t$Quel bâtiment romain, recouvert d'un dôme remarquable, est dédié à "tous les dieux" et est encore debout à Rome ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Panthéon de Rome fut construit sous Hadrien vers 125 apr. J.-C. Son dôme en béton de 43 mètres de diamètre reste le plus grand dôme non renforcé du monde. L'oculus (ouverture de 8,7 m) au sommet est la seule source de lumière.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Panthéon$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Panthéon","Le Colisée","Les Thermes de Caracalla","La Basilique de Maxence"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel célèbre traité d'art militaire romain, rédigé au {IVe siècle}, reste une référence sur l'organisation des légions ?$t$,
    explanation = $t$L'Epitoma rei militaris (ou De re militari) de Flavius Végèce Renatus, rédigé fin {IVe siècle}, est le principal traité militaire romain conservé. Il décrit l'organisation, l'entraînement et les tactiques des légions, et fut étudié tout au long du Moyen Âge.$t$
  WHERE id = 168
    AND lore_text IS NOT DISTINCT FROM $t$Sur parchemin, un officier consigna les secrets de la légion victorieuse — et ses pages traversèrent les siècles.$t$
    AND question IS NOT DISTINCT FROM $t$Quel célèbre traité d'art militaire romain, rédigé au IVe siècle, reste une référence sur l'organisation des légions ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Epitoma rei militaris (ou De re militari) de Flavius Végèce Renatus, rédigé fin IVe siècle, est le principal traité militaire romain conservé. Il décrit l'organisation, l'entraînement et les tactiques des légions, et fut étudié tout au long du Moyen Âge.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Epitoma rei militaris de Végèce$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Epitoma rei militaris de Végèce","La Guerre des Gaules de César","L'Art de la guerre de Sun Tzu","Les Stratégèmes de Frontin"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en {330 ap. J.-C.} sur le site de l'ancienne Byzance. Elle fut la capitale de l'Empire romain d'Orient puis byzantin pendant plus de mille ans, jusqu'à sa chute en {1453}.$t$
  WHERE id = 169
    AND lore_text IS NOT DISTINCT FROM $t$Entre deux continents, la ville aux sept collines portait la lumière d'un empire qui refusait de mourir.$t$
    AND question IS NOT DISTINCT FROM $t$Quel était le nom de la capitale de l'Empire byzantin, fondée par Constantin Ier sur le Bosphore ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en 330 apr. J.-C. sur le site de l'ancienne Byzance. Elle fut la capitale de l'Empire romain d'Orient puis byzantin pendant plus de mille ans, jusqu'à sa chute en 1453.$t$
    AND answer IS NOT DISTINCT FROM $t$Constantinople$t$
    AND choices IS NOT DISTINCT FROM $t$["Constantinople","Antioche","Thessalonique","Alexandrie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel est le nom de la grande église de Constantinople, chef-d'œuvre de l'architecture byzantine construite au {VIe siècle} ?$t$,
    explanation = $t$Sainte-Sophie (Hagia Sophia, "Sainte Sagesse") fut construite sous Justinien Ier et inaugurée en {537}. Son immense dôme de 31 mètres de diamètre, qui semble flotter grâce à ses fenêtres à la base, révolutionna l'architecture. Elle fut cathédrale, puis mosquée, puis musée.$t$
  WHERE id = 170
    AND lore_text IS NOT DISTINCT FROM $t$Son dôme semblait suspendu par des chaînes d'or invisibles — les fidèles croyaient que les anges le maintenaient en l'air.$t$
    AND question IS NOT DISTINCT FROM $t$Quel est le nom de la grande église de Constantinople, chef-d'œuvre de l'architecture byzantine construite au VIe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Sainte-Sophie (Hagia Sophia, "Sainte Sagesse") fut construite sous Justinien Ier et inaugurée en 537. Son immense dôme de 31 mètres de diamètre, qui semble flotter grâce à ses fenêtres à la base, révolutionna l'architecture. Elle fut cathédrale, puis mosquée, puis musée.$t$
    AND answer IS NOT DISTINCT FROM $t$Sainte-Sophie (Hagia Sophia)$t$
    AND choices IS NOT DISTINCT FROM $t$["Sainte-Sophie (Hagia Sophia)","Le Palais des Blachernes","L'église des Saints-Apôtres","Sainte-Irène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel empereur byzantin du {VIe siècle} fit compiler tout le droit romain en un code monumental qui porte son nom et inspire encore le droit civil européen ?$t$,
    explanation = $t$Justinien Ier ({527}-{565}) fit compiler le Corpus Juris Civilis sous la direction du juriste Tribonien. Ce code, achevé en {534}, rassemblait des siècles de droit romain. Il fonde encore aujourd'hui les systèmes juridiques de nombreux pays européens.$t$
  WHERE id = 171
    AND lore_text IS NOT DISTINCT FROM $t$Il voulut que les lois de Rome survivent à Rome elle-même — et fit graver en latin ce que les Grecs administreraient.$t$
    AND question IS NOT DISTINCT FROM $t$Quel empereur byzantin du VIe siècle fit compiler tout le droit romain en un code monumental qui porte son nom et inspire encore le droit civil européen ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Justinien Ier (527-565) fit compiler le Corpus Juris Civilis sous la direction du juriste Tribonien. Ce code, achevé en 534, rassemblait des siècles de droit romain. Il fonde encore aujourd'hui les systèmes juridiques de nombreux pays européens.$t$
    AND answer IS NOT DISTINCT FROM $t$Justinien Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Justinien Ier","Constantin Ier","Héraclius","Basile II"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le feu grégeois fut une arme redoutable de la flotte byzantine dès le {VIIe siècle}. Projeté par des siphons, il brûlait même sur l'eau. Sa composition exacte reste inconnue à ce jour, mais contenait probablement de la résine de pin, du naphte et de la chaux vive.$t$
  WHERE id = 172
    AND lore_text IS NOT DISTINCT FROM $t$Les navires ennemis brûlèrent sur l'eau — et même les vagues semblaient nourrir ces flammes que rien n'éteignait.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle arme secrète les Byzantins utilisaient-ils pour incendier les flottes ennemies, et dont la composition resta mystérieuse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le feu grégeois fut une arme redoutable de la flotte byzantine dès le VIIe siècle. Projeté par des siphons, il brûlait même sur l'eau. Sa composition exacte reste inconnue à ce jour, mais contenait probablement de la résine de pin, du naphte et de la chaux vive.$t$
    AND answer IS NOT DISTINCT FROM $t$Le feu grégeois$t$
    AND choices IS NOT DISTINCT FROM $t$["Le feu grégeois","La baliste à pétrole","Le siphon à naphte","Les grenades à soufre"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'icône (eikōn, "image") est l'image sacrée de la théologie byzantine. Sa frontalité, l'absence de perspective et le fond d'or symbolisent la réalité divine hors du temps. La querelle de l'iconoclasme ({VIIIe siècle}-{IXe siècle}) faillit détruire cette tradition.$t$
  WHERE id = 173
    AND lore_text IS NOT DISTINCT FROM $t$Sur le panneau de bois, le regard du saint ne vous regarde pas — il regarde au-delà, dans un espace que l'œil ne peut atteindre.$t$
    AND question IS NOT DISTINCT FROM $t$Quel style artistique byzantin plaçait des figures hiératiques sur fond d'or, sans perspective, pour signifier le sacré hors du temps ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'icône (eikōn, "image") est l'image sacrée de la théologie byzantine. Sa frontalité, l'absence de perspective et le fond d'or symbolisent la réalité divine hors du temps. La querelle de l'iconoclasme (VIIIe-IXe siècle) faillit détruire cette tradition.$t$
    AND answer IS NOT DISTINCT FROM $t$L'icône$t$
    AND choices IS NOT DISTINCT FROM $t$["L'icône","La mosaïque antique","La fresque romaine","L'enluminure carolingienne"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Constantinople tomba le 29 mai {1453} ({XVe siècle}) face aux armées ottomanes de Mehmed II. Le dernier empereur, Constantin XI Paléologue, mourut au combat. Cette date marque conventionnellement la fin du Moyen Âge en Europe.$t$,
    answer = $t${XVe siècle}$t$,
    choices = $t$["{XVe siècle}","{XIIIe siècle}","{XIVe siècle}","{XVIe siècle}"]$t$::jsonb
  WHERE id = 174
    AND lore_text IS NOT DISTINCT FROM $t$Le dernier empereur combattit jusqu'au bout dans la brèche — et le croissant remplaça la croix sur les coupoles.$t$
    AND question IS NOT DISTINCT FROM $t$En quel siècle l'Empire byzantin prit-il fin avec la chute de Constantinople ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Constantinople tomba le 29 mai 1453 (XVe siècle) face aux armées ottomanes de Mehmed II. Le dernier empereur, Constantin XI Paléologue, mourut au combat. Cette date marque conventionnellement la fin du Moyen Âge en Europe.$t$
    AND answer IS NOT DISTINCT FROM $t$XVe siècle$t$
    AND choices IS NOT DISTINCT FROM $t$["XVe siècle","XIIIe siècle","XIVe siècle","XVIe siècle"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La Garde Varègue (Variagoi en grec) fut créée à la fin du {Xe siècle}. Composée d'abord de guerriers Rus et Vikings, puis d'Anglais après {1066}, elle était la garde personnelle de l'Empereur. Les Varègues étaient réputés pour leur loyauté absolue et leur redoutable habileté au combat.$t$
  WHERE id = 175
    AND lore_text IS NOT DISTINCT FROM $t$Ces hommes du Nord portaient leurs haches danoises au service d'un Dieu et d'un Basileus qu'ils avaient choisi librement.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait la garde d'élite de l'empereur byzantin, composée de guerriers étrangers dont de nombreux Vikings ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Garde Varègue (Variagoi en grec) fut créée à la fin du Xe siècle. Composée d'abord de guerriers Rus et Vikings, puis d'Anglais après 1066, elle était la garde personnelle de l'Empereur. Les Varègues étaient réputés pour leur loyauté absolue et leur redoutable habileté au combat.$t$
    AND answer IS NOT DISTINCT FROM $t$La Garde Varègue$t$
    AND choices IS NOT DISTINCT FROM $t$["La Garde Varègue","La Tagmata","Les Cataphractoi","Les Stratiotai"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel patriarche de Constantinople créa au {IXe siècle} un alphabet pour écrire les langues slaves, ancêtre de l'alphabet cyrillique ?$t$,
    explanation = $t$Saints Cyrille et Méthode, deux frères de Thessalonique, créèrent au {IXe siècle} l'alphabet glagolitique pour transcrire la langue slavonne liturgique. L'alphabet cyrillique, qui en dérive, fut nommé en l'honneur de Cyrille et est toujours utilisé en Russie, Bulgarie et Serbie.$t$
  WHERE id = 176
    AND lore_text IS NOT DISTINCT FROM $t$Pour que l'Évangile parle en toutes langues, il fallut d'abord inventer les lettres qui les porteraient.$t$
    AND question IS NOT DISTINCT FROM $t$Quel patriarche de Constantinople créa au IXe siècle un alphabet pour écrire les langues slaves, ancêtre de l'alphabet cyrillique ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Saints Cyrille et Méthode, deux frères de Thessalonique, créèrent au IXe siècle l'alphabet glagolitique pour transcrire la langue slavonne liturgique. L'alphabet cyrillique, qui en dérive, fut nommé en l'honneur de Cyrille et est toujours utilisé en Russie, Bulgarie et Serbie.$t$
    AND answer IS NOT DISTINCT FROM $t$Cyrille (et Méthode)$t$
    AND choices IS NOT DISTINCT FROM $t$["Cyrille (et Méthode)","Photios","Jean Chrysostome","Basile de Césarée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Basileus (roi en grec) devint le titre officiel des Empereurs byzantins à partir d'Héraclius ({610}-{641}), remplaçant le latin Imperator. Le titre complet "Basileus ton Rhomaion" (Roi des Romains) soulignait la continuité avec l'Empire romain.$t$
  WHERE id = 177
    AND lore_text IS NOT DISTINCT FROM $t$Il ne se disait pas "Imperator" — il portait un titre plus ancien, plus chargé, héritage des monarques d'Orient.$t$
    AND question IS NOT DISTINCT FROM $t$Quel terme grec désigne l'empereur byzantin, littéralement "roi des rois" dans la tradition orientale ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Basileus (roi en grec) devint le titre officiel des Empereurs byzantins à partir d'Héraclius (610-641), remplaçant le latin Imperator. Le titre complet "Basileus ton Rhomaion" (Roi des Romains) soulignait la continuité avec l'Empire romain.$t$
    AND answer IS NOT DISTINCT FROM $t$Basileus$t$
    AND choices IS NOT DISTINCT FROM $t$["Basileus","Autocrator","Despote","Sebastokrator"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Chrismon ou Chi-Rho est formé des deux premières lettres du mot grec Christos. Constantin l'adopta comme symbole après sa vision avant la bataille du Pont Milvius ({312}). C'est l'un des premiers symboles chrétiens utilisés officiellement par un pouvoir impérial.$t$
  WHERE id = 178
    AND lore_text IS NOT DISTINCT FROM $t$La vision d'avant la bataille avait été claire : sous ce signe, tu vaincras — et l'Empire changea de dieux.$t$
    AND question IS NOT DISTINCT FROM $t$Quel symbole, combinant les lettres grecques X (Chi) et P (Rho), fut adopté par Constantin comme signe chrétien impérial ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Chrismon ou Chi-Rho est formé des deux premières lettres du mot grec Christos. Constantin l'adopta comme symbole après sa vision avant la bataille du Pont Milvius (312). C'est l'un des premiers symboles chrétiens utilisés officiellement par un pouvoir impérial.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Chrismon (☧)$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Chrismon (☧)","La croix latine","L'alpha et l'oméga","L'ichthus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Hippodrome de Constantinople, construit par Septime Sévère et agrandi par Constantin, pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y étaient des partis politiques autant que sportifs. La révolte de Nika ({532}) y fit 30 000 morts.$t$
  WHERE id = 179
    AND lore_text IS NOT DISTINCT FROM $t$Dans l'arène aux cent mille voix, la couleur de votre faction valait plus que votre nom ou votre sang.$t$
    AND question IS NOT DISTINCT FROM $t$Quel est le nom du grand hippodrome de Constantinople où se déroulaient les courses de chars et les célébrations impériales ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Hippodrome de Constantinople, construit par Septime Sévère et agrandi par Constantin, pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y étaient des partis politiques autant que sportifs. La révolte de Nika (532) y fit 30 000 morts.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Hippodrome de Constantinople$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Hippodrome de Constantinople","Le Circus Maximus de Byzance","Le Stade de Théodose","L'Arène des Bleus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle dispute théologique du {IXe siècle} divisa l'Église entre Rome et Constantinople, aboutissant au Grand Schisme de {1054} ?$t$,
    explanation = $t$Le Filioque ("et du Fils") est l'ajout fait par l'Église latine au Credo : le Saint-Esprit procède du Père "et du Fils". Constantinople refusait cet ajout. Cette divergence théologique, combinée à des rivalités politiques, mena au Grand Schisme de {1054} séparant catholicisme et orthodoxie.$t$
  WHERE id = 180
    AND lore_text IS NOT DISTINCT FROM $t$Sur la nature du Saint-Esprit et l'autorité du Pape, les deux Rome ne purent s'accorder — et la chrétienté se brisa en deux.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle dispute théologique du IXe siècle divisa l'Église entre Rome et Constantinople, aboutissant au Grand Schisme de 1054 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Filioque ("et du Fils") est l'ajout fait par l'Église latine au Credo : le Saint-Esprit procède du Père "et du Fils". Constantinople refusait cet ajout. Cette divergence théologique, combinée à des rivalités politiques, mena au Grand Schisme de 1054 séparant catholicisme et orthodoxie.$t$
    AND answer IS NOT DISTINCT FROM $t$La querelle du Filioque$t$
    AND choices IS NOT DISTINCT FROM $t$["La querelle du Filioque","La querelle des investitures","L'iconoclasme","L'arianisme"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel empereur byzantin du {XIe siècle} fit appel au pape Urbain II, déclenchant indirectement la Première Croisade ?$t$,
    explanation = $t$En {1095}, l'empereur byzantin Alexis Ier Comnène envoya des ambassadeurs au Concile de Plaisance pour demander des mercenaires contre les Turcs Seldjoukides. Le Pape Urbain II lança à la place la Première Croisade au Concile de Clermont, dépassant largement les attentes d'Alexis.$t$
  WHERE id = 181
    AND lore_text IS NOT DISTINCT FROM $t$Il demandait des mercenaires — et reçut à la place des armées de pèlerins armés qui traversèrent son Empire comme un fleuve en crue.$t$
    AND question IS NOT DISTINCT FROM $t$Quel empereur byzantin du XIe siècle fit appel au pape Urbain II, déclenchant indirectement la Première Croisade ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 1095, l'empereur byzantin Alexis Ier Comnène envoya des ambassadeurs au Concile de Plaisance pour demander des mercenaires contre les Turcs Seldjoukides. Le Pape Urbain II lança à la place la Première Croisade au Concile de Clermont, dépassant largement les attentes d'Alexis.$t$
    AND answer IS NOT DISTINCT FROM $t$Alexis Ier Comnène$t$
    AND choices IS NOT DISTINCT FROM $t$["Alexis Ier Comnène","Basile II","Romain IV Diogène","Jean II Comnène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel roi arverne affronta César lors de la campagne des Gaules et fut finalement capturé à Alésia en {52 av. J.-C.} ?$t$,
    explanation = $t$Vercingétorix réunit une coalition de tribus gauloises contre César. Sa stratégie de la terre brûlée fut efficace jusqu'à Alésia, où il fut contraint de se rendre après un siège de plusieurs semaines. Il fut exécuté à Rome en {46 av. J.-C.}$t$
  WHERE id = 182
    AND lore_text IS NOT DISTINCT FROM $t$Les Arvernes dominaient le cœur de la Gaule depuis leurs oppida du Massif Central. Leur chef ultime allait unifier les tribus comme jamais auparavant.$t$
    AND question IS NOT DISTINCT FROM $t$Quel roi arverne affronta César lors de la campagne des Gaules et fut finalement capturé à Alésia en 52 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Vercingétorix réunit une coalition de tribus gauloises contre César. Sa stratégie de la terre brûlée fut efficace jusqu'à Alésia, où il fut contraint de se rendre après un siège de plusieurs semaines. Il fut exécuté à Rome en 46 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Vercingétorix$t$
    AND choices IS NOT DISTINCT FROM $t$["Ambiorix","Vercingétorix","Dumnorix","Viridomarus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle expédition de {279 av. J.-C.} mena des guerriers celtes au cœur de la Grèce, jusqu'à tenter de piller le plus célèbre sanctuaire oraculaire d'Apollon ?$t$,
    explanation = $t$En {279 av. J.-C.}, des Galates menés par Brennos tentèrent de piller Delphes. Les Grecs repoussèrent l'attaque, attribuant leur victoire à des prodiges d'Apollon. L'événement marqua durablement l'imaginaire hellénique face aux "Barbares du Nord".$t$
  WHERE id = 185
    AND lore_text IS NOT DISTINCT FROM $t$L'audace des Celtes n'avait pas de frontières : ils avaient saccagé Rome, traversé les Balkans et osèrent même défier Apollon dans son sanctuaire.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle expédition de 279 av. J.-C. mena des guerriers celtes au cœur de la Grèce, jusqu'à tenter de piller le plus célèbre sanctuaire oraculaire d'Apollon ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 279 av. J.-C., des Galates menés par Brennos tentèrent de piller Delphes. Les Grecs repoussèrent l'attaque, attribuant leur victoire à des prodiges d'Apollon. L'événement marqua durablement l'imaginaire hellénique face aux "Barbares du Nord".$t$
    AND answer IS NOT DISTINCT FROM $t$Raid de Delphes$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Thermopyles","Bataille de l'Aliakmon","Raid de Delphes","Bataille de Magnésie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel chef éduen, à la fois magistrat gaulois et citoyen romain, fut exécuté sur ordre de César pour trahison en {54 av. J.-C.} ?$t$,
    explanation = $t$Dumnorix, frère de l'allié romain Diviciacos, cherchait à unir les Gaulois contre César tout en maintenant des apparences de loyauté. Arrêté alors qu'il tentait de fuir, il fut tué par la cavalerie de César en {54 av. J.-C.}$t$
  WHERE id = 189
    AND lore_text IS NOT DISTINCT FROM $t$La frontière entre collaboration et résistance était mince dans la Gaule sous domination romaine. Certains jouaient des deux côtés, jusqu'au faux pas fatal.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef éduen, à la fois magistrat gaulois et citoyen romain, fut exécuté sur ordre de César pour trahison en 54 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Dumnorix, frère de l'allié romain Diviciacos, cherchait à unir les Gaulois contre César tout en maintenant des apparences de loyauté. Arrêté alors qu'il tentait de fuir, il fut tué par la cavalerie de César en 54 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Dumnorix$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel peuple celte, établi en Anatolie au {IIIe siècle av. J.-C.}, donna son nom à une région et une épître de saint Paul ?$t$,
    explanation = $t$Les Galates (ou Gaulois d'Asie) s'installèrent en Anatolie centrale vers {278 av. J.-C.} après avoir ravagé les royaumes hellénistiques. Leur région, la Galatie, est mentionnée par saint Paul dans son épître aux Galates, et leur langue celtique y survécut jusqu'au {IVe siècle ap. J.-C.}$t$
  WHERE id = 191
    AND lore_text IS NOT DISTINCT FROM $t$Certains Celtes ne s'arrêtèrent pas à Rome ni à Delphes : ils traversèrent la mer et fondèrent un royaume au cœur de l'actuelle Turquie, conservant leur langue pendant des siècles.$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple celte, établi en Anatolie au IIIe siècle av. J.-C., donna son nom à une région et une épître de saint Paul ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Galates (ou Gaulois d'Asie) s'installèrent en Anatolie centrale vers 278 av. J.-C. après avoir ravagé les royaumes hellénistiques. Leur région, la Galatie, est mentionnée par saint Paul dans son épître aux Galates, et leur langue celtique y survécut jusqu'au IVe siècle ap. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Galates$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel oppidum mandubien, situé sur un plateau naturellement défendu, fut le théâtre du siège décisif de {52 av. J.-C.} où Vercingétorix dut se rendre à César ?$t$
  WHERE id = 193
    AND lore_text IS NOT DISTINCT FROM $t$Sur un plateau de Bourgogne, cerné par les légions romaines et leurs doubles fortifications, les Gaulois jouèrent leur dernière carte. Ce nom résonne encore dans toute l'histoire de France.$t$
    AND question IS NOT DISTINCT FROM $t$Quel oppidum mandubien, situé sur un plateau naturellement défendu, fut le théâtre du siège décisif de 52 av. J.-C. où Vercingétorix dut se rendre à César ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Alésia (Alesia en gaulois) fut le site du siège final de la guerre des Gaules. César y fit construire deux lignes de fortification : la contrevallation (face aux assiégés) et la circumvallation (face aux renforts gaulois). La défaite de Vercingétorix y sella le sort de la Gaule indépendante.$t$
    AND answer IS NOT DISTINCT FROM $t$Alésia$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Le calendrier de Coligny, découvert en {1897}, est rédigé dans quelle langue ?$t$
  WHERE id = 194
    AND lore_text IS NOT DISTINCT FROM $t$Gravé sur des plaques de bronze au Ier siècle de notre ère, ce calendrier lunaire est l'un des rares témoignages directs de la pensée astronomique des druides.$t$
    AND question IS NOT DISTINCT FROM $t$Le calendrier de Coligny, découvert en 1897, est rédigé dans quelle langue ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le calendrier de Coligny (Ain, France) est le plus long texte gaulois connu. Rédigé en gaulois mais utilisant l'alphabet latin, il présente un cycle de 5 ans de 62 mois lunaires, témoignant d'une astronomie sophistiquée chez les druides.$t$
    AND answer IS NOT DISTINCT FROM $t$En gaulois avec caractères latins$t$
    AND choices IS NOT DISTINCT FROM $t$["En latin","En gaulois avec caractères latins","En grec","En ogham"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$César écrit dans la "Guerre des Gaules" (II, 15) que les Nerviens étaient "de loin les plus belliqueux" des Belges. Lors de la bataille de la Sambre en {57 av. J.-C.}, ils mirent les légions romaines en grande difficulté avant d'être presque anéantis.$t$
  WHERE id = 195
    AND lore_text IS NOT DISTINCT FROM $t$César écrivit que parmi tous les Gaulois, certains étaient les plus braves — et c'était peut-être plus un aveu d'admiration que d'objectivité.$t$
    AND question IS NOT DISTINCT FROM $t$Quel peuple belge, dont le territoire couvrait l'actuel Hainaut et le nord de la Gaule belgique, résista le plus longtemps à César selon ses propres écrits ?$t$
    AND explanation IS NOT DISTINCT FROM $t$César écrit dans la "Guerre des Gaules" (II, 15) que les Nerviens étaient "de loin les plus belliqueux" des Belges. Lors de la bataille de la Sambre en 57 av. J.-C., ils mirent les légions romaines en grande difficulté avant d'être presque anéantis.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Nerviens$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Trévires","Les Éburons","Les Bellovaques","Les Nerviens"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel poème norrois du {XIIIe siècle}, composé de 164 strophes de sagesse attribuées à Odin, est aussi appelé "Les dits du Très-Haut" ?$t$
  WHERE id = 196
    AND lore_text IS NOT DISTINCT FROM $t$Suspendu neuf nuits à Yggdrasil, transpercé de sa propre lance, Odin acquit les runes et la sagesse du monde. Ces paroles sont sa transmission aux hommes.$t$
    AND question IS NOT DISTINCT FROM $t$Quel poème norrois du XIIIe siècle, composé de 164 strophes de sagesse attribuées à Odin, est aussi appelé "Les dits du Très-Haut" ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Hávamál (Paroles du Très-Haut) est un poème de l'Edda poétique offrant conseils pratiques, maximes morales et récits mythologiques. Il constitue une des sources majeures sur l'éthique viking et la vision norroise de la sagesse.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Hávamál$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Völuspá","Le Hávamál","Le Grímnismál","Le Skírnismál"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Thing (ou Þing) était l'assemblée des hommes libres où se réglaient les litiges, se votaient les lois et s'élisaient les chefs. L'Althing islandais, fondé en {930}, est l'une des plus anciennes assemblées parlementaires du monde encore en activité.$t$
  WHERE id = 197
    AND lore_text IS NOT DISTINCT FROM $t$Dans le monde norrois, la loi ne venait pas d'un roi seul mais de la parole des hommes libres réunis sur la plaine du destin. La démocratie y avait un visage sauvage.$t$
    AND question IS NOT DISTINCT FROM $t$Comment les Vikings appelaient-ils leur assemblée législative et judiciaire populaire, tenue en plein air sur des sites désignés ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Thing (ou Þing) était l'assemblée des hommes libres où se réglaient les litiges, se votaient les lois et s'élisaient les chefs. L'Althing islandais, fondé en 930, est l'une des plus anciennes assemblées parlementaires du monde encore en activité.$t$
    AND answer IS NOT DISTINCT FROM $t$Thing$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$L'année {1066} vit deux invasions de l'Angleterre. L'une échoua dans le nord, fauchant le dernier grand conquérant viking. L'autre, au sud, allait changer l'histoire pour toujours.$t$,
    question = $t$Lors de quelle bataille de {1066} Harald Hardrada, roi de Norvège, fut-il tué en tentant de conquérir l'Angleterre ?$t$,
    explanation = $t$Harald Hardrada (Harald le Sévère) fut tué à Stamford Bridge le 25 septembre {1066} par le roi Harold II d'Angleterre. Trois jours plus tard, Harold devait marcher vers le sud pour affronter Guillaume le Conquérant à Hastings, où il mourut à son tour.$t$
  WHERE id = 199
    AND lore_text IS NOT DISTINCT FROM $t$L'année 1066 vit deux invasions de l'Angleterre. L'une échoua dans le nord, fauchant le dernier grand conquérant viking. L'autre, au sud, allait changer l'histoire pour toujours.$t$
    AND question IS NOT DISTINCT FROM $t$Lors de quelle bataille de 1066 Harald Hardrada, roi de Norvège, fut-il tué en tentant de conquérir l'Angleterre ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Harald Hardrada (Harald le Sévère) fut tué à Stamford Bridge le 25 septembre 1066 par le roi Harold II d'Angleterre. Trois jours plus tard, Harold devait marcher vers le sud pour affronter Guillaume le Conquérant à Hastings, où il mourut à son tour.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Stamford Bridge$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Maldon","Bataille de Stamford Bridge","Bataille d'Hastings","Bataille de Clontarf"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel explorateur islandais est généralement crédité de la première installation européenne en Amérique du Nord, vers l'an {1000} ?$t$,
    explanation = $t$Leif Erikson, fils d'Éric le Rouge, atteignit le continent nord-américain vers l'an {1000}, fondant un établissement à L'Anse aux Meadows (Terre-Neuve, Canada). Ce site, fouillé depuis {1960}, est la seule preuve archéologique confirmée d'une présence viking en Amérique.$t$
  WHERE id = 200
    AND lore_text IS NOT DISTINCT FROM $t$Avant Colomb de cinq siècles, un Norrois suivit les traces de son père et toucha une terre que personne en Europe ne soupçonnait. Il l'appela Vinland.$t$
    AND question IS NOT DISTINCT FROM $t$Quel explorateur islandais est généralement crédité de la première installation européenne en Amérique du Nord, vers l'an 1000 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Leif Erikson, fils d'Éric le Rouge, atteignit le continent nord-américain vers l'an 1000, fondant un établissement à L'Anse aux Meadows (Terre-Neuve, Canada). Ce site, fouillé depuis 1960, est la seule preuve archéologique confirmée d'une présence viking en Amérique.$t$
    AND answer IS NOT DISTINCT FROM $t$Leif Erikson$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Rouen (Rothomagus en latin, Rúðuborg en norrois) devint la capitale du duché de Normandie accordé à Rollon en {911} par le traité de Saint-Clair-sur-Epte. Le nom "Normandie" lui-même vient de "Northmannia" (terre des hommes du Nord).$t$
  WHERE id = 203
    AND lore_text IS NOT DISTINCT FROM $t$Les hommes du Nord ne repartirent pas tous. Certains s'installèrent, se marièrent, apprirent le français — et devinrent les Normands, qui allaient conquérir l'Angleterre et la Sicile.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ville française, ancienne capitale du duché normand fondé par les Vikings, conserve un nom d'origine scandinave ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Rouen (Rothomagus en latin, Rúðuborg en norrois) devint la capitale du duché de Normandie accordé à Rollon en 911 par le traité de Saint-Clair-sur-Epte. Le nom "Normandie" lui-même vient de "Northmannia" (terre des hommes du Nord).$t$
    AND answer IS NOT DISTINCT FROM $t$Rouen$t$
    AND choices IS NOT DISTINCT FROM $t$["Caen","Cherbourg","Rouen","Bayeux"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel jarl norvégien, gouverneur de la Norvège pour le compte danois, fut tué lors d'une révolte en {995} permettant la conversion forcée du pays au christianisme ?$t$
  WHERE id = 206
    AND lore_text IS NOT DISTINCT FROM $t$Le vieux monde des dieux nordiques résistait face à la croix. Mais quand les hommes forts tombent, les peuples changent de foi — parfois à la pointe de l'épée.$t$
    AND question IS NOT DISTINCT FROM $t$Quel jarl norvégien, gouverneur de la Norvège pour le compte danois, fut tué lors d'une révolte en 995 permettant la conversion forcée du pays au christianisme ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Hakon Sigurdsson, jarl de Lade, gouverna la Norvège de façon quasi indépendante et maintint le culte des dieux nordiques contre la pression chrétienne danoise. Son assassinat par son propre esclave permit à Olaf Tryggvason de s'emparer du pouvoir et d'imposer le christianisme.$t$
    AND answer IS NOT DISTINCT FROM $t$Jarl Hakon Sigurdsson$t$
    AND choices IS NOT DISTINCT FROM $t$["Hakon le Bon","Jarl Sigurd","Jarl Hakon Sigurdsson","Erik Bloodaxe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La Garde varègue (Varangian Guard) fut fondée vers {988} après qu'Olaf, prince de Kiev, envoya 6 000 guerriers à l'Empereur Basile II. Composée majoritairement de Scandinaves, puis d'Anglais après {1066}, elle assura la protection personnelle des empereurs byzantins pendant trois siècles.$t$
  WHERE id = 207
    AND lore_text IS NOT DISTINCT FROM $t$Des hommes venus des fjords glacés se retrouvèrent à garder le trône le plus riche de la Méditerranée. Leur réputation de férocité était leur meilleur bouclier.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait la garde d'élite byzantine composée en grande partie de guerriers scandinaves, servant l'Empereur de Constantinople ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Garde varègue (Varangian Guard) fut fondée vers 988 après qu'Olaf, prince de Kiev, envoya 6 000 guerriers à l'Empereur Basile II. Composée majoritairement de Scandinaves, puis d'Anglais après 1066, elle assura la protection personnelle des empereurs byzantins pendant trois siècles.$t$
    AND answer IS NOT DISTINCT FROM $t$Varègues$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle réforme militaire de la fin du {IIe siècle av. J.-C.} supprima le recrutement censitaire et ouvrit l'armée romaine aux prolétaires sans terre ?$t$,
    explanation = $t$Gaius Marius (consul 7 fois entre {107 av. J.-C.} et {86 av. J.-C.}) ouvrit l'armée aux capite censi (proléaires sans bien). L'État fournissait désormais l'équipement, et les légionnaires devenaient des professionnels liés à leur général plus qu'à Rome, préparant les guerres civiles.$t$
  WHERE id = 210
    AND lore_text IS NOT DISTINCT FROM $t$Rome avait grandi grâce à ses légions de paysans-soldats. Mais quand la paysannerie s'effondra, un général ambitieux trouva une solution qui allait transformer la République pour toujours.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle réforme militaire de la fin du IIe siècle av. J.-C. supprima le recrutement censitaire et ouvrit l'armée romaine aux prolétaires sans terre ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gaius Marius (consul 7 fois entre 107 et 86 av. J.-C.) ouvrit l'armée aux capite censi (proléaires sans bien). L'État fournissait désormais l'équipement, et les légionnaires devenaient des professionnels liés à leur général plus qu'à Rome, préparant les guerres civiles.$t$
    AND answer IS NOT DISTINCT FROM $t$Réforme marienne$t$
    AND choices IS NOT DISTINCT FROM $t$["Réforme des Gracques","Réforme marienne","Réforme de Sylla","Réforme de César"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La provocatio ad populum (appel au peuple) était un droit constitutionnel romain protégeant les citoyens contre l'arbitraire des magistrats. Codifiée par les lois Valerio-Horatiae de {449 av. J.-C.}, elle est l'une des premières formes de protection des droits individuels dans l'Antiquité.$t$
  WHERE id = 211
    AND lore_text IS NOT DISTINCT FROM $t$Un citoyen romain ne pouvait être condamné à mort sans recours. Ce droit fondamental distinguait Rome de tous les régimes despotiques qu'elle combattait — du moins en théorie.$t$
    AND question IS NOT DISTINCT FROM $t$Quel terme latin désignait le droit des citoyens romains à faire appel d'une sentence capitale devant l'assemblée du peuple ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La provocatio ad populum (appel au peuple) était un droit constitutionnel romain protégeant les citoyens contre l'arbitraire des magistrats. Codifiée par les lois Valerio-Horatiae de 449 av. J.-C., elle est l'une des premières formes de protection des droits individuels dans l'Antiquité.$t$
    AND answer IS NOT DISTINCT FROM $t$Provocatio$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Contre quel général carthaginois Rome remporta-t-elle la bataille de Zama en {202 av. J.-C.}, mettant fin à la Deuxième Guerre punique ?$t$,
    explanation = $t$À Zama ({202 av. J.-C.}), Scipion l'Africain vainquit Hannibal en neutralisant ses éléphants et en utilisant la cavalerie numide de Massinissa retournée du côté romain. C'était la première défaite d'Hannibal en bataille rangée, après 16 ans de campagnes invincibles en Italie.$t$
  WHERE id = 212
    AND lore_text IS NOT DISTINCT FROM $t$La plaine de Zama vit s'affronter le plus grand général de son époque contre un adversaire qui n'avait jamais perdu une bataille. Rome avait trouvé enfin son digne adversaire de Carthage.$t$
    AND question IS NOT DISTINCT FROM $t$Contre quel général carthaginois Rome remporta-t-elle la bataille de Zama en 202 av. J.-C., mettant fin à la Deuxième Guerre punique ?$t$
    AND explanation IS NOT DISTINCT FROM $t$À Zama (202 av. J.-C.), Scipion l'Africain vainquit Hannibal en neutralisant ses éléphants et en utilisant la cavalerie numide de Massinissa retournée du côté romain. C'était la première défaite d'Hannibal en bataille rangée, après 16 ans de campagnes invincibles en Italie.$t$
    AND answer IS NOT DISTINCT FROM $t$Hannibal Barca$t$
    AND choices IS NOT DISTINCT FROM $t$["Hasdrubal","Hamilcar Barca","Hannibal Barca","Mago Barca"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille de {216 av. J.-C.} fut la plus catastrophique défaite militaire de Rome, où Hannibal détruisit deux armées consulaires grâce à une manœuvre d'encerclement ?$t$,
    explanation = $t$À Cannes (2 août {216 av. J.-C.}), Hannibal mit en œuvre la première grande manœuvre d'encerclement documentée de l'histoire (la "tenaille de Cannes") : ses ailes reculèrent pour envelopper les légions qui avançaient au centre. Environ 50 000 Romains furent tués en une seule journée.$t$
  WHERE id = 215
    AND lore_text IS NOT DISTINCT FROM $t$Rome aligna ce jour-là plus de 70 000 soldats. Au soir, la plupart étaient morts. Un seul général ennemi avait accompli ce que personne n'avait osé imaginer possible.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille de 216 av. J.-C. fut la plus catastrophique défaite militaire de Rome, où Hannibal détruisit deux armées consulaires grâce à une manœuvre d'encerclement ?$t$
    AND explanation IS NOT DISTINCT FROM $t$À Cannes (2 août 216 av. J.-C.), Hannibal mit en œuvre la première grande manœuvre d'encerclement documentée de l'histoire (la "tenaille de Cannes") : ses ailes reculèrent pour envelopper les légions qui avançaient au centre. Environ 50 000 Romains furent tués en une seule journée.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Cannes$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille du Tessin","Bataille de la Trébie","Bataille du lac Trasimène","Bataille de Cannes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel général romain conquit la Bretagne pour Claude en {43 ap. J.-C.} et fut ensuite nommé gouverneur de la nouvelle province ?$t$,
    explanation = $t$Aulus Plautius dirigea l'invasion de la Bretagne (Britannia) avec quatre légions en {43 ap. J.-C.} Il remporta la décisive bataille de la Medway et permit à l'Empereur Claude lui-même de venir symboliquement prendre possession de la nouvelle province.$t$
  WHERE id = 217
    AND lore_text IS NOT DISTINCT FROM $t$L'île des druides résistait depuis des siècles aux convoitises romaines. César l'avait effleurée ; ce fut un autre qui la ceignit vraiment dans les chaînes de l'Empire.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général romain conquit la Bretagne pour Claude en 43 ap. J.-C. et fut ensuite nommé gouverneur de la nouvelle province ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Aulus Plautius dirigea l'invasion de la Bretagne (Britannia) avec quatre légions en 43 ap. J.-C. Il remporta la décisive bataille de la Medway et permit à l'Empereur Claude lui-même de venir symboliquement prendre possession de la nouvelle province.$t$
    AND answer IS NOT DISTINCT FROM $t$Aulus Plautius$t$
    AND choices IS NOT DISTINCT FROM $t$["Gnaeus Julius Agricola","Aulus Plautius","Ostorius Scapula","Suetonius Paulinus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La manumissio inter amicos (affranchissement entre amis) permettait à un maître de libérer son esclave lors d'un repas en présence de témoins. Moins formelle que la vindicta (par magistrat), elle créait un affranchi de statut latin plutôt que citoyen jusqu'à la loi Junia Norbana de {19 ap. J.-C.}$t$
  WHERE id = 218
    AND lore_text IS NOT DISTINCT FROM $t$La liberté avait plusieurs chemins à Rome : certains coûtaient une fortune, d'autres ne coûtaient qu'un geste. Mais tous laissaient une marque indélébile sur le statut social.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle institution permettait aux Romains d'affranchir un esclave lors d'un repas, simplement en lui faisant toucher le sel et le pain ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La manumissio inter amicos (affranchissement entre amis) permettait à un maître de libérer son esclave lors d'un repas en présence de témoins. Moins formelle que la vindicta (par magistrat), elle créait un affranchi de statut latin plutôt que citoyen jusqu'à la loi Junia Norbana de 19 ap. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$La manumissio inter amicos$t$
    AND choices IS NOT DISTINCT FROM $t$["La manumissio vindicta","La manumissio censu","La manumissio inter amicos","La manumissio testamento"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La lex Gabinia de {139 av. J.-C.} introduisit le vote par tablette (tabella) pour les élections, remplaçant le vote oral qui exposait les citoyens aux pressions. Des lois similaires furent ensuite étendues aux procès et aux lois (tabella iudiciaria, tabella de legibus).$t$
  WHERE id = 219
    AND lore_text IS NOT DISTINCT FROM $t$La démocratie romaine avait ses ruses pour protéger l'électeur des pressions des puissants. Une petite tablette permit à des milliers de citoyens de voter selon leur conscience.$t$
    AND question IS NOT DISTINCT FROM $t$Quel mot latin désignait le vote secret utilisé lors des élections et des procès romains, inscrit sur une tablette de cire ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La lex Gabinia de 139 av. J.-C. introduisit le vote par tablette (tabella) pour les élections, remplaçant le vote oral qui exposait les citoyens aux pressions. Des lois similaires furent ensuite étendues aux procès et aux lois (tabella iudiciaria, tabella de legibus).$t$
    AND answer IS NOT DISTINCT FROM $t$Tabella$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle révolte d'esclaves, menée entre {73 av. J.-C.} et {71 av. J.-C.}, fut l'une des plus graves crises intérieures de la République romaine tardive ?$t$,
    explanation = $t$Spartacus, gladiateur thrace, lança sa révolte depuis Capoue en {73 av. J.-C.} Son armée atteignit 120 000 hommes et infligea plusieurs défaites aux armées romaines. Crassus l'écrasa en {71 av. J.-C.} et fit crucifier 6 000 survivants le long de la Via Appia de Capoue à Rome.$t$
  WHERE id = 222
    AND lore_text IS NOT DISTINCT FROM $t$Des milliers d'hommes enchaînés choisirent de mourir libres plutôt que de vivre comme propriété. Leur chef devint une légende que Rome ne put effacer malgré six mille croix dressées sur la Voie Appienne.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle révolte d'esclaves, menée entre 73 et 71 av. J.-C., fut l'une des plus graves crises intérieures de la République romaine tardive ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Spartacus, gladiateur thrace, lança sa révolte depuis Capoue en 73 av. J.-C. Son armée atteignit 120 000 hommes et infligea plusieurs défaites aux armées romaines. Crassus l'écrasa en 71 av. J.-C. et fit crucifier 6 000 survivants le long de la Via Appia de Capoue à Rome.$t$
    AND answer IS NOT DISTINCT FROM $t$Révolte de Spartacus$t$
    AND choices IS NOT DISTINCT FROM $t$["Révolte de Sicile de Eunous","Révolte de Spartacus","Révolte de Salvius Tryphon","Révolte de Perpenna"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel Empereur byzantin du {VIe siècle} fit compiler tout le droit romain en un seul corpus légal, encore étudié dans les facultés de droit ?$t$,
    explanation = $t$Justinien Ier fit compiler le Corpus Juris Civilis entre {529} et {534}, sous la direction du juriste Tribonien. Il comprend le Code (constitutions impériales), les Pandectes (jurisprudence), les Institutes (manuel) et les Novelles. C'est le fondement du droit civil continental européen.$t$
  WHERE id = 224
    AND lore_text IS NOT DISTINCT FROM $t$Un seul homme ordonna de rassembler mille ans de droit romain épars en une œuvre cohérente. Ce qu'il accomplit en quelques années allait gouverner l'Europe pendant des siècles.$t$
    AND question IS NOT DISTINCT FROM $t$Quel Empereur byzantin du VIe siècle fit compiler tout le droit romain en un seul corpus légal, encore étudié dans les facultés de droit ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Justinien Ier fit compiler le Corpus Juris Civilis entre 529 et 534, sous la direction du juriste Tribonien. Il comprend le Code (constitutions impériales), les Pandectes (jurisprudence), les Institutes (manuel) et les Novelles. C'est le fondement du droit civil continental européen.$t$
    AND answer IS NOT DISTINCT FROM $t$Justinien Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Théodose II","Justinien Ier","Héraclius","Basile II"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le feu grégeois (pyr Rhōmaïkon, "feu romain") fut utilisé dès {673} contre la flotte arabe lors du premier siège de Constantinople. Sa composition exacte reste inconnue mais incluait probablement de la chaux vive, du soufre et de la naphte. Il contribua à préserver l'Empire byzantin pendant des siècles.$t$
  WHERE id = 225
    AND lore_text IS NOT DISTINCT FROM $t$Constantinople résista à des dizaines de sièges grâce à ses murailles et à un secret jalousement gardé. Ce secret brûlait sur l'eau elle-même, rendant la mer aussi dangereuse que la terre.$t$
    AND question IS NOT DISTINCT FROM $t$Quel nom portait l'arme secrète byzantine projetant un liquide enflammé impossible à éteindre par l'eau, utilisée notamment contre les flottes arabes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le feu grégeois (pyr Rhōmaïkon, "feu romain") fut utilisé dès 673 contre la flotte arabe lors du premier siège de Constantinople. Sa composition exacte reste inconnue mais incluait probablement de la chaux vive, du soufre et de la naphte. Il contribua à préserver l'Empire byzantin pendant des siècles.$t$
    AND answer IS NOT DISTINCT FROM $t$Feu grégeois$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle crise iconoclaste byzantine, qui durait depuis {726}, fut-elle définitivement résolue par le Deuxième Concile de Nicée en {787} ?$t$,
    explanation = $t$L'iconoclasme (destruction des images) fut lancé par Léon III en {726} et provoqua une crise majeure. Le Deuxième Concile de Nicée ({787}) rétablit le culte des icônes, distinguant la proskynèse (vénération) de la latreia (adoration due à Dieu seul). L'iconoclasme reprit de {814} à {842}.$t$
  WHERE id = 226
    AND lore_text IS NOT DISTINCT FROM $t$Faut-il adorer les images de Dieu et des saints, ou est-ce une idolâtrie que même les Arabes et les Juifs moquent ? La question déchira l'Empire pendant un siècle.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle crise iconoclaste byzantine, qui durait depuis 726, fut-elle définitivement résolue par le Deuxième Concile de Nicée en 787 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'iconoclasme (destruction des images) fut lancé par Léon III en 726 et provoqua une crise majeure. Le Deuxième Concile de Nicée (787) rétablit le culte des icônes, distinguant la proskynèse (vénération) de la latreia (adoration due à Dieu seul). L'iconoclasme reprit de 814 à 842.$t$
    AND answer IS NOT DISTINCT FROM $t$L'iconoclasme$t$
    AND choices IS NOT DISTINCT FROM $t$["La querelle des images","L'iconoclasme","La querelle monophysite","La querelle nestorienne"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Deux frères en Christ qui s'étaient affrontés sur des mots pendant des siècles finirent par s'excommunier mutuellement. La rupture de {1054} n'a jamais été totalement réparée.$t$,
    question = $t$Quel Patriarche de Constantinople, excommunié par Rome en {1054}, fut l'un des acteurs du Grand Schisme entre Chrétienté orientale et occidentale ?$t$,
    explanation = $t$Michel Cérulaire (Patriarche {1043}-{1058}) fut excommunié par le légat papal Humbert de Moyenmoutier le 16 juillet {1054}, date du Grand Schisme. Il répliqua en excommuniant les légats. Le différend portait sur le Filioque, l'autorité papale et des pratiques liturgiques divergentes.$t$
  WHERE id = 227
    AND lore_text IS NOT DISTINCT FROM $t$Deux frères en Christ qui s'étaient affrontés sur des mots pendant des siècles finirent par s'excommunier mutuellement. La rupture de 1054 n'a jamais été totalement réparée.$t$
    AND question IS NOT DISTINCT FROM $t$Quel Patriarche de Constantinople, excommunié par Rome en 1054, fut l'un des acteurs du Grand Schisme entre Chrétienté orientale et occidentale ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Michel Cérulaire (Patriarche 1043-1058) fut excommunié par le légat papal Humbert de Moyenmoutier le 16 juillet 1054, date du Grand Schisme. Il répliqua en excommuniant les légats. Le différend portait sur le Filioque, l'autorité papale et des pratiques liturgiques divergentes.$t$
    AND answer IS NOT DISTINCT FROM $t$Michel Cérulaire$t$
    AND choices IS NOT DISTINCT FROM $t$["Michel Cérulaire","Photius","Jean IV le Jeûneur","Ignace de Constantinople"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Hippodrome de Constantinople (Ἱππόδρομος) fut agrandi par Constantin en {324}. Long de 450m, il pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y organisèrent la révolte de Nika en {532}, qui faillit coûter le trône à Justinien avant que Bélisaire n'écrase les insurgés.$t$
  WHERE id = 228
    AND lore_text IS NOT DISTINCT FROM $t$Plus qu'un simple stade, c'était le cœur politique de Constantinople. Les factions colorées qui s'y affrontaient pouvaient renverser un Empereur ou en sauver un autre.$t$
    AND question IS NOT DISTINCT FROM $t$Comment s'appelait le grand édifice de Constantinople, adjacent au palais impérial, où se déroulaient les courses de chars et où les factions populaires faisaient et défaisaient les empereurs ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Hippodrome de Constantinople (Ἱππόδρομος) fut agrandi par Constantin en 324. Long de 450m, il pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y organisèrent la révolte de Nika en 532, qui faillit coûter le trône à Justinien avant que Bélisaire n'écrase les insurgés.$t$
    AND answer IS NOT DISTINCT FROM $t$Hippodrome$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Bélisaire reconquit l'Afrique du Nord aux Vandales ({533}-{534}) et lança la reconquête de l'Italie ({535}-{540}), prenant Rome et Ravenne. Sa jalousie avec Narsès et la méfiance de Justinien limitèrent ses succès ultérieurs. Il reste l'un des plus grands généraux de l'Antiquité tardive.$t$
  WHERE id = 229
    AND lore_text IS NOT DISTINCT FROM $t$Un seul homme, avec peu de troupes mais un génie tactique exceptionnel, reconquit en quelques années ce que Rome avait perdu en un siècle. Justinien lui en voulut presque pour ça.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général de Justinien reconquit l'Italie aux Ostrogoths et l'Afrique du Nord aux Vandales dans les années 530-540 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Bélisaire reconquit l'Afrique du Nord aux Vandales (533-534) et lança la reconquête de l'Italie (535-540), prenant Rome et Ravenne. Sa jalousie avec Narsès et la méfiance de Justinien limitèrent ses succès ultérieurs. Il reste l'un des plus grands généraux de l'Antiquité tardive.$t$
    AND answer IS NOT DISTINCT FROM $t$Bélisaire$t$
    AND choices IS NOT DISTINCT FROM $t$["Narsès","Bélisaire","Mundus","Jean l'Arménien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel terme byzantin désignait le système administratif divisant l'Empire en grandes provinces militaro-civiles dirigées par un stratège, mis en place au {VIIe siècle} ?$t$,
    explanation = $t$Le système des thèmes (θέματα) fut développé sous Héraclius et ses successeurs au {VIIe siècle}. Chaque thème était gouverné par un stratège (général) qui détenait à la fois le commandement militaire et le gouvernement civil. Ce système décentralisé permit à Byzance de survivre aux invasions.$t$
  WHERE id = 230
    AND lore_text IS NOT DISTINCT FROM $t$Face aux invasions arabes et slaves qui menaçaient l'Empire de toutes parts, Constantinople réorganisa son territoire. Le nouveau système fusionna pouvoir civil et militaire pour réagir plus vite.$t$
    AND question IS NOT DISTINCT FROM $t$Quel terme byzantin désignait le système administratif divisant l'Empire en grandes provinces militaro-civiles dirigées par un stratège, mis en place au VIIe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le système des thèmes (θέματα) fut développé sous Héraclius et ses successeurs au VIIe siècle. Chaque thème était gouverné par un stratège (général) qui détenait à la fois le commandement militaire et le gouvernement civil. Ce système décentralisé permit à Byzance de survivre aux invasions.$t$
    AND answer IS NOT DISTINCT FROM $t$Thème$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle impératrice byzantine du {IXe siècle} rétablit définitivement le culte des icônes en {843}, événement célébré encore aujourd'hui comme le "Triomphe de l'Orthodoxie" ?$t$,
    explanation = $t$Théodora, régente pour son fils Michel III après la mort de Théophile ({842}), convoqua un synode qui rétablit le culte des icônes le 11 mars {843} (premier dimanche de Carême). Ce "Triomphe de l'Orthodoxie" est encore commémoré chaque année dans les Églises orthodoxes.$t$
  WHERE id = 231
    AND lore_text IS NOT DISTINCT FROM $t$Une femme gouvernait au nom de son fils mineur quand elle trancha le débat qui avait déchiré l'Empire depuis un siècle. Son choix définit le visage de l'Église orthodoxe pour toujours.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle impératrice byzantine du IXe siècle rétablit définitivement le culte des icônes en 843, événement célébré encore aujourd'hui comme le "Triomphe de l'Orthodoxie" ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Théodora, régente pour son fils Michel III après la mort de Théophile (842), convoqua un synode qui rétablit le culte des icônes le 11 mars 843 (premier dimanche de Carême). Ce "Triomphe de l'Orthodoxie" est encore commémoré chaque année dans les Églises orthodoxes.$t$
    AND answer IS NOT DISTINCT FROM $t$Théodora (femme de Théophile)$t$
    AND choices IS NOT DISTINCT FROM $t$["Théodora (femme de Théophile)","Irène d'Athènes","Zoé Porphyrogénète","Eudocie Makrembolitissa"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel siège de {1204} vit des Croisés catholiques saccager Constantinople, divisant l'Empire byzantin en États successeurs et provoquant un traumatisme durable dans la chrétienté orientale ?$t$,
    explanation = $t$La Quatrième Croisade ({1202}-{1204}), détournée par Venise, aboutit au sac de Constantinople du 12 avril {1204}. Les croisés pillèrent l'une des villes les plus riches du monde et fondèrent l'Empire latin. Les trésors volés, dont les Chevaux de Saint-Marc, ornent encore Venise.$t$
  WHERE id = 232
    AND lore_text IS NOT DISTINCT FROM $t$Les guerriers de la Croix, partis pour libérer Jérusalem, se retournèrent contre leurs frères chrétiens. Ce qu'ils firent à la Reine des Villes ne fut jamais pardonné.$t$
    AND question IS NOT DISTINCT FROM $t$Quel siège de 1204 vit des Croisés catholiques saccager Constantinople, divisant l'Empire byzantin en États successeurs et provoquant un traumatisme durable dans la chrétienté orientale ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Quatrième Croisade (1202-1204), détournée par Venise, aboutit au sac de Constantinople du 12 avril 1204. Les croisés pillèrent l'une des villes les plus riches du monde et fondèrent l'Empire latin. Les trésors volés, dont les Chevaux de Saint-Marc, ornent encore Venise.$t$
    AND answer IS NOT DISTINCT FROM $t$Quatrième Croisade$t$
    AND choices IS NOT DISTINCT FROM $t$["Quatrième Croisade","Troisième Croisade","Croisade des Albigeois","Deuxième Croisade"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel Empereur byzantin du {Xe siècle}, dit le "Tueur de Bulgares" (Boulgaroktonos), fit crever les yeux de 15 000 prisonniers bulgares après la bataille de Kleidion en {1014} ?$t$,
    explanation = $t$Basile II ({976}-{1025}) imposa la puissance byzantine dans les Balkans et fit crever les yeux de 15 000 prisonniers à Kleidion ({1014}), laissant un œil à chaque centième pour guider les autres. Le tsar Samuel, en voyant ses guerriers revenir ainsi, mourut d'une apoplexie deux jours après.$t$
  WHERE id = 234
    AND lore_text IS NOT DISTINCT FROM $t$Certaines victoires laissent des traces dans les mémoires pour des siècles. Quand les prisonniers aveuglés rentrèrent chez eux, leur tsar mourut de saisissement.$t$
    AND question IS NOT DISTINCT FROM $t$Quel Empereur byzantin du Xe siècle, dit le "Tueur de Bulgares" (Boulgaroktonos), fit crever les yeux de 15 000 prisonniers bulgares après la bataille de Kleidion en 1014 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Basile II (976-1025) imposa la puissance byzantine dans les Balkans et fit crever les yeux de 15 000 prisonniers à Kleidion (1014), laissant un œil à chaque centième pour guider les autres. Le tsar Samuel, en voyant ses guerriers revenir ainsi, mourut d'une apoplexie deux jours après.$t$
    AND answer IS NOT DISTINCT FROM $t$Basile II$t$
    AND choices IS NOT DISTINCT FROM $t$["Nicéphore Phocas","Jean Tzimiskès","Basile II","Constantin VIII"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le monophysisme (du grec monos, seul, et physis, nature) soutient que le Christ a une seule nature divine après l'Incarnation. Condamné au Concile de Chalcédoine ({451}), il fut adopté par les Églises copte (Égypte), éthiopienne, arménienne et syriaque, qui se séparèrent de Constantinople.$t$
  WHERE id = 235
    AND lore_text IS NOT DISTINCT FROM $t$Une seule lettre de différence dans la formulation théologique put diviser des communautés chrétiennes pour des siècles. L'Égypte, la Syrie et l'Arménie choisirent leur lecture — et restèrent séparées.$t$
    AND question IS NOT DISTINCT FROM $t$Quel schéma doctrinal, affirmant que le Christ n'a qu'une seule nature (divine), causa une rupture durable entre Constantinople et les Églises d'Égypte et d'Éthiopie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le monophysisme (du grec monos, seul, et physis, nature) soutient que le Christ a une seule nature divine après l'Incarnation. Condamné au Concile de Chalcédoine (451), il fut adopté par les Églises copte (Égypte), éthiopienne, arménienne et syriaque, qui se séparèrent de Constantinople.$t$
    AND answer IS NOT DISTINCT FROM $t$Monophysisme$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille de {1071} vit la défaite décisive de Byzance face aux Seldjoukides, ouvrant l'Anatolie à la colonisation turque ?$t$,
    explanation = $t$À Manzikert (26 août {1071}), l'Empereur Romain IV Diogène fut capturé par le Sultan Alp Arslan. Cette défaite ouvrit l'Anatolie centrale aux migrations turques seldjoukides, réduisant progressivement la base démographique et économique de Byzance. Elle est souvent vue comme le début du déclin irréversible de l'Empire.$t$
  WHERE id = 236
    AND lore_text IS NOT DISTINCT FROM $t$En un seul après-midi, le destin d'une région fut scellé pour mille ans. L'Anatolie, cœur nourricier de l'Empire, allait lentement changer de visage, de langue et de foi.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille de 1071 vit la défaite décisive de Byzance face aux Seldjoukides, ouvrant l'Anatolie à la colonisation turque ?$t$
    AND explanation IS NOT DISTINCT FROM $t$À Manzikert (26 août 1071), l'Empereur Romain IV Diogène fut capturé par le Sultan Alp Arslan. Cette défaite ouvrit l'Anatolie centrale aux migrations turques seldjoukides, réduisant progressivement la base démographique et économique de Byzance. Elle est souvent vue comme le début du déclin irréversible de l'Empire.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Manzikert$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Manzikert","Bataille de Myriokephalon","Bataille de Antioche","Bataille de Nicée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {279 av. J.-C.}, une armée de guerriers celtes envahit la Macédoine, puis la Grèce, et pilla Delphes — le centre du monde grec. Mais leur chef fut tué lors de la retraite, et les sources grecques brodèrent une légende sur leur défaite.$t$,
    question = $t$Quel chef gaulois mena le raid sur Delphes en {279 av. J.-C.} ?$t$,
    explanation = $t$Brenn (ou Brennos) conduisit une coalition de tribus celtes jusqu'à Delphes, pillant le sanctuaire apollinien. Les sources grecques (Pausanias, Diodore) affirment que le dieu lui-même repoussa les Gaulois par des prodiges, mais la version historique montre simplement une retraite après la mort de Brenn, blessé. Il ne faut pas le confondre avec un autre Brenn qui avait pris Rome en {390 av. J.-C.}$t$
  WHERE id = 237
    AND lore_text IS NOT DISTINCT FROM $t$En 279 av. J.-C., une armée de guerriers celtes envahit la Macédoine, puis la Grèce, et pilla Delphes — le centre du monde grec. Mais leur chef fut tué lors de la retraite, et les sources grecques brodèrent une légende sur leur défaite.$t$
    AND question IS NOT DISTINCT FROM $t$Quel chef gaulois mena le raid sur Delphes en 279 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Brenn (ou Brennos) conduisit une coalition de tribus celtes jusqu'à Delphes, pillant le sanctuaire apollinien. Les sources grecques (Pausanias, Diodore) affirment que le dieu lui-même repoussa les Gaulois par des prodiges, mais la version historique montre simplement une retraite après la mort de Brenn, blessé. Il ne faut pas le confondre avec un autre Brenn qui avait pris Rome en 390 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Brenn$t$
    AND choices IS NOT DISTINCT FROM $t$["Brenn","Vercingétorix","Ambiorix","Dumnorix"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel oppidum arverne, fouillé depuis le {XIXe siècle}, est considéré comme la capitale de Vercingétorix ?$t$,
    explanation = $t$Gergovie (Gergovia) était la capitale des Arvernes, sur le plateau de Merdogne près de Clermont-Ferrand. C'est là que Vercingétorix infligea à César sa seule grande défaite tactique en {52 av. J.-C.} Alésia fut sa dernière bataille. Les fouilles du {XIXe siècle} et du {XXe siècle} ont mis au jour les remparts et des structures de l'oppidum.$t$
  WHERE id = 238
    AND lore_text IS NOT DISTINCT FROM $t$Les Celtes de l'âge du fer ne vivaient pas dans des huttes misérables : certains de leurs oppida couvraient des centaines d'hectares et produisaient des biens de luxe exportés jusqu'aux rives de la Méditerranée.$t$
    AND question IS NOT DISTINCT FROM $t$Quel oppidum arverne, fouillé depuis le XIXe siècle, est considéré comme la capitale de Vercingétorix ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gergovie (Gergovia) était la capitale des Arvernes, sur le plateau de Merdogne près de Clermont-Ferrand. C'est là que Vercingétorix infligea à César sa seule grande défaite tactique en 52 av. J.-C. Alésia fut sa dernière bataille. Les fouilles du XIXe et du XXe siècle ont mis au jour les remparts et des structures de l'oppidum.$t$
    AND answer IS NOT DISTINCT FROM $t$Gergovie$t$
    AND choices IS NOT DISTINCT FROM $t$["Alésia","Gergovie","Bibracte","Uxellodunum"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$L'un des trésors archéologiques majeurs de l'Europe celtique est un chaudron en argent repoussé, découvert en {1891} dans une tourbière danoise. Ses plaques intérieures représentent des divinités, des serpents à cornes et des sacrifices.$t$,
    question = $t$Comment appelle-t-on ce chaudron d'argent de l'âge du fer, découvert en {1891} dans une tourbière du Jutland ?$t$
  WHERE id = 240
    AND lore_text IS NOT DISTINCT FROM $t$L'un des trésors archéologiques majeurs de l'Europe celtique est un chaudron en argent repoussé, découvert en 1891 dans une tourbière danoise. Ses plaques intérieures représentent des divinités, des serpents à cornes et des sacrifices.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on ce chaudron d'argent de l'âge du fer, découvert en 1891 dans une tourbière du Jutland ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le chaudron de Gundestrup (Ier s. av. J.-C.) est le plus grand objet en argent de l'âge du fer européen. Il représente des scènes mythologiques celtiques, dont le célèbre panneau du Cernunnos aux bois de cerf entouré d'animaux. Son origine exacte est débattue : fabriqué peut-être en Thrace ou dans les Balkans, il représente néanmoins une iconographie clairement celtique.$t$
    AND answer IS NOT DISTINCT FROM $t$Le chaudron de Gundestrup$t$
    AND choices IS NOT DISTINCT FROM $t$["Le chaudron de Gundestrup","Le chaudron de Sutton Hoo","Le vase de Vix","Le cratère de Hochdorf"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La tombe d'une femme de haut rang découverte à Vix (Côte-d'Or) en {1953} a bouleversé la compréhension de la société hallstattienne. Elle renfermait l'un des plus grands vases de bronze de l'Antiquité.$t$,
    explanation = $t$Le cratère de Vix (vers {500 av. J.-C.}) mesure 1,64 m de hauteur et pèse 208 kg. Sa capacité est d'environ 1 100 litres. C'est le plus grand vase métallique connu de l'Antiquité. Fabriqué en Grande-Grèce (Laconie), il témoigne des réseaux d'échange entre élites celtiques et Méditerranée.$t$
  WHERE id = 242
    AND lore_text IS NOT DISTINCT FROM $t$La tombe d'une femme de haut rang découverte à Vix (Côte-d'Or) en 1953 a bouleversé la compréhension de la société hallstattienne. Elle renfermait l'un des plus grands vases de bronze de l'Antiquité.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle est la contenance approximative du cratère de bronze retrouvé dans la tombe de Vix ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le cratère de Vix (vers 500 av. J.-C.) mesure 1,64 m de hauteur et pèse 208 kg. Sa capacité est d'environ 1 100 litres. C'est le plus grand vase métallique connu de l'Antiquité. Fabriqué en Grande-Grèce (Laconie), il témoigne des réseaux d'échange entre élites celtiques et Méditerranée.$t$
    AND answer IS NOT DISTINCT FROM $t$1 100 litres$t$
    AND choices IS NOT DISTINCT FROM $t$["1 100 litres","200 litres","500 litres","2 000 litres"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Le calendrier de Coligny, découvert en {1897} dans l'Ain, est la plus longue inscription gauloise connue. C'est un calendrier lunaire-solaire gravé sur bronze, datant du {IIe siècle ap. J.-C.}$t$
  WHERE id = 244
    AND lore_text IS NOT DISTINCT FROM $t$Le calendrier de Coligny, découvert en 1897 dans l'Ain, est la plus longue inscription gauloise connue. C'est un calendrier lunaire-solaire gravé sur bronze, datant du IIe siècle ap. J.-C.$t$
    AND question IS NOT DISTINCT FROM $t$Combien de mois le calendrier gaulois de Coligny comptait-il dans son cycle complet de 5 ans ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le calendrier de Coligny articule un cycle de 5 ans (quinquennal) comprenant 62 mois lunaires, dont 2 mois intercalaires pour synchroniser le calendrier lunaire avec l'année solaire. Chaque mois est classé en MAT (favorable) ou ANM (défavorable). C'est la preuve que les druides avaient développé un système astronomique sophistiqué, bien avant que les Romains ne le leur attribuent.$t$
    AND answer IS NOT DISTINCT FROM $t$62 mois$t$
    AND choices IS NOT DISTINCT FROM $t$["60 mois","62 mois","48 mois","70 mois"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$L'armée gauloise qui écrasa les Romains au sur la Trébie en {218 av. J.-C.} combattait sous les ordres d'Hannibal — mais des Gaulois cisalpins avaient déjà battu Rome seuls, un siècle et demi plus tôt.$t$,
    question = $t$Lors de quelle bataille les Gaulois Sénons mirent-ils Rome à sac, vers {390 av. J.-C.} ?$t$,
    explanation = $t$La bataille de l'Allia (18 juillet {390 av. J.-C.}, date maudite dans le calendrier romain) vit les Sénons de Brenn écraser l'armée romaine sur les rives du fleuve Allia. Rome fut ensuite pillée pendant plusieurs mois — seul le Capitole résista. Tite-Live et Polybe décrivent l'événement comme un traumatisme fondateur. Les Romains qualifièrent le 18 juillet de dies nefastus à perpétuité.$t$
  WHERE id = 245
    AND lore_text IS NOT DISTINCT FROM $t$L'armée gauloise qui écrasa les Romains au sur la Trébie en 218 av. J.-C. combattait sous les ordres d'Hannibal — mais des Gaulois cisalpins avaient déjà battu Rome seuls, un siècle et demi plus tôt.$t$
    AND question IS NOT DISTINCT FROM $t$Lors de quelle bataille les Gaulois Sénons mirent-ils Rome à sac, vers 390 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille de l'Allia (18 juillet 390 av. J.-C., date maudite dans le calendrier romain) vit les Sénons de Brenn écraser l'armée romaine sur les rives du fleuve Allia. Rome fut ensuite pillée pendant plusieurs mois — seul le Capitole résista. Tite-Live et Polybe décrivent l'événement comme un traumatisme fondateur. Les Romains qualifièrent le 18 juillet de dies nefastus à perpétuité.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille d'Allia$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille d'Allia","Bataille de Cannes","Bataille de Trasimène","Bataille de Sentinum"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Les Celtes insulaires (Irlande, Galles) ont conservé une littérature mythologique orale transmise à l'écrit par des moines chrétiens à partir du {VIIe siècle}. Le cycle ulstérien en est le cœur.$t$
  WHERE id = 246
    AND lore_text IS NOT DISTINCT FROM $t$Les Celtes insulaires (Irlande, Galles) ont conservé une littérature mythologique orale transmise à l'écrit par des moines chrétiens à partir du VIIe siècle. Le cycle ulstérien en est le cœur.$t$
    AND question IS NOT DISTINCT FROM $t$Quel héros irlandais du cycle ulstérien est connu pour avoir tué le chien du forgeron Culann étant enfant, et pris sa place comme gardien ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Cú Chulainn (« le chien de Culann ») tira son nom de l'exploit qu'il accomplit enfant : ayant tué le chien de garde du forgeron Culann d'un coup de sliotar, il proposa de prendre la place de l'animal jusqu'à ce qu'un remplaçant soit élevé. Son vrai nom était Sétanta. Il est le héros central de la Táin Bó Cúailnge, l'épopée irlandaise comparable à l'Iliade.$t$
    AND answer IS NOT DISTINCT FROM $t$Cú Chulainn$t$
    AND choices IS NOT DISTINCT FROM $t$["Finn Mac Cumhaill","Cú Chulainn","Conall Cernach","Lugh Lamhfhada"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Le massacre de l'île de Môn (Anglesey) en {60 ap. J.-C.} est l'un des épisodes les plus dramatiques de la conquête romaine de la Bretagne. Tacite en livre un témoignage troublant.$t$,
    question = $t$Quel général romain détruisit le dernier grand sanctuaire druidique de l'île de Môn (Anglesey) en {60 ap. J.-C.} ?$t$
  WHERE id = 248
    AND lore_text IS NOT DISTINCT FROM $t$Le massacre de l'île de Môn (Anglesey) en 60 ap. J.-C. est l'un des épisodes les plus dramatiques de la conquête romaine de la Bretagne. Tacite en livre un témoignage troublant.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général romain détruisit le dernier grand sanctuaire druidique de l'île de Môn (Anglesey) en 60 ap. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Suetonius Paulinus mena ses légions jusqu'en Anglesey (Môn), dernier refuge des druides britanniques, et fit abattre les bois sacrés. Tacite (Annales, XIV, 30) décrit les druides et les femmes en noir brandissant des torches, les légionnaires paralysés de stupeur avant de reprendre leurs sens. La révolte de Boadicée éclata au même moment, forçant Paulinus à rebrousser chemin.$t$
    AND answer IS NOT DISTINCT FROM $t$Suetonius Paulinus$t$
    AND choices IS NOT DISTINCT FROM $t$["Agricola","Suetonius Paulinus","Ostorius Scapula","Vespasien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$En {225 av. J.-C.}, une coalition de tribus gauloises traversa les Alpes et envahit l'Italie du Nord. Les Romains les arrêtèrent dans un étau entre deux armées consulaires.$t$,
    question = $t$À quelle bataille les Romains écrasèrent-ils une grande coalition gauloise en {225 av. J.-C.}, dans ce qui est aujourd'hui la Toscane ?$t$,
    explanation = $t$La bataille de Télamon (Talamone, Toscane) en {225 av. J.-C.} vit les armées consulaires de Lucius Aemilius Papus et de Caius Atilius Regulus prendre en tenaille une coalition de Gaesates (mercenaires celtes transalpins), d'Insubres et de Boïens. Polybe (II, 27-31) décrit les Gaesates combattant nus — leur nudité rituelle étant à la fois un geste sacré et une démonstration de bravoure. 40 000 Gaulois furent tués.$t$
  WHERE id = 250
    AND lore_text IS NOT DISTINCT FROM $t$En 225 av. J.-C., une coalition de tribus gauloises traversa les Alpes et envahit l'Italie du Nord. Les Romains les arrêtèrent dans un étau entre deux armées consulaires.$t$
    AND question IS NOT DISTINCT FROM $t$À quelle bataille les Romains écrasèrent-ils une grande coalition gauloise en 225 av. J.-C., dans ce qui est aujourd'hui la Toscane ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille de Télamon (Talamone, Toscane) en 225 av. J.-C. vit les armées consulaires de Lucius Aemilius Papus et de Caius Atilius Regulus prendre en tenaille une coalition de Gaesates (mercenaires celtes transalpins), d'Insubres et de Boïens. Polybe (II, 27-31) décrit les Gaesates combattant nus — leur nudité rituelle étant à la fois un geste sacré et une démonstration de bravoure. 40 000 Gaulois furent tués.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Télamon$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Télamon","Bataille de Clastidium","Bataille de Sentinum","Bataille du Tessin"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Ammien Marcellin, historien du {IVe siècle}, décrit les Gaulois comme de grands orateurs mais aussi comme des mangeurs voraces, leur donnant un trait culturel précis qui les distinguait des Romains.$t$
  WHERE id = 252
    AND lore_text IS NOT DISTINCT FROM $t$Ammien Marcellin, historien du IVe siècle, décrit les Gaulois comme de grands orateurs mais aussi comme des mangeurs voraces, leur donnant un trait culturel précis qui les distinguait des Romains.$t$
    AND question IS NOT DISTINCT FROM $t$Selon Ammien Marcellin, quel comportement à table était caractéristique des Gaulois nobles et étonnait les Romains ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Ammien Marcellin (Res Gestae, XV, 12) note que lors des banquets, les Gaulois se disputaient parfois la portion d'honneur (la cuisse du porc rôti) au point d'en venir aux mains. Cette coutume — la "portion du héros" ou curadmír — est confirmée par les sources irlandaises médiévales : le meilleur morceau revenait de droit au plus brave, et la contester était une déclaration de supériorité.$t$
    AND answer IS NOT DISTINCT FROM $t$Se battre pour la meilleure portion$t$
    AND choices IS NOT DISTINCT FROM $t$["Manger debout","Partager leur repas avec des inconnus","Se battre pour la meilleure portion","Boire de la bière plutôt que du vin"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Strabon (Géographie, IV, 1) décrit les Volques Tectosages (autour de Toulouse/Tolosa) comme détenteurs d'immenses richesses en or, en partie issues de pillages (dont le trésor de Delphes selon la légende), en partie de mines locales. Le "trésor de Toulouse" (Aurum Tolosanum), saisi par le consul Caepio en {106 av. J.-C.} et mystérieusement disparu, est entré dans la légende comme l'or maudit des Tectosages.$t$
  WHERE id = 253
    AND lore_text IS NOT DISTINCT FROM $t$L'or gaulois ne venait pas que du pillage. Les Gaulois exploitaient des mines et des rivières aurifères, notamment dans le Massif Central et les Pyrénées. Certaines tribus en tiraient une richesse considérable.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle tribu gauloise du sud de la Gaule était particulièrement renommée pour ses mines d'or et sa richesse métallurgique, selon Strabon ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Strabon (Géographie, IV, 1) décrit les Volques Tectosages (autour de Toulouse/Tolosa) comme détenteurs d'immenses richesses en or, en partie issues de pillages (dont le trésor de Delphes selon la légende), en partie de mines locales. Le "trésor de Toulouse" (Aurum Tolosanum), saisi par le consul Caepio en 106 av. J.-C. et mystérieusement disparu, est entré dans la légende comme l'or maudit des Tectosages.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Volques Tectosages$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Rutènes","Les Volques Tectosages","Les Bituriges","Les Lingons"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Qui rédigea l'Edda en prose vers {1220}, synthétisant la mythologie nordique pour les poètes skaldiques ?$t$,
    explanation = $t$Snorri Sturluson ({1179}-{1241}), chef politique islandais et poète, rédigea l'Edda en prose (Prose Edda) vers {1220} comme manuel de poésie skaldique — incluant la Gylfaginning (tromperie de Gylfi), récit de la mythologie nordique. Saxo Grammaticus rédigit les Gesta Danorum au même siècle, mais en latin et avec une vision différente. Sans Snorri, une grande partie de la mythologie nordique aurait été perdue.$t$
  WHERE id = 254
    AND lore_text IS NOT DISTINCT FROM $t$L'Edda poétique et l'Edda en prose contiennent les deux sources principales de la mythologie nordique — mais elles furent rédigées des siècles après la christianisation, par des lettrés islandais qui cherchaient à sauver une mémoire.$t$
    AND question IS NOT DISTINCT FROM $t$Qui rédigea l'Edda en prose vers 1220, synthétisant la mythologie nordique pour les poètes skaldiques ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Snorri Sturluson (1179-1241), chef politique islandais et poète, rédigea l'Edda en prose (Prose Edda) vers 1220 comme manuel de poésie skaldique — incluant la Gylfaginning (tromperie de Gylfi), récit de la mythologie nordique. Saxo Grammaticus rédigit les Gesta Danorum au même siècle, mais en latin et avec une vision différente. Sans Snorri, une grande partie de la mythologie nordique aurait été perdue.$t$
    AND answer IS NOT DISTINCT FROM $t$Snorri Sturluson$t$
    AND choices IS NOT DISTINCT FROM $t$["Saxo Grammaticus","Snorri Sturluson","Adam de Brême","Ari Þorgilsson"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Althing (Alþingi) fut fondé en {930} à Þingvellir (les Plaines du Parlement), dans une fissure tectonique entre les plaques eurasienne et nord-américaine. C'était une assemblée annuelle de chefs locaux (goðar) qui légiférait et rendait la justice. L'Islande n'avait pas de roi — l'Althing était sa structure politique unique. En l'an {1000}, c'est l'Althing qui vota la christianisation de l'île.$t$,
    answer = $t${930}$t$,
    choices = $t$["{930}","{870}","{1000}","{1066}"]$t$::jsonb
  WHERE id = 255
    AND lore_text IS NOT DISTINCT FROM $t$Les Vikings ne se contentaient pas de razzier : ils fondèrent des États durables. L'un d'eux créa la première assemblée parlementaire d'Europe occidentale, sur une île isolée au milieu de l'Atlantique Nord.$t$
    AND question IS NOT DISTINCT FROM $t$En quelle année fut fondé l'Althing islandais, considéré comme l'un des plus anciens parlements du monde ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Althing (Alþingi) fut fondé en 930 à Þingvellir (les Plaines du Parlement), dans une fissure tectonique entre les plaques eurasienne et nord-américaine. C'était une assemblée annuelle de chefs locaux (goðar) qui légiférait et rendait la justice. L'Islande n'avait pas de roi — l'Althing était sa structure politique unique. En l'an 1000, c'est l'Althing qui vota la christianisation de l'île.$t$
    AND answer IS NOT DISTINCT FROM $t$930$t$
    AND choices IS NOT DISTINCT FROM $t$["930","870","1000","1066"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel prince varègue est traditionnellement considéré comme le fondateur de la Rus' de Kiev, vers {882} ?$t$,
    explanation = $t$Selon la Chronique des temps passés (Povest' vremennykh let), c'est Oleg (Helgi en norrois) qui s'empara de Kiev vers {882}, en tuant Askold et Dir, et en fit sa capitale, déclarant : "Que Kiev soit la mère des villes russes." Rurik fonda Novgorod (~{862}) mais mourut avant Kiev. Oleg étendit le territoire jusqu'à Constantinople, contre laquelle il mena deux expéditions et obtint des traités commerciaux favorables en {907} et {911}.$t$
  WHERE id = 257
    AND lore_text IS NOT DISTINCT FROM $t$La ruée vers l'est des Vikings — les Varègues — est moins connue que leurs raids à l'ouest. Ils descendirent les fleuves russes jusqu'à la mer Noire et Caspienne, fondant des comptoirs qui devinrent des villes.$t$
    AND question IS NOT DISTINCT FROM $t$Quel prince varègue est traditionnellement considéré comme le fondateur de la Rus' de Kiev, vers 882 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Selon la Chronique des temps passés (Povest' vremennykh let), c'est Oleg (Helgi en norrois) qui s'empara de Kiev vers 882, en tuant Askold et Dir, et en fit sa capitale, déclarant : "Que Kiev soit la mère des villes russes." Rurik fonda Novgorod (~862) mais mourut avant Kiev. Oleg étendit le territoire jusqu'à Constantinople, contre laquelle il mena deux expéditions et obtint des traités commerciaux favorables en 907 et 911.$t$
    AND answer IS NOT DISTINCT FROM $t$Oleg$t$
    AND choices IS NOT DISTINCT FROM $t$["Rurik","Oleg","Sviatoslav","Igor"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'Anse aux Meadows, à la pointe nord de Terre-Neuve, fut découvert en {1960} par Helge et Anne Ingstad. Les fouilles révélèrent des vestiges norrois datés autour de l'an {1000}, correspondant aux sagas de Leif Erikson. C'est le seul site viking authentifié en Amérique du Nord. Les Norrois y fabriquaient du métal — preuve qu'il ne s'agissait pas d'un simple camp de pêche mais d'un établissement plus ambitieux.$t$
  WHERE id = 259
    AND lore_text IS NOT DISTINCT FROM $t$Les Vikings en Amérique du Nord ne sont pas une légende : ils y établirent un campement archéologiquement attesté, cinq siècles avant Christophe Colomb. Son nom norrois signifie "Anse aux Méduses".$t$
    AND question IS NOT DISTINCT FROM $t$Dans quelle province canadienne actuelle se trouve le site archéologique viking de L'Anse aux Meadows, inscrit à l'UNESCO ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Anse aux Meadows, à la pointe nord de Terre-Neuve, fut découvert en 1960 par Helge et Anne Ingstad. Les fouilles révélèrent des vestiges norrois datés autour de l'an 1000, correspondant aux sagas de Leif Erikson. C'est le seul site viking authentifié en Amérique du Nord. Les Norrois y fabriquaient du métal — preuve qu'il ne s'agissait pas d'un simple camp de pêche mais d'un établissement plus ambitieux.$t$
    AND answer IS NOT DISTINCT FROM $t$Terre-Neuve$t$
    AND choices IS NOT DISTINCT FROM $t$["Nouvelle-Écosse","Terre-Neuve","Labrador","Île-du-Prince-Édouard"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$La tombe d'Oseberg (Norvège, {834 ap. J.-C.}) contenait deux femmes et un navire intact. Quelle hypothèse sur l'identité de la principale défunte est aujourd'hui la plus acceptée ?$t$,
    explanation = $t$La tombe d'Oseberg (fouillée en {1904}) contenait un navire de 22 mètres, deux femmes (l'une âgée, l'autre jeune), et une richesse matérielle extraordinaire. La femme plus âgée présente des signes de haute noblesse ou de statut sacerdotal. Le contenu — seau de cannabis, plantes hallucinogènes, bâton de voyante — a conduit Neil Price et d'autres chercheurs à identifier la défunte principale comme une völva, chamane de haut rang dans la société nordique.$t$
  WHERE id = 260
    AND lore_text IS NOT DISTINCT FROM $t$Le rituel funéraire nordique le plus élaboré n'était pas toujours la crémation sur bateau. L'archéologie révèle une grande diversité de pratiques, dont certaines inhumations de femmes de haut rang avec du matériel exceptionnel.$t$
    AND question IS NOT DISTINCT FROM $t$La tombe d'Oseberg (Norvège, 834 ap. J.-C.) contenait deux femmes et un navire intact. Quelle hypothèse sur l'identité de la principale défunte est aujourd'hui la plus acceptée ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La tombe d'Oseberg (fouillée en 1904) contenait un navire de 22 mètres, deux femmes (l'une âgée, l'autre jeune), et une richesse matérielle extraordinaire. La femme plus âgée présente des signes de haute noblesse ou de statut sacerdotal. Le contenu — seau de cannabis, plantes hallucinogènes, bâton de voyante — a conduit Neil Price et d'autres chercheurs à identifier la défunte principale comme une völva, chamane de haut rang dans la société nordique.$t$
    AND answer IS NOT DISTINCT FROM $t$Une völva (voyante-chamane)$t$
    AND choices IS NOT DISTINCT FROM $t$["Une reine consort","Une völva (voyante-chamane)","Une valkyrie divinisée","Une marchande de luxe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La grande armée viking (Micel Here) qui débarqua en Angleterre en {865} ne venait pas piller et repartir — elle cherchait à conquérir. En quelques années, elle mit à bas trois royaumes anglo-saxons.$t$,
    question = $t$Qui était le chef légendaire de cette Grande Armée Danoise de {865}, fils de Ragnar selon la tradition ?$t$,
    explanation = $t$Ivar le Désossé (Ívarr hinn Beinlausi) est mentionné dans les sagas comme le stratège principal de la Grande Armée Danoise. Son surnom énigmatique ("désossé") pourrait désigner une maladie osseuse, une souplesse exceptionnelle, ou être une métaphore poétique de sa cruauté. Il fut l'un des architectes de la chute de Northumbrie ({867}) et fit exécuter le roi Ælla par le rituel du "l'aigle de sang" selon les sagas. L'historicité de certains éléments reste débattue.$t$
  WHERE id = 262
    AND lore_text IS NOT DISTINCT FROM $t$La grande armée viking (Micel Here) qui débarqua en Angleterre en 865 ne venait pas piller et repartir — elle cherchait à conquérir. En quelques années, elle mit à bas trois royaumes anglo-saxons.$t$
    AND question IS NOT DISTINCT FROM $t$Qui était le chef légendaire de cette Grande Armée Danoise de 865, fils de Ragnar selon la tradition ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Ivar le Désossé (Ívarr hinn Beinlausi) est mentionné dans les sagas comme le stratège principal de la Grande Armée Danoise. Son surnom énigmatique ("désossé") pourrait désigner une maladie osseuse, une souplesse exceptionnelle, ou être une métaphore poétique de sa cruauté. Il fut l'un des architectes de la chute de Northumbrie (867) et fit exécuter le roi Ælla par le rituel du "l'aigle de sang" selon les sagas. L'historicité de certains éléments reste débattue.$t$
    AND answer IS NOT DISTINCT FROM $t$Ivar le Désossé$t$
    AND choices IS NOT DISTINCT FROM $t$["Sigurd Serpent-dans-l'Œil","Ivar le Désossé","Halfdan Ragnarsson","Björn Côte-de-Fer"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Combien de runes compte le Futhark ancien (Elder Futhark), utilisé jusqu'au {VIIIe siècle} environ ?$t$,
    explanation = $t$Le Futhark ancien (Elder Futhark) comprend 24 runes, réparties en trois groupes de 8 (les ættir). C'est le système runique le plus répandu en Europe du Nord entre le {IIe siècle} et le {VIIIe siècle}, attesté sur des objets allant de la Scandinavie à l'Europe centrale. Au {VIIIe siècle}, il fut réduit au Younger Futhark (16 runes) en Scandinavie — paradoxalement, une simplification qui coïncide avec l'âge des Vikings. L'Anglo-Saxon Futhorc étendit le système à 28-33 runes.$t$
  WHERE id = 263
    AND lore_text IS NOT DISTINCT FROM $t$Les runes ne sont pas qu'un alphabet — elles sont une cosmologie. Chaque rune porte un nom, un poème associé, et des usages magiques codifiés. Mais les systèmes runiques diffèrent selon les époques et les régions.$t$
    AND question IS NOT DISTINCT FROM $t$Combien de runes compte le Futhark ancien (Elder Futhark), utilisé jusqu'au VIIIe siècle environ ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Futhark ancien (Elder Futhark) comprend 24 runes, réparties en trois groupes de 8 (les ættir). C'est le système runique le plus répandu en Europe du Nord entre le IIe et le VIIIe siècle, attesté sur des objets allant de la Scandinavie à l'Europe centrale. Au VIIIe siècle, il fut réduit au Younger Futhark (16 runes) en Scandinavie — paradoxalement, une simplification qui coïncide avec l'âge des Vikings. L'Anglo-Saxon Futhorc étendit le système à 28-33 runes.$t$
    AND answer IS NOT DISTINCT FROM $t$24$t$
    AND choices IS NOT DISTINCT FROM $t$["16","24","33","18"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Le siège de Paris par les Vikings en {885}-{886} est l'un des événements fondateurs de la France. La résistance de la ville contre une flotte immense décida du sort de la Francie occidentale.$t$,
    question = $t$Quel comte carolingien défendit Paris contre le siège viking de {885}-{886} et devint une légende de son vivant ?$t$,
    explanation = $t$Eudes (Odo), comte de Paris, mena la défense héroïque de la ville contre la flotte de Sigfried et Rollo pendant plus d'un an. Quand Charles le Gros (roi carolingien) arriva avec son armée et préféra payer les Vikings plutôt que les combattre, sa réputation s'effondra. Eudes devint tellement populaire qu'il fut élu roi de Francie occidentale en {888} — premier roi non carolingien. Sa famille donnera plus tard les Capétiens.$t$
  WHERE id = 264
    AND lore_text IS NOT DISTINCT FROM $t$Le siège de Paris par les Vikings en 885-886 est l'un des événements fondateurs de la France. La résistance de la ville contre une flotte immense décida du sort de la Francie occidentale.$t$
    AND question IS NOT DISTINCT FROM $t$Quel comte carolingien défendit Paris contre le siège viking de 885-886 et devint une légende de son vivant ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Eudes (Odo), comte de Paris, mena la défense héroïque de la ville contre la flotte de Sigfried et Rollo pendant plus d'un an. Quand Charles le Gros (roi carolingien) arriva avec son armée et préféra payer les Vikings plutôt que les combattre, sa réputation s'effondra. Eudes devint tellement populaire qu'il fut élu roi de Francie occidentale en 888 — premier roi non carolingien. Sa famille donnera plus tard les Capétiens.$t$
    AND answer IS NOT DISTINCT FROM $t$Eudes de Paris$t$
    AND choices IS NOT DISTINCT FROM $t$["Robert le Fort","Eudes de Paris","Charles le Gros","Hugues l'Abbé"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Harald à la Belle Chevelure n'unifia pas la Norvège par la diplomatie — mais par la conquête. Sa victoire lors d'une bataille navale décisive scella l'unification du pays vers {872}.$t$,
    question = $t$Lors de quelle bataille navale Harald Hårfagre unifia-t-il la Norvège vers {872} ?$t$,
    explanation = $t$La bataille de Hafrsfjord (près de Stavanger) vers {872} opposa Harald Hårfagre à une coalition de rois régionaux norvégiens. Sa victoire lui permit de contrôler l'ensemble du pays. Selon Snorri Sturluson, Harald avait promis de ne pas couper ses cheveux avant d'avoir unifié la Norvège — d'où son surnom. L'émigration massive vers l'Islande qui suivit fut partiellement provoquée par le refus de nombreux chefs de se soumettre à son autorité.$t$
  WHERE id = 265
    AND lore_text IS NOT DISTINCT FROM $t$Harald à la Belle Chevelure n'unifia pas la Norvège par la diplomatie — mais par la conquête. Sa victoire lors d'une bataille navale décisive scella l'unification du pays vers 872.$t$
    AND question IS NOT DISTINCT FROM $t$Lors de quelle bataille navale Harald Hårfagre unifia-t-il la Norvège vers 872 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille de Hafrsfjord (près de Stavanger) vers 872 opposa Harald Hårfagre à une coalition de rois régionaux norvégiens. Sa victoire lui permit de contrôler l'ensemble du pays. Selon Snorri Sturluson, Harald avait promis de ne pas couper ses cheveux avant d'avoir unifié la Norvège — d'où son surnom. L'émigration massive vers l'Islande qui suivit fut partiellement provoquée par le refus de nombreux chefs de se soumettre à son autorité.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Hafrsfjord$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Hafrsfjord","Bataille de Stiklestad","Bataille de Svolder","Bataille de Bråvalla"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$L'archéologie nordique a mis au jour une figure de proue de bateau exceptionnelle, sculptée avec une sophistication qui stupéfia les historiens de l'art. Elle fut découverte dans un marais irlandais au {XIXe siècle}.$t$,
    question = $t$Quel trésor archéologique viking, découvert à Killaloe en Irlande en {1840}, représente une tête de dragon en bois sculpté ?$t$,
    explanation = $t$La figure de proue de Lough Derg (Killaloe, Irlande), découverte en {1840} dans le lac, est l'un des rares exemples de sculpture sur bois viking conservée. Elle date probablement du {Xe siècle} et représente une tête zoomorphe finement décorée de style Ringerike. Les bois celtes conservent les sculptures organiques là où d'autres environnements les détruisent. Ce type de trouvaille permet de comprendre l'art décoratif nordique en dehors des pierres runiques.$t$
  WHERE id = 267
    AND lore_text IS NOT DISTINCT FROM $t$L'archéologie nordique a mis au jour une figure de proue de bateau exceptionnelle, sculptée avec une sophistication qui stupéfia les historiens de l'art. Elle fut découverte dans un marais irlandais au XIXe siècle.$t$
    AND question IS NOT DISTINCT FROM $t$Quel trésor archéologique viking, découvert à Killaloe en Irlande en 1840, représente une tête de dragon en bois sculpté ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La figure de proue de Lough Derg (Killaloe, Irlande), découverte en 1840 dans le lac, est l'un des rares exemples de sculpture sur bois viking conservée. Elle date probablement du Xe siècle et représente une tête zoomorphe finement décorée de style Ringerike. Les bois celtes conservent les sculptures organiques là où d'autres environnements les détruisent. Ce type de trouvaille permet de comprendre l'art décoratif nordique en dehors des pierres runiques.$t$
    AND answer IS NOT DISTINCT FROM $t$La figure de Lough Derg$t$
    AND choices IS NOT DISTINCT FROM $t$["La tête de Borre","La tête de Ringerike","La figure de Scheibe","La figure de Lough Derg"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle armée mit définitivement fin à la ville de Hedeby en la brûlant vers {1050} ?$t$,
    explanation = $t$Hedeby fut pillée et brûlée par Harald Hardrada (Harald III de Norvège) vers {1049}-{1050}, lors d'un conflit avec le roi danois Sven Estridsen. La ville, déjà affaiblie par des raids précédents (notamment des Obodrites vers {983} et un incendie de {1000}), ne se releva pas. La population migra vers Schleswig, de l'autre côté du fjord. Les fouilles d'Hedeby ont mis au jour des artefacts de toute l'Europe : soie de Byzance, épices d'Orient, verre rhénan.$t$
  WHERE id = 268
    AND lore_text IS NOT DISTINCT FROM $t$La ville de Hedeby (Haithabu), sur le territoire du Danemark actuel, était l'une des plus grandes villes du monde viking — un carrefour commercial entre mer du Nord et Baltique, entre Francie et Scandinavie.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle armée mit définitivement fin à la ville de Hedeby en la brûlant vers 1050 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Hedeby fut pillée et brûlée par Harald Hardrada (Harald III de Norvège) vers 1049-1050, lors d'un conflit avec le roi danois Sven Estridsen. La ville, déjà affaiblie par des raids précédents (notamment des Obodrites vers 983 et un incendie de 1000), ne se releva pas. La population migra vers Schleswig, de l'autre côté du fjord. Les fouilles d'Hedeby ont mis au jour des artefacts de toute l'Europe : soie de Byzance, épices d'Orient, verre rhénan.$t$
    AND answer IS NOT DISTINCT FROM $t$L'armée norvégienne de Harald Hardrada$t$
    AND choices IS NOT DISTINCT FROM $t$["L'armée norvégienne de Harald Hardrada","Les Slaves Obodrites","L'armée des Croisés","Les Saxons de l'Empire"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel général romain reforma l'armée vers {107 av. J.-C.} en ouvrant le service aux citoyens sans propriété (capite censi) ?$t$,
    explanation = $t$La réforme de Marius ({107 av. J.-C.}) permit aux capite censi — citoyens trop pauvres pour s'équiper eux-mêmes — de rejoindre les légions, l'équipement étant fourni par l'État. En contrepartie, ces soldats devinrent fidèles à leur général plutôt qu'à Rome, puisque c'est lui qui garantissait leur solde et leur retraite (une concession de terres). Cette transformation explique directement les guerres civiles du {Ier siècle av. J.-C.} : Marius lui-même l'utilisa le premier.$t$
  WHERE id = 270
    AND lore_text IS NOT DISTINCT FROM $t$La réforme militaire qui transforma l'armée romaine d'une milice de citoyens propriétaires en une armée professionnelle des pauvres fut l'une des plus lourdes de conséquences de toute l'histoire de Rome.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général romain reforma l'armée vers 107 av. J.-C. en ouvrant le service aux citoyens sans propriété (capite censi) ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La réforme de Marius (107 av. J.-C.) permit aux capite censi — citoyens trop pauvres pour s'équiper eux-mêmes — de rejoindre les légions, l'équipement étant fourni par l'État. En contrepartie, ces soldats devinrent fidèles à leur général plutôt qu'à Rome, puisque c'est lui qui garantissait leur solde et leur retraite (une concession de terres). Cette transformation explique directement les guerres civiles du Ier siècle av. J.-C. : Marius lui-même l'utilisa le premier.$t$
    AND answer IS NOT DISTINCT FROM $t$Caius Marius$t$
    AND choices IS NOT DISTINCT FROM $t$["Scipion l'Africain","Caius Marius","Sylla","Pompée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle légion romaine est associée à l'épisode du « Miracle de la Pluie » — une pluie providentielle sauvant les soldats assoiffés — sous Marc Aurèle vers {172 ap. J.-C.} ?$t$
  WHERE id = 271
    AND lore_text IS NOT DISTINCT FROM $t$Les Romains classifiaient leurs légions avec une précision maniaque — numéros, cognomina, symboles animaux. Certaines légions portaient des numéros identiques à d'autres en simultané, ce qui confond encore les historiens.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle légion romaine est associée à l'épisode du « Miracle de la Pluie » — une pluie providentielle sauvant les soldats assoiffés — sous Marc Aurèle vers 172 ap. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La Legio XII Fulminata est au cœur du "Miracle de la Pluie" (Columna de Marc Aurèle, colonne de Trajan) : assoiffée lors d'une campagne contre les Quades, la légion aurait été sauvée par une pluie providentielle. Chrétiens et partisans des cultes romains se disputaient la paternité du miracle. Tertullien l'attribuait à des soldats chrétiens en prière ; les sources officielles à Jupiter ou à des pratiques égyptiennes. La Legio XII est attestée en Orient depuis Auguste.$t$
    AND answer IS NOT DISTINCT FROM $t$Legio XII Fulminata$t$
    AND choices IS NOT DISTINCT FROM $t$["Legio XII Fulminata","Legio III Augusta","Legio X Gemina","Legio I Adiutrix"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Sous quel empereur fut compilé le Corpus Juris Civilis, la codification majeure du droit romain, au {VIe siècle} ?$t$,
    explanation = $t$Le Corpus Juris Civilis fut compilé entre {529} et {534} sous Justinien Ier, par une commission dirigée par le juriste Tribonien. Il comprend le Code (constitutions impériales), le Digeste (jurisprudence classique), les Institutes (manuel) et les Novelles (nouvelles lois). Justinien, natif d'Illyrie latinophone, parlait le grec comme langue de cour — son empire était en réalité grec dans sa culture quotidienne. Le Corpus est le fondement de la quasi-totalité des systèmes juridiques européens continentaux.$t$
  WHERE id = 272
    AND lore_text IS NOT DISTINCT FROM $t$Le droit romain est l'une des contributions intellectuelles les plus durables de Rome — mais sa codification définitive n'eut lieu que sous un empereur qui ne parlait pas latin couramment.$t$
    AND question IS NOT DISTINCT FROM $t$Sous quel empereur fut compilé le Corpus Juris Civilis, la codification majeure du droit romain, au VIe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Corpus Juris Civilis fut compilé entre 529 et 534 sous Justinien Ier, par une commission dirigée par le juriste Tribonien. Il comprend le Code (constitutions impériales), le Digeste (jurisprudence classique), les Institutes (manuel) et les Novelles (nouvelles lois). Justinien, natif d'Illyrie latinophone, parlait le grec comme langue de cour — son empire était en réalité grec dans sa culture quotidienne. Le Corpus est le fondement de la quasi-totalité des systèmes juridiques européens continentaux.$t$
    AND answer IS NOT DISTINCT FROM $t$Justinien Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Théodose II","Justinien Ier","Dioclétien","Constantin Ier"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La tradition romaine (Tite-Live, Denys d'Halicarnasse) fixe la fondation de la République en {509 av. J.-C.}, après l'expulsion de Tarquin le Superbe par Brutus et ses alliés, en réaction au viol de Lucrèce par le fils du roi. Cette date, bien que symbolique et peut-être partiellement légendaire, est ancrée dans la conscience romaine : l'interdiction du titre de "roi" (rex) dura jusqu'à la fin de Rome. César fut assassiné en partie parce qu'on le soupçonnait de vouloir ce titre.$t$,
    answer = $t${509 av. J.-C.}$t$,
    choices = $t$["{509 av. J.-C.}","{476 av. J.-C.}","{264 av. J.-C.}","{753 av. J.-C.}"]$t$::jsonb
  WHERE id = 273
    AND lore_text IS NOT DISTINCT FROM $t$Rome n'a pas toujours été une République, ni toujours un Empire. Entre la royauté légendaire et la République, une transition violente eut lieu qui imprima durablement la haine des rois dans l'ADN politique romain.$t$
    AND question IS NOT DISTINCT FROM $t$En quelle année traditionnelle les Romains chassèrent-ils leur dernier roi Tarquin le Superbe, fondant la République ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La tradition romaine (Tite-Live, Denys d'Halicarnasse) fixe la fondation de la République en 509 av. J.-C., après l'expulsion de Tarquin le Superbe par Brutus et ses alliés, en réaction au viol de Lucrèce par le fils du roi. Cette date, bien que symbolique et peut-être partiellement légendaire, est ancrée dans la conscience romaine : l'interdiction du titre de "roi" (rex) dura jusqu'à la fin de Rome. César fut assassiné en partie parce qu'on le soupçonnait de vouloir ce titre.$t$
    AND answer IS NOT DISTINCT FROM $t$509 av. J.-C.$t$
    AND choices IS NOT DISTINCT FROM $t$["509 av. J.-C.","476 av. J.-C.","264 av. J.-C.","753 av. J.-C."]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Où mourut l'empereur Julien, dit "l'Apostat", en {363 ap. J.-C.} ?$t$,
    explanation = $t$Julien (l'Apostat) mourut le 26 juin {363}, frappé d'une lance lors de la retraite de son armée après l'échec à prendre Ctésiphon (capitale sassanide, dans l'Iraq actuel). Ses hommes avaient brûlé la flotte romaine pour couper la retraite — une décision catastrophique. Julien refusa les médecins et mourut en philosophe, selon ses biographes. Ammien Marcellin, présent lors de la campagne, en donne un récit détaillé. Jovien lui succéda et signa une paix humiliante avec les Perses.$t$
  WHERE id = 275
    AND lore_text IS NOT DISTINCT FROM $t$Certains empereurs romains ne moururent pas à Rome — ni même en Italie. L'Empire était si vaste que ses maîtres passaient parfois toute leur règne en campagne, mourant sur les marches d'un monde inconnu.$t$
    AND question IS NOT DISTINCT FROM $t$Où mourut l'empereur Julien, dit "l'Apostat", en 363 ap. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Julien (l'Apostat) mourut le 26 juin 363, frappé d'une lance lors de la retraite de son armée après l'échec à prendre Ctésiphon (capitale sassanide, dans l'Iraq actuel). Ses hommes avaient brûlé la flotte romaine pour couper la retraite — une décision catastrophique. Julien refusa les médecins et mourut en philosophe, selon ses biographes. Ammien Marcellin, présent lors de la campagne, en donne un récit détaillé. Jovien lui succéda et signa une paix humiliante avec les Perses.$t$
    AND answer IS NOT DISTINCT FROM $t$En Perse, lors de la retraite après sa campagne contre Ctésiphon$t$
    AND choices IS NOT DISTINCT FROM $t$["En Perse, lors de la retraite après sa campagne contre Ctésiphon","En Gaule, lors d'une rébellion","À Constantinople, de maladie","En Bretagne, lors d'une campagne contre les Pictes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'aqueduc de Zaghouan (ou aqueduc de Carthage), construit sous Hadrien et Antonin le Pieux ({IIe siècle}), s'étendait sur environ 132 km depuis les sources du Jebel Zaghouan jusqu'à Carthage — le plus long aqueduc romain connu. Il alimentait les thermes d'Antonin, parmi les plus grands de l'Empire. Des vestiges importants subsistent en Tunisie. L'aqua Claudia (Rome) et l'aqueduc de Valens (Constantinople) sont également remarquables mais plus courts.$t$
  WHERE id = 276
    AND lore_text IS NOT DISTINCT FROM $t$L'aqueduc romain n'est pas seulement un chef-d'œuvre hydraulique — c'est un système politique. L'accès à l'eau conditionnait la hiérarchie sociale des villes romaines, avec des droits d'eau accordés comme privilèges impériaux.$t$
    AND question IS NOT DISTINCT FROM $t$Quel aqueduc romain, le plus long jamais construit, atteignait 132 km de longueur pour alimenter Carthage en Afrique du Nord ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'aqueduc de Zaghouan (ou aqueduc de Carthage), construit sous Hadrien et Antonin le Pieux (IIe siècle), s'étendait sur environ 132 km depuis les sources du Jebel Zaghouan jusqu'à Carthage — le plus long aqueduc romain connu. Il alimentait les thermes d'Antonin, parmi les plus grands de l'Empire. Des vestiges importants subsistent en Tunisie. L'aqua Claudia (Rome) et l'aqueduc de Valens (Constantinople) sont également remarquables mais plus courts.$t$
    AND answer IS NOT DISTINCT FROM $t$Aqueduc de Zaghouan$t$
    AND choices IS NOT DISTINCT FROM $t$["Aqueduc de Zaghouan","Aqueduc de Carthage","Aqua Claudia","Aqueduc de Valens"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Lors de la bataille d'Actium ({31 av. J.-C.}), quel était le général commandant les forces d'Antoine et de Cléopâtre, qui trahit en traversant avec ses navires vers Auguste ?$t$
  WHERE id = 277
    AND lore_text IS NOT DISTINCT FROM $t$La bataille qui mit fin à la République romaine ne fut pas Actium — ce fut une série de batailles. Mais Actium scella définitivement la victoire d'Auguste sur son dernier rival.$t$
    AND question IS NOT DISTINCT FROM $t$Lors de la bataille d'Actium (31 av. J.-C.), quel était le général commandant les forces d'Antoine et de Cléopâtre, qui trahit en traversant avec ses navires vers Auguste ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gnaeus Domitius Ahenobarbus (arrière-grand-père de Néron) commanda une partie de la flotte d'Antoine et déserta vers Octave peu avant la bataille d'Actium, malade et désenchanté par la politique orientale d'Antoine. Agrippa commandait la flotte d'Octave — c'est lui le vrai vainqueur naval d'Actium. Quintus Dellius avait trahi encore plus tôt. La bataille réelle fut peut-être moins héroïque qu'on ne le dit : la fuite de Cléopâtre et d'Antoine décida du sort avant même la fin des combats.$t$
    AND answer IS NOT DISTINCT FROM $t$Ahenobarbus$t$
    AND choices IS NOT DISTINCT FROM $t$["Quintus Dellius","Agrippa","Ahenobarbus","Canidius Crassus"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Combien de combattants Suétone dit-il que César engagea dans la première grande naumachie romaine organisée en {46 av. J.-C.} ?$t$,
    explanation = $t$Suétone (Vie de César, 39) indique que César fit creuser un lac artificiel dans le Champ de Mars pour sa naumachie de {46 av. J.-C.}, qui opposa des trirèmes et quadrirèmes tyriennes contre égyptiennes, avec 4 000 rameurs et 1 000 combattants selon certaines sources — mais d'autres références antiques évoquent jusqu'à 16 000 participants (rameurs inclus). C'est la première naumachie romaine attestée à grande échelle. Auguste, Claude et Domitien en organisèrent d'autres encore plus spectaculaires.$t$
  WHERE id = 278
    AND lore_text IS NOT DISTINCT FROM $t$Les Romains appelaient "naumachie" une reconstitution navale de bataille — un spectacle si coûteux et complexe qu'il était réservé aux occasions les plus exceptionnelles de l'histoire impériale.$t$
    AND question IS NOT DISTINCT FROM $t$Combien de combattants Suétone dit-il que César engagea dans la première grande naumachie romaine organisée en 46 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Suétone (Vie de César, 39) indique que César fit creuser un lac artificiel dans le Champ de Mars pour sa naumachie de 46 av. J.-C., qui opposa des trirèmes et quadrirèmes tyriennes contre égyptiennes, avec 4 000 rameurs et 1 000 combattants selon certaines sources — mais d'autres références antiques évoquent jusqu'à 16 000 participants (rameurs inclus). C'est la première naumachie romaine attestée à grande échelle. Auguste, Claude et Domitien en organisèrent d'autres encore plus spectaculaires.$t$
    AND answer IS NOT DISTINCT FROM $t$16 000 hommes$t$
    AND choices IS NOT DISTINCT FROM $t$["4 000 rameurs et 1 000 combattants","6 000 hommes","16 000 hommes","2 000 gladiateurs"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La pouzzolane (pulvis puteolanus, "poussière de Pouzzoles") est une cendre volcanique riche en silicates alumineux qui réagit avec la chaux et l'eau pour former un ciment hydraulique — capable de durcir même sous l'eau. Vitruve (De Architectura) en décrit l'usage. Des études récentes ({2017}, UC Berkeley) ont montré que les cristaux d'aluminosilicate de tobermorite qui se forment dans le béton romain au fil des siècles le rendent plus résistant avec le temps, contrairement au béton Portland moderne qui se dégrade.$t$
  WHERE id = 280
    AND lore_text IS NOT DISTINCT FROM $t$Le ciment romain (opus caementicium) est un mystère de la technologie ancienne — ses formules permettaient de construire sous l'eau et de résister aux séismes mieux que certains bétons modernes.$t$
    AND question IS NOT DISTINCT FROM $t$Quel ingrédient volcanique spécifique, extrait des environs de Pouzzoles (Campanie), donnait au ciment romain sa résistance à l'eau ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La pouzzolane (pulvis puteolanus, "poussière de Pouzzoles") est une cendre volcanique riche en silicates alumineux qui réagit avec la chaux et l'eau pour former un ciment hydraulique — capable de durcir même sous l'eau. Vitruve (De Architectura) en décrit l'usage. Des études récentes (2017, UC Berkeley) ont montré que les cristaux d'aluminosilicate de tobermorite qui se forment dans le béton romain au fil des siècles le rendent plus résistant avec le temps, contrairement au béton Portland moderne qui se dégrade.$t$
    AND answer IS NOT DISTINCT FROM $t$La pozzolane$t$
    AND choices IS NOT DISTINCT FROM $t$["La pozzolane","La chaux vive","Le tuf volcanique","Le basalte"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Auguste fit construire le temple de Mars Ultor ("Mars le Vengeur") sur le Forum d'Auguste, promis après la bataille de Philippes ({42 av. J.-C.}) où il vengea César. Mais le culte dynastique de Vénus Genetrix (Vénus mère, ancêtre de la gens Julia) avait été établi par César lui-même sur le Forum de César. Auguste joua des deux références divines : Vénus pour la légitimité julienne, Mars pour la légitimité militaire. L'Ara Pacis combina les deux thèmes dans la sculpture officielle.$t$
  WHERE id = 282
    AND lore_text IS NOT DISTINCT FROM $t$La gens Julia prétendait descendre d'Énée, fils de la déesse Vénus. Cette généalogie divine était un instrument politique autant qu'une conviction religieuse — Auguste l'exploita habilement.$t$
    AND question IS NOT DISTINCT FROM $t$Quel culte Auguste établit-il à Rome pour honorer l'ancêtre divin de la gens Julia, en construisant un temple sur le Forum d'Auguste ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Auguste fit construire le temple de Mars Ultor ("Mars le Vengeur") sur le Forum d'Auguste, promis après la bataille de Philippes (42 av. J.-C.) où il vengea César. Mais le culte dynastique de Vénus Genetrix (Vénus mère, ancêtre de la gens Julia) avait été établi par César lui-même sur le Forum de César. Auguste joua des deux références divines : Vénus pour la légitimité julienne, Mars pour la légitimité militaire. L'Ara Pacis combina les deux thèmes dans la sculpture officielle.$t$
    AND answer IS NOT DISTINCT FROM $t$Mars Ultor$t$
    AND choices IS NOT DISTINCT FROM $t$["Mars Ultor","Vénus Genetrix","Apollon Palatin","Jupiter Capitolin"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La période des "empereurs-soldats" ({235 ap. J.-C.}-{284 ap. J.-C.}) vit Rome traverser une crise d'une violence exceptionnelle — des dizaines d'empereurs en cinquante ans, la plupart assassinés.$t$,
    question = $t$Quel est l'unique "empereur-soldat" de la période {235}-{284} à avoir abdiqué volontairement et survécu pour cultiver ses choux ?$t$,
    explanation = $t$Dioclétien (règne {284}-{305}) est le seul des empereurs de la crise du {IIIe siècle} à avoir abdiqué volontairement (1er mai {305}), se retirant dans son palais de Split (Croatie actuelle). À des courtisans qui le suppliaient de reprendre le pouvoir, il répondit — selon une anecdote peut-être apocryphe mais célèbre — qu'ils devraient voir les choux qu'il cultivait. La crise des empereurs-soldats ({235}-{284}) vit 26 empereurs reconnus, presque tous assassinés. Dioclétien réorganisa l'Empire en tétrarchie.$t$
  WHERE id = 283
    AND lore_text IS NOT DISTINCT FROM $t$La période des "empereurs-soldats" (235-284 ap. J.-C.) vit Rome traverser une crise d'une violence exceptionnelle — des dizaines d'empereurs en cinquante ans, la plupart assassinés.$t$
    AND question IS NOT DISTINCT FROM $t$Quel est l'unique "empereur-soldat" de la période 235-284 à avoir abdiqué volontairement et survécu pour cultiver ses choux ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Dioclétien (règne 284-305) est le seul des empereurs de la crise du IIIe siècle à avoir abdiqué volontairement (1er mai 305), se retirant dans son palais de Split (Croatie actuelle). À des courtisans qui le suppliaient de reprendre le pouvoir, il répondit — selon une anecdote peut-être apocryphe mais célèbre — qu'ils devraient voir les choux qu'il cultivait. La crise des empereurs-soldats (235-284) vit 26 empereurs reconnus, presque tous assassinés. Dioclétien réorganisa l'Empire en tétrarchie.$t$
    AND answer IS NOT DISTINCT FROM $t$Dioclétien$t$
    AND choices IS NOT DISTINCT FROM $t$["Aurélien","Dioclétien","Gallien","Dèce"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Lors de quel siège le feu grégeois fit-il pour la première fois la preuve de son efficacité décisive, anéantissant une flotte qui assaillait Constantinople au {VIIe siècle} ?$t$,
    explanation = $t$C'est lors du premier grand siège arabe de Constantinople ({672}-{678}) que le feu grégeois, inventé selon la tradition par Callínicos d'Héliopolis (un ingénieur grec réfugié de Syrie), fut utilisé contre la flotte omeyyade. L'amiral arabe fut repoussé avec de lourdes pertes. La composition exacte du feu grégeois reste inconnue (probablement naphte, chaux vive, résine), mais il brûlait sur l'eau et ne pouvait être éteint — ce qui en faisait une arme psychologique autant que militaire.$t$,
    answer = $t$Premier siège arabe de Constantinople ({672}-{678})$t$,
    choices = $t$["Premier siège arabe de Constantinople ({672}-{678})","Siège de Thessalonique ({904})","Siège de Syracuse ({827})","Siège de Dorostolon ({971})"]$t$::jsonb
  WHERE id = 286
    AND lore_text IS NOT DISTINCT FROM $t$Le feu grégeois reste l'une des armes les plus mystérieuses de l'histoire militaire. Son secret, jalousement gardé par Constantinople, lui permit de survivre à des assauts navals qui auraient détruit tout autre empire.$t$
    AND question IS NOT DISTINCT FROM $t$Lors de quel siège le feu grégeois fit-il pour la première fois la preuve de son efficacité décisive, anéantissant une flotte qui assaillait Constantinople au VIIe siècle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$C'est lors du premier grand siège arabe de Constantinople (672-678) que le feu grégeois, inventé selon la tradition par Callínicos d'Héliopolis (un ingénieur grec réfugié de Syrie), fut utilisé contre la flotte omeyyade. L'amiral arabe fut repoussé avec de lourdes pertes. La composition exacte du feu grégeois reste inconnue (probablement naphte, chaux vive, résine), mais il brûlait sur l'eau et ne pouvait être éteint — ce qui en faisait une arme psychologique autant que militaire.$t$
    AND answer IS NOT DISTINCT FROM $t$Premier siège arabe de Constantinople (672-678)$t$
    AND choices IS NOT DISTINCT FROM $t$["Premier siège arabe de Constantinople (672-678)","Siège de Thessalonique (904)","Siège de Syracuse (827)","Siège de Dorostolon (971)"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Concile de Nicée II (7e concile œcuménique, {787}) présidé par la régente Irène d'Athènes restaura le culte des icônes, distinguant la "vénération" (proskynesis) de l'"adoration" (latrie) réservée à Dieu seul. La seconde iconoclasie éclata en {815} sous Léon V l'Arménien et prit fin définitivement en {843} — date célébrée comme le "Triomphe de l'Orthodoxie" dans l'Église orthodoxe jusqu'à aujourd'hui. L'icône de la Vierge Hodegetria fut au cœur de ces conflits.$t$,
    answer = $t${787}$t$,
    choices = $t$["{787}","{843}","{726}","{815}"]$t$::jsonb
  WHERE id = 287
    AND lore_text IS NOT DISTINCT FROM $t$La querelle iconoclaste déchira l'Empire byzantin pendant plus d'un siècle, mêlant théologie, politique impériale et pression islamique. Elle eut deux phases distinctes, séparées par une restauration orthodoxe.$t$
    AND question IS NOT DISTINCT FROM $t$En quelle année le Concile de Nicée II restaura-t-il officiellement le culte des images dans l'Empire byzantin, mettant fin à la première iconoclasie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Concile de Nicée II (7e concile œcuménique, 787) présidé par la régente Irène d'Athènes restaura le culte des icônes, distinguant la "vénération" (proskynesis) de l'"adoration" (latrie) réservée à Dieu seul. La seconde iconoclasie éclata en 815 sous Léon V l'Arménien et prit fin définitivement en 843 — date célébrée comme le "Triomphe de l'Orthodoxie" dans l'Église orthodoxe jusqu'à aujourd'hui. L'icône de la Vierge Hodegetria fut au cœur de ces conflits.$t$
    AND answer IS NOT DISTINCT FROM $t$787$t$
    AND choices IS NOT DISTINCT FROM $t$["787","843","726","815"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Byzance ne se contentait pas de résister — elle reconquérait. Le {Xe siècle} fut un âge d'or militaire, avec des généraux qui repoussèrent les frontières de l'Empire jusqu'en Syrie et en Mésopotamie.$t$,
    question = $t$Quel général byzantin, surnommé « Pâle-de-Mort », reconquit la Crète aux Arabes en {961} avant de ceindre lui-même la couronne impériale ?$t$,
    explanation = $t$Niképhore Phokas (futur Niképhore II, r. {963}-{969}) reconquit la Crète en {961} après un siège de plusieurs mois d'Héraklion (Chandax), mettant fin à 135 ans de domination arabe sur l'île. Il reconquit ensuite Chypre et Cilicie, et ses campagnes syriennes atteignirent Alep. Il devint empereur en {963} et fut assassiné en {969} par son neveu Jean Tzimiskès (avec la complicité de l'impératrice Théophano). Liutprand de Crémone, ambassadeur à Byzance, le décrit avec une antipathie teintée d'admiration.$t$
  WHERE id = 288
    AND lore_text IS NOT DISTINCT FROM $t$Byzance ne se contentait pas de résister — elle reconquérait. Le Xe siècle fut un âge d'or militaire, avec des généraux qui repoussèrent les frontières de l'Empire jusqu'en Syrie et en Mésopotamie.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général byzantin, surnommé « Pâle-de-Mort », reconquit la Crète aux Arabes en 961 avant de ceindre lui-même la couronne impériale ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Niképhore Phokas (futur Niképhore II, r. 963-969) reconquit la Crète en 961 après un siège de plusieurs mois d'Héraklion (Chandax), mettant fin à 135 ans de domination arabe sur l'île. Il reconquit ensuite Chypre et Cilicie, et ses campagnes syriennes atteignirent Alep. Il devint empereur en 963 et fut assassiné en 969 par son neveu Jean Tzimiskès (avec la complicité de l'impératrice Théophano). Liutprand de Crémone, ambassadeur à Byzance, le décrit avec une antipathie teintée d'admiration.$t$
    AND answer IS NOT DISTINCT FROM $t$Niképhore II Phokas$t$
    AND choices IS NOT DISTINCT FROM $t$["Jean Tzimiskès","Niképhore II Phokas","Basile II","Bardas Sklèros"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Basile II, menacé par la rébellion de Bardas Phocas, demanda l'aide de Vladimir Ier de Kiev (le Grand). Vladimir envoya 6 000 Varègues en échange de la main de la princesse Anne (sœur de Basile) — condition extraordinaire pour un "barbare". Ces guerriers aidèrent à écraser la rébellion. Vladimir se convertit au christianisme orthodoxe ({988}) et fit baptiser la Rus' de Kiev — décision aux conséquences historiques incalculables pour la civilisation russe.$t$,
    answer = $t$En {988}, à la suite de l'alliance avec Vladimir de Kiev$t$,
    choices = $t$["En {988}, à la suite de l'alliance avec Vladimir de Kiev","En {1000}, après la conquête bulgare","En {960}, lors de la campagne de Crète","En {1025}, à la mort de Basile II"]$t$::jsonb
  WHERE id = 289
    AND lore_text IS NOT DISTINCT FROM $t$La garde varègue de Constantinople était l'élite personnelle des empereurs byzantins — des guerriers nordiques recrutés pour leur loyauté envers l'or plutôt que pour des liens dynastiques byzantins.$t$
    AND question IS NOT DISTINCT FROM $t$En quelle année et à la suite de quel événement Basile II reçut-il les 6 000 guerriers varègues qui formèrent le noyau de la garde varègue ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Basile II, menacé par la rébellion de Bardas Phocas, demanda l'aide de Vladimir Ier de Kiev (le Grand). Vladimir envoya 6 000 Varègues en échange de la main de la princesse Anne (sœur de Basile) — condition extraordinaire pour un "barbare". Ces guerriers aidèrent à écraser la rébellion. Vladimir se convertit au christianisme orthodoxe (988) et fit baptiser la Rus' de Kiev — décision aux conséquences historiques incalculables pour la civilisation russe.$t$
    AND answer IS NOT DISTINCT FROM $t$En 988, à la suite de l'alliance avec Vladimir de Kiev$t$
    AND choices IS NOT DISTINCT FROM $t$["En 988, à la suite de l'alliance avec Vladimir de Kiev","En 1000, après la conquête bulgare","En 960, lors de la campagne de Crète","En 1025, à la mort de Basile II"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quels missionnaires byzantins créèrent l'alphabet glagolitique pour écrire le slave au {IXe siècle}, ouvrant la voie à la civilisation slave chrétienne ?$t$,
    explanation = $t$Cyrille (Constantin, {826}-{869}) et Méthode ({815}-{885}), frères thessaloniciens envoyés en mission en Moravie en {863}, créèrent le premier alphabet slave : le glagolitique (l'alphabet cyrillique, nommé en l'honneur de Cyrille, fut développé par leurs disciples). Ils traduisirent les Évangiles en vieux-slave liturgique. Leur mission fut contestée par les évêques francs qui exigeaient le latin comme seule langue liturgique — Rome trancha en leur faveur. Ils sont considérés comme les "apôtres des Slaves".$t$
  WHERE id = 290
    AND lore_text IS NOT DISTINCT FROM $t$La diplomatie byzantine était aussi sophistiquée que son armée — peut-être plus. L'Empire convertissait ses voisins au christianisme, créait des alphabets pour les barbares, et piégeait ses ennemis dans des dépendances spirituelles et commerciales.$t$
    AND question IS NOT DISTINCT FROM $t$Quels missionnaires byzantins créèrent l'alphabet glagolitique pour écrire le slave au IXe siècle, ouvrant la voie à la civilisation slave chrétienne ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Cyrille (Constantin, 826-869) et Méthode (815-885), frères thessaloniciens envoyés en mission en Moravie en 863, créèrent le premier alphabet slave : le glagolitique (l'alphabet cyrillique, nommé en l'honneur de Cyrille, fut développé par leurs disciples). Ils traduisirent les Évangiles en vieux-slave liturgique. Leur mission fut contestée par les évêques francs qui exigeaient le latin comme seule langue liturgique — Rome trancha en leur faveur. Ils sont considérés comme les "apôtres des Slaves".$t$
    AND answer IS NOT DISTINCT FROM $t$Cyrille et Méthode$t$
    AND choices IS NOT DISTINCT FROM $t$["Photios et Méthode","Cyrille et Méthode","Clément et Naum","Basile et Méthode"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La chute de Constantinople en {1453} n'était pas inévitable — plusieurs tentatives de sauvetage occidental échouèrent, en partie à cause des divisions religieuses entre orthodoxes et catholiques.$t$,
    question = $t$Quelle bataille de {1444}, si elle avait été une victoire chrétienne, aurait peut-être sauvé Constantinople de la chute ottomane ?$t$,
    explanation = $t$La bataille de Varna (10 novembre {1444}) opposa une croisade chrétienne (Hongrois, Polonais, Valaques, chevaliers occidentaux) à Murad II. La mort du roi Vladislas III de Pologne/Hongrie et la désintégration de la coalition entraînèrent une défaite totale. Constantinople tomba neuf ans plus tard. Si la croisade avait gagné, elle aurait pu consolider les Balkans et peut-être renverser la pression ottomane. La bataille de Nicopolis ({1396}) avait été la première grande défaite croisée dans la région.$t$,
    choices = $t$["Bataille de Varna","Bataille de Kosovo ({1389})","Bataille de Nicopolis","Bataille de Mohács"]$t$::jsonb
  WHERE id = 291
    AND lore_text IS NOT DISTINCT FROM $t$La chute de Constantinople en 1453 n'était pas inévitable — plusieurs tentatives de sauvetage occidental échouèrent, en partie à cause des divisions religieuses entre orthodoxes et catholiques.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille de 1444, si elle avait été une victoire chrétienne, aurait peut-être sauvé Constantinople de la chute ottomane ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille de Varna (10 novembre 1444) opposa une croisade chrétienne (Hongrois, Polonais, Valaques, chevaliers occidentaux) à Murad II. La mort du roi Vladislas III de Pologne/Hongrie et la désintégration de la coalition entraînèrent une défaite totale. Constantinople tomba neuf ans plus tard. Si la croisade avait gagné, elle aurait pu consolider les Balkans et peut-être renverser la pression ottomane. La bataille de Nicopolis (1396) avait été la première grande défaite croisée dans la région.$t$
    AND answer IS NOT DISTINCT FROM $t$Bataille de Varna$t$
    AND choices IS NOT DISTINCT FROM $t$["Bataille de Varna","Bataille de Kosovo (1389)","Bataille de Nicopolis","Bataille de Mohács"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Le schisme de {1054} entre Rome et Constantinople n'est pas une séparation soudaine — il fut la conclusion d'une longue dérive qui dura des siècles. Son acte symbolique fut spectaculairement précis.$t$,
    question = $t$Qui fut le légat papal qui déposa la bulle d'excommunication sur l'autel de Sainte-Sophie en {1054}, provoquant le Grand Schisme ?$t$,
    explanation = $t$Humbert de Moyenmoutier (ou Humbert de Silva Candida), cardinal légat du pape Léon IX (déjà mort à ce moment), déposa une bulle d'excommunication sur l'autel de Sainte-Sophie le 16 juillet {1054}, visant le patriarche Cérulaire. La réponse de Cérulaire fut d'excommunier les légats. Le schisme résulta d'un cumul de griefs : le Filioque (ajout au Credo), la primauté papale, les rites azymes latins vs levés orthodoxes. Il ne fut "formellement" reconnu irréversible que beaucoup plus tard.$t$
  WHERE id = 293
    AND lore_text IS NOT DISTINCT FROM $t$Le schisme de 1054 entre Rome et Constantinople n'est pas une séparation soudaine — il fut la conclusion d'une longue dérive qui dura des siècles. Son acte symbolique fut spectaculairement précis.$t$
    AND question IS NOT DISTINCT FROM $t$Qui fut le légat papal qui déposa la bulle d'excommunication sur l'autel de Sainte-Sophie en 1054, provoquant le Grand Schisme ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Humbert de Moyenmoutier (ou Humbert de Silva Candida), cardinal légat du pape Léon IX (déjà mort à ce moment), déposa une bulle d'excommunication sur l'autel de Sainte-Sophie le 16 juillet 1054, visant le patriarche Cérulaire. La réponse de Cérulaire fut d'excommunier les légats. Le schisme résulta d'un cumul de griefs : le Filioque (ajout au Credo), la primauté papale, les rites azymes latins vs levés orthodoxes. Il ne fut "formellement" reconnu irréversible que beaucoup plus tard.$t$
    AND answer IS NOT DISTINCT FROM $t$Humbert de Moyenmoutier$t$
    AND choices IS NOT DISTINCT FROM $t$["Humbert de Moyenmoutier","Hildebrand (futur Grégoire VII)","Pierre Damien","Anselme de Canterbury"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le fond d'or des icônes byzantines représente la lumière divine incréée (la lumière de la Tabor, selon la théologie hésychaste développée par Grégoire Palamas au {XIVe siècle}). Ce n'est pas un fond décoratif : c'est l'absence de perspective spatiale — le personnage sacré n'existe pas dans l'espace terrestre mais dans l'éternité divine. L'or est une lumière, pas une surface. Cette théologie explique pourquoi l'art byzantin refusa délibérément le naturalisme occidental jusqu'à sa fin.$t$
  WHERE id = 294
    AND lore_text IS NOT DISTINCT FROM $t$L'art byzantin est rarement compris dans sa logique interne — ce n'est pas un art "primitif" figé, mais un art théologique où chaque détail (la couleur, la position des mains, le regard) a une signification codifiée.$t$
    AND question IS NOT DISTINCT FROM $t$Dans l'iconographie byzantine, que signifie le fond d'or (chrysos) omniprésent sur les icônes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le fond d'or des icônes byzantines représente la lumière divine incréée (la lumière de la Tabor, selon la théologie hésychaste développée par Grégoire Palamas au XIVe siècle). Ce n'est pas un fond décoratif : c'est l'absence de perspective spatiale — le personnage sacré n'existe pas dans l'espace terrestre mais dans l'éternité divine. L'or est une lumière, pas une surface. Cette théologie explique pourquoi l'art byzantin refusa délibérément le naturalisme occidental jusqu'à sa fin.$t$
    AND answer IS NOT DISTINCT FROM $t$La lumière divine incréée$t$
    AND choices IS NOT DISTINCT FROM $t$["La richesse de l'Église","La lumière divine incréée","La royauté impériale","La sainteté du personnage représenté"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La bataille de Manzikert ({1071}) est souvent présentée comme le coup mortel porté à Byzance — mais les Byzantins auraient pu survivre à cette défaite si leurs propres élites ne les avaient pas déchirés de l'intérieur.$t$,
    question = $t$Qui captura l'empereur byzantin Romain IV Diogène lors de la bataille de Manzikert en {1071} ?$t$,
    explanation = $t$Alp Arslan, sultan seldjoukide, captura l'empereur Romain IV Diogène lors de la bataille de Manzikert (26 août {1071}, en Arménie actuelle). Il traita son prisonnier avec une courtoisie notable — libération contre rançon et traité de paix. Mais à son retour, Romain IV fut destitué, aveuglé et tué par ses rivaux byzantins. Le traité fut ignoré. Les Seldjoukides envahirent alors massivement l'Anatolie, privant Byzance de ses provinces les plus riches et de ses réserves de recrutement.$t$
  WHERE id = 296
    AND lore_text IS NOT DISTINCT FROM $t$La bataille de Manzikert (1071) est souvent présentée comme le coup mortel porté à Byzance — mais les Byzantins auraient pu survivre à cette défaite si leurs propres élites ne les avaient pas déchirés de l'intérieur.$t$
    AND question IS NOT DISTINCT FROM $t$Qui captura l'empereur byzantin Romain IV Diogène lors de la bataille de Manzikert en 1071 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Alp Arslan, sultan seldjoukide, captura l'empereur Romain IV Diogène lors de la bataille de Manzikert (26 août 1071, en Arménie actuelle). Il traita son prisonnier avec une courtoisie notable — libération contre rançon et traité de paix. Mais à son retour, Romain IV fut destitué, aveuglé et tué par ses rivaux byzantins. Le traité fut ignoré. Les Seldjoukides envahirent alors massivement l'Anatolie, privant Byzance de ses provinces les plus riches et de ses réserves de recrutement.$t$
    AND answer IS NOT DISTINCT FROM $t$Alp Arslan$t$
    AND choices IS NOT DISTINCT FROM $t$["Alp Arslan","Toghrul Beg","Kilij Arslan","Malik-Chah"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$La quatrième croisade ({1202}-{1204}) n'atteignit jamais l'Égypte — elle se perdit à Constantinople, qu'elle prit d'assaut et pilla pendant trois jours. Cet événement divisa la chrétienté pour toujours.$t$,
    question = $t$Quel doge de Venise, âgé et presque aveugle, dirigea personnellement la prise de Constantinople en {1204} depuis la proue de son navire ?$t$,
    explanation = $t$Enrico Dandolo, doge de Venise, avait environ 90 ans lors de la prise de Constantinople (avril {1204}). Aveugle ou presque — peut-être à la suite d'un séjour à Constantinople dans sa jeunesse où il aurait été maltraité par les Byzantins — il monta le premier sur les murailles ou dirigea l'assaut depuis son navire selon les chroniques. Il mourut à Constantinople en {1205} et y fut enterré dans Sainte-Sophie. La prise de Constantinople par des croisés chrétiens choqua même le pape Innocent III.$t$
  WHERE id = 297
    AND lore_text IS NOT DISTINCT FROM $t$La quatrième croisade (1202-1204) n'atteignit jamais l'Égypte — elle se perdit à Constantinople, qu'elle prit d'assaut et pilla pendant trois jours. Cet événement divisa la chrétienté pour toujours.$t$
    AND question IS NOT DISTINCT FROM $t$Quel doge de Venise, âgé et presque aveugle, dirigea personnellement la prise de Constantinople en 1204 depuis la proue de son navire ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Enrico Dandolo, doge de Venise, avait environ 90 ans lors de la prise de Constantinople (avril 1204). Aveugle ou presque — peut-être à la suite d'un séjour à Constantinople dans sa jeunesse où il aurait été maltraité par les Byzantins — il monta le premier sur les murailles ou dirigea l'assaut depuis son navire selon les chroniques. Il mourut à Constantinople en 1205 et y fut enterré dans Sainte-Sophie. La prise de Constantinople par des croisés chrétiens choqua même le pape Innocent III.$t$
    AND answer IS NOT DISTINCT FROM $t$Enrico Dandolo$t$
    AND choices IS NOT DISTINCT FROM $t$["Enrico Dandolo","Pietro Ziani","Giovanni Michiel","Raniero Zeno"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Les Byzantins n'oublièrent jamais la prise de leur capitale — même après sa restauration, ils gardèrent la mémoire du sac latin. Et quand Constantinople tomba définitivement en {1453}, certains Byzantins choisirent les Turcs aux Latins.$t$,
    question = $t$Quelle formule prononcée par le Grand Duc Lucas Notaras avant {1453} résume le sentiment de nombreux Byzantins envers l'union avec Rome ?$t$,
    explanation = $t$Lucas Notaras (Loukas Notaras), mégas doux (amiral en chef) byzantin, aurait dit : "Je préfère voir dans cette ville le turban des Turcs que la tiare latine" — une formule qui résume le ressentiment orthodoxe après des siècles d'humiliations latines culminant avec {1204}. Notaras s'opposa à l'Union de Florence ({1439}). Paradoxalement, il fut exécuté par Mehmed II après la chute de Constantinople en {1453}, ses fils étant réclamés pour le harem du sultan.$t$
  WHERE id = 298
    AND lore_text IS NOT DISTINCT FROM $t$Les Byzantins n'oublièrent jamais la prise de leur capitale — même après sa restauration, ils gardèrent la mémoire du sac latin. Et quand Constantinople tomba définitivement en 1453, certains Byzantins choisirent les Turcs aux Latins.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle formule prononcée par le Grand Duc Lucas Notaras avant 1453 résume le sentiment de nombreux Byzantins envers l'union avec Rome ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Lucas Notaras (Loukas Notaras), mégas doux (amiral en chef) byzantin, aurait dit : "Je préfère voir dans cette ville le turban des Turcs que la tiare latine" — une formule qui résume le ressentiment orthodoxe après des siècles d'humiliations latines culminant avec 1204. Notaras s'opposa à l'Union de Florence (1439). Paradoxalement, il fut exécuté par Mehmed II après la chute de Constantinople en 1453, ses fils étant réclamés pour le harem du sultan.$t$
    AND answer IS NOT DISTINCT FROM $t$"Mieux vaut le turban du sultan que la tiare du pape"$t$
    AND choices IS NOT DISTINCT FROM $t$["\"Mieux vaut la mort que l'union latine\"","\"Mieux vaut le turban du sultan que la tiare du pape\"","\"Constantinople mourra mais jamais ne se rendra\"","\"La Croix vaut plus que la couronne\""]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel foyer philosophique byzantin, actif au {XVe siècle} dans le Péloponnèse, raviva le platonisme et influença directement la Renaissance florentine ?$t$
  WHERE id = 299
    AND lore_text IS NOT DISTINCT FROM $t$La science et la philosophie ne moururent pas à la chute de Rome — elles survécurent à Byzance, et les Byzantins transmirent à l'Occident renaissant les textes grecs que les Arabes avaient déjà en partie préservés.$t$
    AND question IS NOT DISTINCT FROM $t$Quel foyer philosophique byzantin, actif au XVe siècle dans le Péloponnèse, raviva le platonisme et influença directement la Renaissance florentine ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Gémiste Pléthon (vers 1355-1452/54), philosophe byzantin platonicien basé à Mistra (cité byzantine du Péloponnèse), participa au Concile de Florence (1438-39) et y répandit l'enthousiasme pour Platon parmi les humanistes italiens. Côme de Médicis, impressionné, fonda l'Académie platonicienne de Florence. Pléthon lui-même proposa de remplacer le christianisme par un néo-paganisme grec — une œuvre brûlée après sa mort par le patriarche Gennadios. Il fut l'un des catalyseurs de la Renaissance.$t$
    AND answer IS NOT DISTINCT FROM $t$L'école de Mistra (Pléthon)$t$
    AND choices IS NOT DISTINCT FROM $t$["L'école de Trébizonde","L'école de Thessalonique","L'école de Mistra (Pléthon)","L'Académie de Nicée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le titre de Porphyrogénète (Πορφυρογέννητος, "né dans la pourpre") désignait un enfant né dans la chambre revêtue de porphyre rouge du Palais Sacré de Constantinople, réservée aux accouchements impériaux. Cela donnait une légitimité spéciale — une naissance "dans la pourpre" valait plus qu'une naissance royale ordinaire. Constantin VII, qui régna au {Xe siècle}, était si fier de ce titre qu'il signa de nombreux ouvrages "Constantin Porphyrogénète". Le porphyre rouge, extrait d'une seule carrière en Égypte, était la couleur du pouvoir impérial.$t$
  WHERE id = 300
    AND lore_text IS NOT DISTINCT FROM $t$La succession impériale byzantine ignorait la stricte primogéniture. Une autre forme de légitimité, plus subtile, distinguait certains héritiers dès leur premier souffle — un privilège de naissance aux conséquences politiques durables, lié au lieu même où l'impératrice mettait au monde.$t$
    AND question IS NOT DISTINCT FROM $t$Que signifiait le titre de "Porphyrogénète" (né dans la pourpre) dans la hiérarchie byzantine ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le titre de Porphyrogénète (Πορφυρογέννητος, "né dans la pourpre") désignait un enfant né dans la chambre revêtue de porphyre rouge du Palais Sacré de Constantinople, réservée aux accouchements impériaux. Cela donnait une légitimité spéciale — une naissance "dans la pourpre" valait plus qu'une naissance royale ordinaire. Constantin VII, qui régna au Xe siècle, était si fier de ce titre qu'il signa de nombreux ouvrages "Constantin Porphyrogénète". Le porphyre rouge, extrait d'une seule carrière en Égypte, était la couleur du pouvoir impérial.$t$
    AND answer IS NOT DISTINCT FROM $t$Né dans la chambre pourpre du Palais Sacré$t$
    AND choices IS NOT DISTINCT FROM $t$["Né pendant le règne de son père","Né dans la chambre pourpre du Palais Sacré","Baptisé avec la pourpre impériale","Désigné héritier avant sa naissance"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$L'Empire byzantin survécut à sa propre chute — de petits États successeurs se proclamèrent héritiers de Byzance pendant des décennies après {1453}, dont l'un persista jusqu'en {1461}.$t$,
    question = $t$Quel empire byzantin en exil, fondé après {1204}, survécut à la chute de Constantinople de {1453} et ne fut conquis par les Ottomans qu'en {1461} ?$t$,
    explanation = $t$L'Empire de Trébizonde ({1204}-{1461}), fondé par Alexis et David Comnène sur les rives de la mer Noire (Trabzon, Turquie actuelle), fut le dernier État successeur byzantin. Il survécut à la chute de Constantinople de {1453} de huit ans, avant d'être conquis par Mehmed II en {1461}. Riche grâce au commerce de la Route de la Soie et aux mines d'argent pontiques, il avait maintenu une culture byzantine remarquable et des contacts avec la Géorgie, l'Arménie et les khans mongols.$t$
  WHERE id = 301
    AND lore_text IS NOT DISTINCT FROM $t$L'Empire byzantin survécut à sa propre chute — de petits États successeurs se proclamèrent héritiers de Byzance pendant des décennies après 1453, dont l'un persista jusqu'en 1461.$t$
    AND question IS NOT DISTINCT FROM $t$Quel empire byzantin en exil, fondé après 1204, survécut à la chute de Constantinople de 1453 et ne fut conquis par les Ottomans qu'en 1461 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Empire de Trébizonde (1204-1461), fondé par Alexis et David Comnène sur les rives de la mer Noire (Trabzon, Turquie actuelle), fut le dernier État successeur byzantin. Il survécut à la chute de Constantinople de 1453 de huit ans, avant d'être conquis par Mehmed II en 1461. Riche grâce au commerce de la Route de la Soie et aux mines d'argent pontiques, il avait maintenu une culture byzantine remarquable et des contacts avec la Géorgie, l'Arménie et les khans mongols.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Empire de Trébizonde$t$
    AND choices IS NOT DISTINCT FROM $t$["L'Empire de Nicée","L'Empire de Trébizonde","Le Despotat de Mistra","L'Empire de Thessalonique"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$En quel lieu se déroulèrent les premiers Jeux panhelléniques attestés à partir de {776 av. J.-C.} ?$t$
  WHERE id = 303
    AND lore_text IS NOT DISTINCT FROM $t$Tous les quatre ans, les guerres se taisaient. Les hommes se mesuraient nus sous le regard des dieux, cherchant non la richesse, mais la gloire impérissable.$t$
    AND question IS NOT DISTINCT FROM $t$En quel lieu se déroulèrent les premiers Jeux panhelléniques attestés à partir de 776 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Jeux d'Olympie honoraient Zeus et rassemblaient tout le monde grec dans une trêve sacrée.$t$
    AND answer IS NOT DISTINCT FROM $t$Olympie$t$
    AND choices IS NOT DISTINCT FROM $t$["Delphes","Olympie","Némée","Isthme de Corinthe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille de {490 av. J.-C.} vit les Athéniens repousser une invasion perse ?$t$
  WHERE id = 304
    AND lore_text IS NOT DISTINCT FROM $t$Face à un empire immense, une poignée d'hommes fit un choix insensé : courir vers l'ennemi. Le choc fut brutal, décisif — et l'histoire bascula.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille de 490 av. J.-C. vit les Athéniens repousser une invasion perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Une charge rapide et inhabituelle permit aux Athéniens de briser les lignes perses.$t$
    AND answer IS NOT DISTINCT FROM $t$Marathon$t$
    AND choices IS NOT DISTINCT FROM $t$["Salamine","Marathon","Platées","Thermopyles"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel régime politique fut institué à Athènes à la fin du {VIe siècle av. J.-C.} par Clisthène ?$t$
  WHERE id = 305
    AND lore_text IS NOT DISTINCT FROM $t$Le pouvoir quitta les lignées anciennes pour descendre dans la foule des citoyens. Une expérience fragile, audacieuse — donner la voix à ceux qui n'avaient jamais gouverné.$t$
    AND question IS NOT DISTINCT FROM $t$Quel régime politique fut institué à Athènes à la fin du VIe siècle av. J.-C. par Clisthène ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Elle émerge progressivement avant d'être structurée par Clisthène.$t$
    AND answer IS NOT DISTINCT FROM $t$La démocratie$t$
    AND choices IS NOT DISTINCT FROM $t$["L'oligarchie","La démocratie","La tyrannie","La monarchie élective"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle ligue maritime dirigée par Athènes fut fondée en {478 av. J.-C.} ?$t$
  WHERE id = 307
    AND lore_text IS NOT DISTINCT FROM $t$Une alliance née de la peur devint lentement un empire. L'or sacré quitta son île pour nourrir la puissance d'une seule cité.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ligue maritime dirigée par Athènes fut fondée en 478 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Son trésor, d'abord déposé sur l'île sacrée d'Apollon, fut transféré à Athènes par Périclès.$t$
    AND answer IS NOT DISTINCT FROM $t$Ligue de Délos$t$
    AND choices IS NOT DISTINCT FROM $t$["Ligue du Péloponnèse","Ligue de Délos","Ligue de Corinthe","Ligue ionienne"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel système d'écriture mycénien a été déchiffré en {1952} ?$t$
  WHERE id = 308
    AND lore_text IS NOT DISTINCT FROM $t$Des signes oubliés, figés dans l'argile brûlée. Pendant des siècles, ils gardèrent le silence — jusqu'à ce qu'un homme entende à nouveau la voix des premiers Grecs.$t$
    AND question IS NOT DISTINCT FROM $t$Quel système d'écriture mycénien a été déchiffré en 1952 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Michael Ventris y reconnut une forme archaïque du grec, faisant gagner mille ans à l'Histoire.$t$
    AND answer IS NOT DISTINCT FROM $t$Linéaire B$t$
    AND choices IS NOT DISTINCT FROM $t$["Linéaire A","Linéaire B","Hiéroglyphique crétois","Cypriote"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Accusé d'impiété et de corruption de la jeunesse en {399 av. J.-C.}, il refusa de fuir et but la ciguë selon la loi.$t$
  WHERE id = 310
    AND lore_text IS NOT DISTINCT FROM $t$Il passa sa vie à interroger les autres — et finit condamné pour cela. Sa mort transforma la philosophie en destin.$t$
    AND question IS NOT DISTINCT FROM $t$Quel philosophe fut condamné à boire la ciguë ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Accusé d'impiété et de corruption de la jeunesse en 399 av. J.-C., il refusa de fuir et but la ciguë selon la loi.$t$
    AND answer IS NOT DISTINCT FROM $t$Socrate$t$
    AND choices IS NOT DISTINCT FROM $t$["Platon","Anaxagore","Socrate","Diogène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En {480 av. J.-C.}, trois cents Spartiates et leurs alliés tinrent trois jours dans le défilé avant d'être encerclés.$t$
  WHERE id = 311
    AND lore_text IS NOT DISTINCT FROM $t$Un passage étroit. Une armée infinie. Et quelques hommes décidés à mourir plutôt qu'à céder.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille vit Léonidas résister à Xerxès ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 480 av. J.-C., trois cents Spartiates et leurs alliés tinrent trois jours dans le défilé avant d'être encerclés.$t$
    AND answer IS NOT DISTINCT FROM $t$Thermopyles$t$
    AND choices IS NOT DISTINCT FROM $t$["Salamine","Marathon","Thermopyles","Platées"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Fondée vers {387 av. J.-C.} sur un terrain dédié au héros Académos, l'école survécut près de neuf siècles.$t$
  WHERE id = 312
    AND lore_text IS NOT DISTINCT FROM $t$Sous des arbres sacrés, un homme enseignait que le monde visible n'était qu'une ombre.$t$
    AND question IS NOT DISTINCT FROM $t$Qui fonda l'Académie d'Athènes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Fondée vers 387 av. J.-C. sur un terrain dédié au héros Académos, l'école survécut près de neuf siècles.$t$
    AND answer IS NOT DISTINCT FROM $t$Platon$t$
    AND choices IS NOT DISTINCT FROM $t$["Aristote","Xénophon","Platon","Antisthène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En dix ans ({334 av. J.-C.}-{323 av. J.-C.}), Alexandre le Grand brisa les armées achéménides et atteignit l'Indus.$t$
  WHERE id = 313
    AND lore_text IS NOT DISTINCT FROM $t$Il avançait toujours plus loin, comme si aucune frontière ne pouvait contenir son ambition.$t$
    AND question IS NOT DISTINCT FROM $t$Quel roi conquit l'Empire perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En dix ans (334-323 av. J.-C.), Alexandre le Grand brisa les armées achéménides et atteignit l'Indus.$t$
    AND answer IS NOT DISTINCT FROM $t$Alexandre III$t$
    AND choices IS NOT DISTINCT FROM $t$["Philippe II","Alexandre III","Antigone Ier","Séleucos Ier"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Fondateur de l'école de Cos au {Vᵉ siècle av. J.-C.}, il fit de l'observation la première arme du soignant.$t$
  WHERE id = 317
    AND lore_text IS NOT DISTINCT FROM $t$Il refusa les explications divines. Là où d'autres voyaient les dieux, il observa le corps.$t$
    AND question IS NOT DISTINCT FROM $t$Qui est considéré comme le père de la médecine ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Fondateur de l'école de Cos au Vᵉ siècle av. J.-C., il fit de l'observation la première arme du soignant.$t$
    AND answer IS NOT DISTINCT FROM $t$Hippocrate$t$
    AND choices IS NOT DISTINCT FROM $t$["Galien","Asclépios","Hippocrate","Hérophile"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Vingt-sept ans de conflit ({431 av. J.-C.}-{404 av. J.-C.}) racontés par Thucydide, qui s'achevèrent par la capitulation d'Athènes.$t$
  WHERE id = 318
    AND lore_text IS NOT DISTINCT FROM $t$Deux visions du monde s'affrontèrent — et l'une d'elles disparut dans la poussière des murailles abattues.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle guerre opposa Athènes et Sparte ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Vingt-sept ans de conflit (431-404 av. J.-C.) racontés par Thucydide, qui s'achevèrent par la capitulation d'Athènes.$t$
    AND answer IS NOT DISTINCT FROM $t$Guerre du Péloponnèse$t$
    AND choices IS NOT DISTINCT FROM $t$["Guerres médiques","Guerre du Péloponnèse","Guerre de Corinthe","Guerre lamiaque"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille brisa la suprématie spartiate en {371 av. J.-C.} ?$t$
  WHERE id = 319
    AND lore_text IS NOT DISTINCT FROM $t$Un général osa rompre les règles. Ce jour-là, l'invincible vacilla.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille brisa la suprématie spartiate en 371 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Épaminondas inventa l'ordre oblique, concentrant son aile gauche pour broyer l'élite lacédémonienne.$t$
    AND answer IS NOT DISTINCT FROM $t$Leuctres$t$
    AND choices IS NOT DISTINCT FROM $t$["Mantinée","Chéronée","Leuctres","Coronée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Élève vingt ans de Platon puis précepteur d'Alexandre, il fonda le Lycée à Athènes en {335 av. J.-C.}$t$
  WHERE id = 323
    AND lore_text IS NOT DISTINCT FROM $t$Il voulait tout comprendre : la nature, les hommes, le monde.$t$
    AND question IS NOT DISTINCT FROM $t$Qui fonda le Lycée ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Élève vingt ans de Platon puis précepteur d'Alexandre, il fonda le Lycée à Athènes en 335 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Aristote$t$
    AND choices IS NOT DISTINCT FROM $t$["Théophraste","Aristote","Speusippe","Xénocrate"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$37 livres compilant tout le savoir antique sur la nature ; il périt à Stabies lors de l'éruption du Vésuve en {79 ap. J.-C.}$t$
  WHERE id = 330
    AND lore_text IS NOT DISTINCT FROM $t$Il voulut tout consigner — plantes, pierres, remèdes — jusqu'à mourir face à la colère d'un volcan.$t$
    AND question IS NOT DISTINCT FROM $t$Quel naturaliste romain écrivit l'Histoire naturelle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$37 livres compilant tout le savoir antique sur la nature ; il périt à Stabies lors de l'éruption du Vésuve en 79 ap. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Pline l'Ancien$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En {338 av. J.-C.}, Philippe II et le jeune Alexandre écrasèrent la coalition d'Athènes et Thèbes — le Bataillon Sacré thébain mourut sur place.$t$
  WHERE id = 332
    AND lore_text IS NOT DISTINCT FROM $t$Ce jour-là, les cités libres comprirent qu'une ère s'achevait.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille marque la domination macédonienne sur la Grèce ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 338 av. J.-C., Philippe II et le jeune Alexandre écrasèrent la coalition d'Athènes et Thèbes — le Bataillon Sacré thébain mourut sur place.$t$
    AND answer IS NOT DISTINCT FROM $t$Chéronée$t$
    AND choices IS NOT DISTINCT FROM $t$["Granique","Chéronée","Issos","Mantinée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$En quel lieu se déroulèrent les premiers Jeux panhelléniques attestés à partir de {776 av. J.-C.} ?$t$
  WHERE id = 335
    AND lore_text IS NOT DISTINCT FROM $t$Tous les quatre ans, les guerres se taisaient. Les hommes se mesuraient nus sous le regard des dieux, cherchant non la richesse, mais la gloire impérissable.$t$
    AND question IS NOT DISTINCT FROM $t$En quel lieu se déroulèrent les premiers Jeux panhelléniques attestés à partir de 776 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Jeux d'Olympie honoraient Zeus et rassemblaient tout le monde grec dans une trêve sacrée.$t$
    AND answer IS NOT DISTINCT FROM $t$Olympie$t$
    AND choices IS NOT DISTINCT FROM $t$["Delphes","Olympie","Némée","Isthme de Corinthe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille de {490 av. J.-C.} vit les Athéniens repousser une invasion perse ?$t$
  WHERE id = 336
    AND lore_text IS NOT DISTINCT FROM $t$Face à un empire immense, une poignée d'hommes fit un choix insensé : courir vers l'ennemi. Le choc fut brutal, décisif — et l'histoire bascula.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille de 490 av. J.-C. vit les Athéniens repousser une invasion perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Une charge rapide et inhabituelle permit aux Athéniens de briser les lignes perses.$t$
    AND answer IS NOT DISTINCT FROM $t$Marathon$t$
    AND choices IS NOT DISTINCT FROM $t$["Salamine","Marathon","Platées","Thermopyles"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel régime politique fut institué à Athènes à la fin du {VIe siècle av. J.-C.} par Clisthène ?$t$
  WHERE id = 337
    AND lore_text IS NOT DISTINCT FROM $t$Le pouvoir quitta les lignées anciennes pour descendre dans la foule des citoyens. Une expérience fragile, audacieuse — donner la voix à ceux qui n'avaient jamais gouverné.$t$
    AND question IS NOT DISTINCT FROM $t$Quel régime politique fut institué à Athènes à la fin du VIe siècle av. J.-C. par Clisthène ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Elle émerge progressivement avant d'être structurée par Clisthène.$t$
    AND answer IS NOT DISTINCT FROM $t$La démocratie$t$
    AND choices IS NOT DISTINCT FROM $t$["L'oligarchie","La démocratie","La tyrannie","La monarchie élective"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle ligue maritime dirigée par Athènes fut fondée en {478 av. J.-C.} ?$t$
  WHERE id = 339
    AND lore_text IS NOT DISTINCT FROM $t$Une alliance née de la peur devint lentement un empire. L'or sacré quitta son île pour nourrir la puissance d'une seule cité.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle ligue maritime dirigée par Athènes fut fondée en 478 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Son trésor, d'abord déposé sur l'île sacrée d'Apollon, fut transféré à Athènes par Périclès.$t$
    AND answer IS NOT DISTINCT FROM $t$Ligue de Délos$t$
    AND choices IS NOT DISTINCT FROM $t$["Ligue du Péloponnèse","Ligue de Délos","Ligue de Corinthe","Ligue ionienne"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel système d'écriture mycénien a été déchiffré en {1952} ?$t$
  WHERE id = 340
    AND lore_text IS NOT DISTINCT FROM $t$Des signes oubliés, figés dans l'argile brûlée. Pendant des siècles, ils gardèrent le silence — jusqu'à ce qu'un homme entende à nouveau la voix des premiers Grecs.$t$
    AND question IS NOT DISTINCT FROM $t$Quel système d'écriture mycénien a été déchiffré en 1952 ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Michael Ventris y reconnut une forme archaïque du grec, faisant gagner mille ans à l'Histoire.$t$
    AND answer IS NOT DISTINCT FROM $t$Linéaire B$t$
    AND choices IS NOT DISTINCT FROM $t$["Linéaire A","Linéaire B","Hiéroglyphique crétois","Cypriote"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Accusé d'impiété et de corruption de la jeunesse en {399 av. J.-C.}, il refusa de fuir et but la ciguë selon la loi.$t$
  WHERE id = 342
    AND lore_text IS NOT DISTINCT FROM $t$Il passa sa vie à interroger les autres — et finit condamné pour cela. Sa mort transforma la philosophie en destin.$t$
    AND question IS NOT DISTINCT FROM $t$Quel philosophe fut condamné à boire la ciguë ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Accusé d'impiété et de corruption de la jeunesse en 399 av. J.-C., il refusa de fuir et but la ciguë selon la loi.$t$
    AND answer IS NOT DISTINCT FROM $t$Socrate$t$
    AND choices IS NOT DISTINCT FROM $t$["Platon","Anaxagore","Socrate","Diogène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En {480 av. J.-C.}, trois cents Spartiates et leurs alliés tinrent trois jours dans le défilé avant d'être encerclés.$t$
  WHERE id = 343
    AND lore_text IS NOT DISTINCT FROM $t$Un passage étroit. Une armée infinie. Et quelques hommes décidés à mourir plutôt qu'à céder.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille vit Léonidas résister à Xerxès ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 480 av. J.-C., trois cents Spartiates et leurs alliés tinrent trois jours dans le défilé avant d'être encerclés.$t$
    AND answer IS NOT DISTINCT FROM $t$Thermopyles$t$
    AND choices IS NOT DISTINCT FROM $t$["Salamine","Marathon","Thermopyles","Platées"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Fondée vers {387 av. J.-C.} sur un terrain dédié au héros Académos, l'école survécut près de neuf siècles.$t$
  WHERE id = 344
    AND lore_text IS NOT DISTINCT FROM $t$Sous des arbres sacrés, un homme enseignait que le monde visible n'était qu'une ombre.$t$
    AND question IS NOT DISTINCT FROM $t$Qui fonda l'Académie d'Athènes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Fondée vers 387 av. J.-C. sur un terrain dédié au héros Académos, l'école survécut près de neuf siècles.$t$
    AND answer IS NOT DISTINCT FROM $t$Platon$t$
    AND choices IS NOT DISTINCT FROM $t$["Aristote","Xénophon","Platon","Antisthène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En dix ans ({334 av. J.-C.}-{323 av. J.-C.}), Alexandre le Grand brisa les armées achéménides et atteignit l'Indus.$t$
  WHERE id = 345
    AND lore_text IS NOT DISTINCT FROM $t$Il avançait toujours plus loin, comme si aucune frontière ne pouvait contenir son ambition.$t$
    AND question IS NOT DISTINCT FROM $t$Quel roi conquit l'Empire perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En dix ans (334-323 av. J.-C.), Alexandre le Grand brisa les armées achéménides et atteignit l'Indus.$t$
    AND answer IS NOT DISTINCT FROM $t$Alexandre III$t$
    AND choices IS NOT DISTINCT FROM $t$["Philippe II","Alexandre III","Antigone Ier","Séleucos Ier"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Fondateur de l'école de Cos au {Vᵉ siècle av. J.-C.}, il fit de l'observation la première arme du soignant.$t$
  WHERE id = 349
    AND lore_text IS NOT DISTINCT FROM $t$Il refusa les explications divines. Là où d'autres voyaient les dieux, il observa le corps.$t$
    AND question IS NOT DISTINCT FROM $t$Qui est considéré comme le père de la médecine ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Fondateur de l'école de Cos au Vᵉ siècle av. J.-C., il fit de l'observation la première arme du soignant.$t$
    AND answer IS NOT DISTINCT FROM $t$Hippocrate$t$
    AND choices IS NOT DISTINCT FROM $t$["Galien","Asclépios","Hippocrate","Hérophile"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Vingt-sept ans de conflit ({431 av. J.-C.}-{404 av. J.-C.}) racontés par Thucydide, qui s'achevèrent par la capitulation d'Athènes.$t$
  WHERE id = 350
    AND lore_text IS NOT DISTINCT FROM $t$Deux visions du monde s'affrontèrent — et l'une d'elles disparut dans la poussière des murailles abattues.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle guerre opposa Athènes et Sparte ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Vingt-sept ans de conflit (431-404 av. J.-C.) racontés par Thucydide, qui s'achevèrent par la capitulation d'Athènes.$t$
    AND answer IS NOT DISTINCT FROM $t$Guerre du Péloponnèse$t$
    AND choices IS NOT DISTINCT FROM $t$["Guerres médiques","Guerre du Péloponnèse","Guerre de Corinthe","Guerre lamiaque"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle bataille brisa la suprématie spartiate en {371 av. J.-C.} ?$t$
  WHERE id = 351
    AND lore_text IS NOT DISTINCT FROM $t$Un général osa rompre les règles. Ce jour-là, l'invincible vacilla.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille brisa la suprématie spartiate en 371 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Épaminondas inventa l'ordre oblique, concentrant son aile gauche pour broyer l'élite lacédémonienne.$t$
    AND answer IS NOT DISTINCT FROM $t$Leuctres$t$
    AND choices IS NOT DISTINCT FROM $t$["Mantinée","Chéronée","Leuctres","Coronée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Élève vingt ans de Platon puis précepteur d'Alexandre, il fonda le Lycée à Athènes en {335 av. J.-C.}$t$
  WHERE id = 355
    AND lore_text IS NOT DISTINCT FROM $t$Il voulait tout comprendre : la nature, les hommes, le monde.$t$
    AND question IS NOT DISTINCT FROM $t$Qui fonda le Lycée ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Élève vingt ans de Platon puis précepteur d'Alexandre, il fonda le Lycée à Athènes en 335 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Aristote$t$
    AND choices IS NOT DISTINCT FROM $t$["Théophraste","Aristote","Speusippe","Xénocrate"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$37 livres compilant tout le savoir antique sur la nature ; il périt à Stabies lors de l'éruption du Vésuve en {79 ap. J.-C.}$t$
  WHERE id = 362
    AND lore_text IS NOT DISTINCT FROM $t$Il voulut tout consigner — plantes, pierres, remèdes — jusqu'à mourir face à la colère d'un volcan.$t$
    AND question IS NOT DISTINCT FROM $t$Quel naturaliste romain écrivit l'Histoire naturelle ?$t$
    AND explanation IS NOT DISTINCT FROM $t$37 livres compilant tout le savoir antique sur la nature ; il périt à Stabies lors de l'éruption du Vésuve en 79 ap. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Pline l'Ancien$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$En {338 av. J.-C.}, Philippe II et le jeune Alexandre écrasèrent la coalition d'Athènes et Thèbes — le Bataillon Sacré thébain mourut sur place.$t$
  WHERE id = 364
    AND lore_text IS NOT DISTINCT FROM $t$Ce jour-là, les cités libres comprirent qu'une ère s'achevait.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle bataille marque la domination macédonienne sur la Grèce ?$t$
    AND explanation IS NOT DISTINCT FROM $t$En 338 av. J.-C., Philippe II et le jeune Alexandre écrasèrent la coalition d'Athènes et Thèbes — le Bataillon Sacré thébain mourut sur place.$t$
    AND answer IS NOT DISTINCT FROM $t$Chéronée$t$
    AND choices IS NOT DISTINCT FROM $t$["Granique","Chéronée","Issos","Mantinée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$On raconte que Phidippidès courut les quelque 40 km de Marathon à Athènes pour crier « Nenikékamen ! » (« Nous avons vaincu ! ») avant de mourir. C'est cette légende qui a donné son nom à notre marathon moderne, la course de 42 km créée pour les premiers Jeux olympiques de {1896}.$t$
  WHERE id = 366
    AND lore_text IS NOT DISTINCT FROM $t$Imagine un homme couvert de poussière et de sueur, le souffle en feu, qui dévale les collines sans jamais ralentir. Il porte une nouvelle plus précieuse que sa propre vie : l'envahisseur est repoussé. Il franchit les portes de la cité, crie sa joie… et tombe.$t$
    AND question IS NOT DISTINCT FROM $t$Quel messager, dit-on, courut d'une traite jusqu'à Athènes pour annoncer la victoire de Marathon, avant de s'effondrer, mort d'épuisement ?$t$
    AND explanation IS NOT DISTINCT FROM $t$On raconte que Phidippidès courut les quelque 40 km de Marathon à Athènes pour crier « Nenikékamen ! » (« Nous avons vaincu ! ») avant de mourir. C'est cette légende qui a donné son nom à notre marathon moderne, la course de 42 km créée pour les premiers Jeux olympiques de 1896.$t$
    AND answer IS NOT DISTINCT FROM $t$Phidippidès$t$
    AND choices IS NOT DISTINCT FROM $t$["Phidippidès","Léonidas","Thésée","Diogène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel roi perse lança la première grande expédition punitive contre les cités grecques continentales vers {490 av. J.-C.} ?$t$,
    explanation = $t$Darius Ier organisa l'expédition de {490 av. J.-C.} pour punir Athènes et Érétrie, qui avaient soutenu la révolte ionienne. C'est lors de cette campagne qu'eut lieu la bataille du 13 septembre 490.$t$
  WHERE id = 367
    AND lore_text IS NOT DISTINCT FROM $t$Des messagers portant terre et eau parcouraient les routes de l'empire, exigeant la soumission au nom du maître du monde. Les cités grecques devaient choisir : plier le genou ou affronter la fureur d'un roi qui se disait roi des rois. Certaines plièrent ; d'autres choisirent le fer.$t$
    AND question IS NOT DISTINCT FROM $t$Quel roi perse lança la première grande expédition punitive contre les cités grecques continentales vers 490 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Darius Ier organisa l'expédition de 490 av. J.-C. pour punir Athènes et Érétrie, qui avaient soutenu la révolte ionienne. C'est lors de cette campagne qu'eut lieu la bataille du 13 septembre 490.$t$
    AND answer IS NOT DISTINCT FROM $t$Darius Ier$t$
    AND choices IS NOT DISTINCT FROM $t$["Darius Ier","Cyrus le Grand","Cambyse II","Xerxès Ier"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Où l'amiral grec Thémistocle remporta-t-il sa grande victoire navale en {480 av. J.-C.} ?$t$,
    explanation = $t$La bataille de Salamine eut lieu en septembre {480 av. J.-C.} dans le détroit entre l'île de Salamine et l'Attique. La flotte grecque, sous l'impulsion de Thémistocle, détruisit une grande partie de la flotte perse.$t$
  WHERE id = 368
    AND lore_text IS NOT DISTINCT FROM $t$Entre une île sacrée et le continent, les eaux étroites se transformèrent en piège mortel. Les rameurs grecs avaient faim, peur et peu de sommeil — mais un stratège leur avait promis que le terrain lui-même se battrait à leurs côtés. Le roi barbare regardait depuis son trône de pierre la mer avaler son invincible flotte.$t$
    AND question IS NOT DISTINCT FROM $t$Où l'amiral grec Thémistocle remporta-t-il sa grande victoire navale en 480 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La bataille de Salamine eut lieu en septembre 480 av. J.-C. dans le détroit entre l'île de Salamine et l'Attique. La flotte grecque, sous l'impulsion de Thémistocle, détruisit une grande partie de la flotte perse.$t$
    AND answer IS NOT DISTINCT FROM $t$Salamine$t$
    AND choices IS NOT DISTINCT FROM $t$["Salamine","Mycale","Artémision","Lemnos"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Solon (vers {594 av. J.-C.}), compté parmi les Sept Sages de la Grèce, abolit l'esclavage pour dettes et adoucit des lois d'une dureté légendaire (celles de Dracon, d'où notre mot « draconien »). En refusant le pouvoir absolu, il ouvrit la voie qui mènera, un siècle plus tard, à la démocratie athénienne.$t$
  WHERE id = 369
    AND lore_text IS NOT DISTINCT FROM $t$La cité étouffait : des hommes libres, ruinés, avaient été vendus comme du bétail pour quelques sacs de grain. Un homme respecté de tous accepta la lourde tâche de tout réformer. Il effaça les dettes, brisa les chaînes, et refusa pourtant de devenir tyran quand on le lui offrit.$t$
    AND question IS NOT DISTINCT FROM $t$Quel sage législateur libéra les Athéniens tombés en esclavage à cause de leurs dettes, jetant les bases d'une cité plus juste ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Solon (vers 594 av. J.-C.), compté parmi les Sept Sages de la Grèce, abolit l'esclavage pour dettes et adoucit des lois d'une dureté légendaire (celles de Dracon, d'où notre mot « draconien »). En refusant le pouvoir absolu, il ouvrit la voie qui mènera, un siècle plus tard, à la démocratie athénienne.$t$
    AND answer IS NOT DISTINCT FROM $t$Solon$t$
    AND choices IS NOT DISTINCT FROM $t$["Solon","Dracon","Clisthène","Thésée"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Thalès de Milet (vers {625 av. J.-C.}-{545 av. J.-C.}) est le premier à avoir proposé une explication naturaliste du cosmos : l'eau (ὕδωρ) serait l'arkhè, le principe fondateur de toute réalité.$t$
  WHERE id = 372
    AND lore_text IS NOT DISTINCT FROM $t$Au bord de la mer Égée, un sage de Milet contemplait les flots et croyait y lire le secret du cosmos. Avant lui, les dieux expliquaient le monde ; après lui, la raison tenterait de le faire.$t$
    AND question IS NOT DISTINCT FROM $t$Quel philosophe de Milet affirmait que l'eau est le principe originel de toutes choses ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Thalès de Milet (vers 625-545 av. J.-C.) est le premier à avoir proposé une explication naturaliste du cosmos : l'eau (ὕδωρ) serait l'arkhè, le principe fondateur de toute réalité.$t$
    AND answer IS NOT DISTINCT FROM $t$Thalès$t$
    AND choices IS NOT DISTINCT FROM $t$["Anaximandre","Thalès","Anaximène","Empédocle"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Ératosthène de Cyrène (v. {276 av. J.-C.}-{194 av. J.-C.}), directeur de la Bibliothèque d'Alexandrie, calcula la circonférence terrestre en mesurant l'angle de l'ombre à Alexandrie le jour du solstice d'été, obtenant environ 40 000 km — une valeur très proche de la réalité.$t$
  WHERE id = 374
    AND lore_text IS NOT DISTINCT FROM $t$À Syène, le soleil frappe le fond d'un puits sans projeter d'ombre. À Alexandrie, il incline ses rayons. Un homme a su lire dans cet écart le tour complet de notre monde.$t$
    AND question IS NOT DISTINCT FROM $t$Quel savant d'Alexandrie a mesuré la circonférence de la Terre avec une précision remarquable ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Ératosthène de Cyrène (v. 276-194 av. J.-C.), directeur de la Bibliothèque d'Alexandrie, calcula la circonférence terrestre en mesurant l'angle de l'ombre à Alexandrie le jour du solstice d'été, obtenant environ 40 000 km — une valeur très proche de la réalité.$t$
    AND answer IS NOT DISTINCT FROM $t$Ératosthène$t$
    AND choices IS NOT DISTINCT FROM $t$["Ératosthène","Hipparque","Aristarque","Ctésibios"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Les Éléments d'Euclide (v. {300 av. J.-C.}) constituent l'un des ouvrages scientifiques les plus diffusés de l'histoire : treize livres couvrant géométrie plane, arithmétique, proportions et géométrie dans l'espace.$t$
  WHERE id = 375
    AND lore_text IS NOT DISTINCT FROM $t$Dans les salles studieuses d'Alexandrie, des scribes copient un texte devenu presque sacré. Pendant deux millénaires, aucun géomètre ne pourra se prétendre formé sans l'avoir parcouru de la première à la dernière proposition.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelle-t-on l'ouvrage en treize volumes dans lequel Euclide expose les fondements de la géométrie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les Éléments d'Euclide (v. 300 av. J.-C.) constituent l'un des ouvrages scientifiques les plus diffusés de l'histoire : treize livres couvrant géométrie plane, arithmétique, proportions et géométrie dans l'espace.$t$
    AND answer IS NOT DISTINCT FROM $t$Les Éléments$t$
    AND choices IS NOT DISTINCT FROM $t$["Les Éléments","L'Almageste","La Syntaxe","Les Coniques"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Aristophane (v. {446 av. J.-C.}–{386 av. J.-C.}) est le principal représentant de la comédie ancienne athénienne. Ses pièces (Les Nuées, Les Grenouilles, Lysistrata) raillaient hommes politiques et philosophes.$t$
  WHERE id = 379
    AND lore_text IS NOT DISTINCT FROM $t$Sur la scène d'Athènes, ce genre faisait rire aux larmes : on y déguisait les politiciens en saucissiers, on y faisait voler des hommes sur des scarabées géants. Le masque grimaçant régnait sans partage.$t$
    AND question IS NOT DISTINCT FROM $t$Aristophane est le maître incontesté de quel genre théâtral grec ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Aristophane (v. 446–386 av. J.-C.) est le principal représentant de la comédie ancienne athénienne. Ses pièces (Les Nuées, Les Grenouilles, Lysistrata) raillaient hommes politiques et philosophes.$t$
    AND answer IS NOT DISTINCT FROM $t$La comédie$t$
    AND choices IS NOT DISTINCT FROM $t$["La tragédie","L'épopée","La comédie","Le dithyrambe"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Colosse de Rhodes, érigé vers {280 av. J.-C.}, était une statue de bronze d'environ 30 m représentant le dieu-soleil Hélios. Il s'effondra lors d'un séisme une soixantaine d'années plus tard. Contrairement à la légende tenace, il n'enjambait pas l'entrée du port, jambes écartées : aucun navire ne passait entre ses pieds.$t$
  WHERE id = 380
    AND lore_text IS NOT DISTINCT FROM $t$Imagine un géant de bronze haut comme un immeuble, dressé face à la mer, étincelant sous le soleil. Les marins l'apercevaient de loin, salut éclatant à l'approche de l'île. Un tremblement de terre finit par le coucher, mais sa légende, elle, n'est jamais tombée.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle gigantesque statue de bronze, comptée parmi les Sept Merveilles du monde, veillait jadis sur le port de Rhodes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Colosse de Rhodes, érigé vers 280 av. J.-C., était une statue de bronze d'environ 30 m représentant le dieu-soleil Hélios. Il s'effondra lors d'un séisme une soixantaine d'années plus tard. Contrairement à la légende tenace, il n'enjambait pas l'entrée du port, jambes écartées : aucun navire ne passait entre ses pieds.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Colosse de Rhodes$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Colosse de Rhodes","Le Phare d'Alexandrie","La statue de Zeus à Olympie","Le géant de Délos"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le Phare d'Alexandrie, construit sur l'île de Pharos vers {280 av. J.-C.} sous Ptolémée II, est considéré comme l'une des Sept Merveilles du monde antique. Il pouvait atteindre 100 à 130 mètres de hauteur.$t$
  WHERE id = 382
    AND lore_text IS NOT DISTINCT FROM $t$Des flammes visibles à des kilomètres en mer, un miroir de bronze renvoyant leur éclat vers l'horizon — les marins disaient qu'aucun cap dangereux n'était aussi bien gardé. L'ingéniosité hellénistique avait fait du danger une promesse de salut.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle merveille architecturale, construite sur une île à l'entrée d'un grand port égyptien, guidait les navires de nuit ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Phare d'Alexandrie, construit sur l'île de Pharos vers 280 av. J.-C. sous Ptolémée II, est considéré comme l'une des Sept Merveilles du monde antique. Il pouvait atteindre 100 à 130 mètres de hauteur.$t$
    AND answer IS NOT DISTINCT FROM $t$Le Phare d'Alexandrie$t$
    AND choices IS NOT DISTINCT FROM $t$["Le Colosse de Rhodes","Le Phare d'Alexandrie","La Tour des Vents d'Athènes","Le phare de Carthage"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$L'hoplite était le soldat d'infanterie lourde grec, équipé du hoplon, d'une lance (doru) et d'une épée courte. Il formait la phalange et constituait le cœur des armées des cités-États du {VIIe siècle av. J.-C.} au {IVe siècle av. J.-C.}$t$
  WHERE id = 387
    AND lore_text IS NOT DISTINCT FROM $t$Il ne portait pas la robe du savant ni le manteau du philosophe. Casqué de bronze, cuirassé, lance et bouclier en main, il incarnait la vertu civique faite chair — l'ordre social et la survie de la cité reposaient sur son courage au rang.$t$
    AND question IS NOT DISTINCT FROM $t$Comment appelait-on le fantassin lourdement armé qui formait l'épine dorsale des armées grecques ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'hoplite était le soldat d'infanterie lourde grec, équipé du hoplon, d'une lance (doru) et d'une épée courte. Il formait la phalange et constituait le cœur des armées des cités-États du VIIe au IVe siècle av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Hoplite$t$
    AND choices IS NOT DISTINCT FROM $t$["Peltaste","Hoplite","Toxote","Hypaspiste"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Pisistrate exerça la tyrannie — au sens grec du terme, un pouvoir personnel non héréditaire conquis par la force. Il régna à trois reprises (vers {561 av. J.-C.}, {556 av. J.-C.} et {546 av. J.-C.}-{528 av. J.-C.}) tout en maintenant formellement les institutions soloniennes.$t$
  WHERE id = 394
    AND lore_text IS NOT DISTINCT FROM $t$Il n'abolit pas les lois de son prédécesseur — il les laissa en place et gouverna dans leur ombre. Les Athéniens vivaient sous des règles qu'ils reconnaissaient, mais la main qui guidait la cité n'était pas celle qu'ils avaient choisie.$t$
    AND question IS NOT DISTINCT FROM $t$Pisistrate s'empara du pouvoir à Athènes à trois reprises. Comment appelle-t-on ce type de régime qu'il incarna ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Pisistrate exerça la tyrannie — au sens grec du terme, un pouvoir personnel non héréditaire conquis par la force. Il régna à trois reprises (vers 561, 556 et 546-528 av. J.-C.) tout en maintenant formellement les institutions soloniennes.$t$
    AND answer IS NOT DISTINCT FROM $t$Tyrannie$t$
    AND choices IS NOT DISTINCT FROM $t$["Oligarchie","Tyrannie","Aristocratie","Théocratie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Périclès (v. {495 av. J.-C.}-{429 av. J.-C.}) domina la vie politique athénienne près de trente ans. Il lança le chantier du Parthénon et fit d'Athènes le cœur intellectuel du monde grec. On parle encore du « siècle de Périclès » pour désigner cet âge d'or de la démocratie, de l'art et de la pensée.$t$
  WHERE id = 395
    AND lore_text IS NOT DISTINCT FROM $t$Sous sa main, Athènes se couvre de marbre et d'idées. Les sculpteurs taillent le Parthénon, les philosophes débattent sur l'agora, les tragédies font pleurer des milliers de spectateurs. Jamais une cité n'avait rayonné d'un tel éclat.$t$
    AND question IS NOT DISTINCT FROM $t$Quel homme d'État guida Athènes à son apogée, fit reconstruire l'Acropole, et donna son nom au « siècle » le plus brillant de la cité ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Périclès (v. 495-429 av. J.-C.) domina la vie politique athénienne près de trente ans. Il lança le chantier du Parthénon et fit d'Athènes le cœur intellectuel du monde grec. On parle encore du « siècle de Périclès » pour désigner cet âge d'or de la démocratie, de l'art et de la pensée.$t$
    AND answer IS NOT DISTINCT FROM $t$Périclès$t$
    AND choices IS NOT DISTINCT FROM $t$["Périclès","Solon","Thémistocle","Clisthène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Zénon d'Élée (vers {490 av. J.-C.}-{430 av. J.-C.}) argumentait qu'Achille, le guerrier le plus rapide, ne peut jamais rattraper une tortue : chaque fois qu'il atteint l'endroit où elle était, elle a légèrement avancé, à l'infini.$t$
  WHERE id = 399
    AND lore_text IS NOT DISTINCT FROM $t$Un disciple fidèle de Parménide forgeait des arguments aussi tranchants que des lames pour prouver l'impossibilité du mouvement. Ses adversaires ne pouvaient réfuter ses raisonnements, et pourtant leurs jambes marchaient.$t$
    AND question IS NOT DISTINCT FROM $t$Quel paradoxe de Zénon d'Élée met en scène un héros grec incapable de rattraper une tortue ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Zénon d'Élée (vers 490-430 av. J.-C.) argumentait qu'Achille, le guerrier le plus rapide, ne peut jamais rattraper une tortue : chaque fois qu'il atteint l'endroit où elle était, elle a légèrement avancé, à l'infini.$t$
    AND answer IS NOT DISTINCT FROM $t$Le paradoxe d'Achille et la tortue$t$
    AND choices IS NOT DISTINCT FROM $t$["Le paradoxe de la flèche","Le paradoxe d'Achille et la tortue","Le paradoxe du stade","Le paradoxe du grain de millet"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel astronome grec du {IIe siècle av. J.-C.} dressa le premier catalogue stellaire précis et découvrit la précession des équinoxes ?$t$,
    explanation = $t$Hipparque de Nicée (v. {190 av. J.-C.}-{120 av. J.-C.}) composa un catalogue d'environ 850 étoiles avec leurs coordonnées et magnitude, et découvrit la précession des équinoxes en comparant ses observations aux données babyloniennes antérieures.$t$
  WHERE id = 401
    AND lore_text IS NOT DISTINCT FROM $t$De son observatoire de Rhodes, il scrutait le ciel nuit après nuit, consignant chaque étoile avec une méthode inégalée. En comparant ses notes aux archives babyloniennes, il remarqua que les constellations s'étaient légèrement déplacées sur fond d'éternité.$t$
    AND question IS NOT DISTINCT FROM $t$Quel astronome grec du IIe siècle av. J.-C. dressa le premier catalogue stellaire précis et découvrit la précession des équinoxes ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Hipparque de Nicée (v. 190-120 av. J.-C.) composa un catalogue d'environ 850 étoiles avec leurs coordonnées et magnitude, et découvrit la précession des équinoxes en comparant ses observations aux données babyloniennes antérieures.$t$
    AND answer IS NOT DISTINCT FROM $t$Hipparque de Nicée$t$
    AND choices IS NOT DISTINCT FROM $t$["Hipparque de Nicée","Aristarque de Samos","Callimaque","Sosigène"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel exploit d'ingénierie militaire Xerxès réalisa-t-il pour franchir le détroit entre l'Europe et l'Asie en {480 av. J.-C.} ?$t$,
    explanation = $t$Xerxès fit construire deux ponts de bateaux (pentecontères et trières) sur l'Hellespont, reliés par des câbles de lin et de papyrus. Un premier pont fut détruit par une tempête ; le second permit le passage de l'armée en {480 av. J.-C.}$t$
  WHERE id = 416
    AND lore_text IS NOT DISTINCT FROM $t$On raconte que lorsque la première construction fut emportée par une tempête, le roi ordonna de fouetter la mer rebelle et d'y jeter des fers. Une telle démesure ne pouvait qu'appeler une réponse du destin. Pourtant, la seconde tentative tint, et des centaines de milliers d'hommes marchèrent sur les flots.$t$
    AND question IS NOT DISTINCT FROM $t$Quel exploit d'ingénierie militaire Xerxès réalisa-t-il pour franchir le détroit entre l'Europe et l'Asie en 480 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Xerxès fit construire deux ponts de bateaux (pentecontères et trières) sur l'Hellespont, reliés par des câbles de lin et de papyrus. Un premier pont fut détruit par une tempête ; le second permit le passage de l'armée en 480 av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Il construisit un double pont de bateaux amarrés en ligne$t$
    AND choices IS NOT DISTINCT FROM $t$["Il construisit un double pont de bateaux amarrés en ligne","Il fit creuser un canal à travers le promontoire de l'Athos","Il fit construire des radeaux géants de bois de cèdre liés au fond","Il utilisa des galères pontées comme pontons flottants fixes"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel général spartiate commandait les forces grecques coalisées à Platées en {479 av. J.-C.} ?$t$
  WHERE id = 418
    AND lore_text IS NOT DISTINCT FROM $t$Un régent de sang royal, tuteur d'un roi trop jeune pour porter le sceptre, prit la tête d'une alliance fragile où Athènes et Sparte se surveillaient du coin de l'œil. Il imposa une discipline de fer aux contingents indisciplinés et attendit le bon moment avec une patience que ses alliés prirent pour de la lâcheté. La victoire lui fut totale — et sa fin, tragique.$t$
    AND question IS NOT DISTINCT FROM $t$Quel général spartiate commandait les forces grecques coalisées à Platées en 479 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Pausanias, régent de Sparte et neveu de Léonidas, commanda la coalition panhellénique à Platées. Sa victoire mit fin à la présence militaire perse en Grèce continentale, mais il fut plus tard accusé de trahison et mourut emmûré dans un temple.$t$
    AND answer IS NOT DISTINCT FROM $t$Pausanias$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel nom porte l'antique conseil aristocratique athénien siégeant sur une colline rocheuse à l'ouest de l'Acropole, dont les pouvoirs furent réduits en {462 av. J.-C.} ?$t$
  WHERE id = 419
    AND lore_text IS NOT DISTINCT FROM $t$On dit que des puissances nocturnes venaient y déposer leurs querelles, bien avant que les hommes n'y portent leurs causes. La colline gardait une mémoire plus longue que celle des cités — et plus froide.$t$
    AND question IS NOT DISTINCT FROM $t$Quel nom porte l'antique conseil aristocratique athénien siégeant sur une colline rocheuse à l'ouest de l'Acropole, dont les pouvoirs furent réduits en 462 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Aréopage (colline d'Arès) était le plus ancien conseil d'Athènes, composé des anciens archontes. Avant 462, il exerçait une tutelle générale sur la constitution. Ephialte lui ôta ces prérogatives politiques, lui laissant principalement les affaires de meurtre.$t$
    AND answer IS NOT DISTINCT FROM $t$L'Aréopage$t$
    AND choices IS NOT DISTINCT FROM $t$["La Pnyx","L'Aréopage","Le Céramique","L'Agora"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel amiral spartiate imposa l'hégémonie de Sparte sur la mer Égée après {404 av. J.-C.}, grâce à une flotte financée par la Perse ?$t$,
    explanation = $t$Lysandre (mort en {395 av. J.-C.}) fut le navarque spartiate qui, grâce aux subsides perses de Cyrus le Jeune, bâtit la flotte qui écrasa Athènes à Aigos-Potamos ({405 av. J.-C.}) ; il instaura ensuite des décarchies pro-spartiates dans les cités soumises.$t$
  WHERE id = 421
    AND lore_text IS NOT DISTINCT FROM $t$On racontait qu'il avait fait forger un sceau unique, qu'il redistribuait l'or des vaincus à ses propres réseaux, que les oligarques des cités lui devaient leur trône. Ses ennemis le disaient corruptible ; ses partisans, inévitable. Quand Sparte le rappela et le condamna, il alla se placer sous la protection du Grand Roi lui-même.$t$
    AND question IS NOT DISTINCT FROM $t$Quel amiral spartiate imposa l'hégémonie de Sparte sur la mer Égée après 404 av. J.-C., grâce à une flotte financée par la Perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Lysandre (mort en 395 av. J.-C.) fut le navarque spartiate qui, grâce aux subsides perses de Cyrus le Jeune, bâtit la flotte qui écrasa Athènes à Aigos-Potamos (405 av. J.-C.) ; il instaura ensuite des décarchies pro-spartiates dans les cités soumises.$t$
    AND answer IS NOT DISTINCT FROM $t$Lysandre$t$
    AND choices IS NOT DISTINCT FROM $t$["Brasidas","Callicratidas","Gylippos","Lysandre"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel roi spartiate domina la politique grecque dans la première moitié du {IVe siècle av. J.-C.} et mena de longues campagnes en Asie Mineure ?$t$,
    explanation = $t$Agésilas II ({445 av. J.-C.}–{360 av. J.-C.}) régna sur Sparte pendant environ quarante ans ; il mena des campagnes victorieuses en Asie Mineure dès {396 av. J.-C.} avant d'être rappelé par la guerre de Corinthe, et resta l'incarnation de l'idéal guerrier spartiate tardif.$t$
  WHERE id = 422
    AND lore_text IS NOT DISTINCT FROM $t$Boiteux de naissance, il avait dû surmonter les réticences de sa propre cité avant de régner. Mais sur le champ de bataille, nul ne contestait son génie. Des années durant, ses armées parcoururent les satrapies comme jadis les Dix-Mille, ravivant le rêve d'un monde grec libéré du joug perse.$t$
    AND question IS NOT DISTINCT FROM $t$Quel roi spartiate domina la politique grecque dans la première moitié du IVe siècle av. J.-C. et mena de longues campagnes en Asie Mineure ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Agésilas II (445–360 av. J.-C.) régna sur Sparte pendant environ quarante ans ; il mena des campagnes victorieuses en Asie Mineure dès 396 av. J.-C. avant d'être rappelé par la guerre de Corinthe, et resta l'incarnation de l'idéal guerrier spartiate tardif.$t$
    AND answer IS NOT DISTINCT FROM $t$Agésilas II$t$
    AND choices IS NOT DISTINCT FROM $t$["Agésilas II","Cléombrote I","Archidamos II","Pausanias"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Empédocle d'Agrigente (vers {495 av. J.-C.}-{435 av. J.-C.}) posait quatre « racines » (ῥιζώματα) : l'eau, la terre, le feu et l'air, gouvernées par deux forces cosmiques antagonistes, l'Amour (φιλία) et la Discorde (νεῖκος).$t$
  WHERE id = 423
    AND lore_text IS NOT DISTINCT FROM $t$Philosophe, médecin et, dit-on, thaumaturge, il parcourait la Sicile en habits de pourpre, convaincu d'être un dieu exilé parmi les mortels. Dans ses poèmes, il voyait le cosmos comme un éternel combat entre union et séparation.$t$
    AND question IS NOT DISTINCT FROM $t$Empédocle d'Agrigente proposa quatre « racines » de toutes choses. Quelles sont-elles ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Empédocle d'Agrigente (vers 495-435 av. J.-C.) posait quatre « racines » (ῥιζώματα) : l'eau, la terre, le feu et l'air, gouvernées par deux forces cosmiques antagonistes, l'Amour (φιλία) et la Discorde (νεῖκος).$t$
    AND answer IS NOT DISTINCT FROM $t$Eau, terre, feu, air$t$
    AND choices IS NOT DISTINCT FROM $t$["Eau, air, feu, éther","Eau, terre, feu, air","Feu, lumière, ténèbres, vide","Eau, terre, bois, métal"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Anaxagore de Clazomènes (vers {500 av. J.-C.}-{428 av. J.-C.}) posait le Noûs (νοῦς, « Esprit » ou « Intelligence ») comme principe immatériel et pur ayant imprimé le mouvement rotatif initial au cosmos, sans se mêler à la matière.$t$
  WHERE id = 424
    AND lore_text IS NOT DISTINCT FROM $t$Venu de Clazomènes en Ionie, ce sage s'installa à Athènes et devint l'ami de Périclès. Poursuivi pour impiété car il affirmait que le Soleil était une pierre ardente, il dut fuir la cité. Avant sa fuite, il avait nommé la force ordonnant le cosmos d'un seul mot souverain.$t$
    AND question IS NOT DISTINCT FROM $t$Anaxagore postulait un principe intellect pur qui mit l'univers en mouvement. Quel est le nom grec de ce principe ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Anaxagore de Clazomènes (vers 500-428 av. J.-C.) posait le Noûs (νοῦς, « Esprit » ou « Intelligence ») comme principe immatériel et pur ayant imprimé le mouvement rotatif initial au cosmos, sans se mêler à la matière.$t$
    AND answer IS NOT DISTINCT FROM $t$Noûs$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Le cinquième postulat d'Euclide (par un point extérieur à une droite, il passe une unique parallèle) fut jugé trop complexe pour un axiome. Sa contestation mena, au {XIXe siècle}, aux géométries non-euclidiennes de Lobatchevski et Riemann.$t$
  WHERE id = 427
    AND lore_text IS NOT DISTINCT FROM $t$Les quatre premiers postulats semblaient coulés de source. Mais le cinquième avait quelque chose d'étrange, de trop chargé — comme si l'édifice entier reposait en secret sur une fondation que le maître lui-même n'osait pas tout à fait regarder en face.$t$
    AND question IS NOT DISTINCT FROM $t$Quel postulat géométrique des Éléments d'Euclide fut contesté pendant deux millénaires avant de donner naissance à des géométries alternatives ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le cinquième postulat d'Euclide (par un point extérieur à une droite, il passe une unique parallèle) fut jugé trop complexe pour un axiome. Sa contestation mena, au XIXe siècle, aux géométries non-euclidiennes de Lobatchevski et Riemann.$t$
    AND answer IS NOT DISTINCT FROM $t$Le postulat des parallèles$t$
    AND choices IS NOT DISTINCT FROM $t$["Le postulat des parallèles","Le postulat du cercle","Le postulat du point","Le postulat de la droite infinie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel sculpteur du {IVe siècle av. J.-C.}, rival de Scopas, est célèbre pour son Hermès portant Dionysos enfant, retrouvé à Olympie ?$t$,
    explanation = $t$Praxitèle (v. {400 av. J.-C.}–{330 av. J.-C.}) sculpta l'Hermès d'Olympie (v. {330 av. J.-C.}) et l'Aphrodite de Cnide, première statue féminine nue monumentale. Son style lyrique contraste avec le classicisme de Polyclète.$t$
  WHERE id = 431
    AND lore_text IS NOT DISTINCT FROM $t$Son ciseau transformait le marbre en chair souple, presque vivante. On disait que ses statues penchaient légèrement, dans une pose déhanchée que les historiens de l'art appelleront plus tard la 'ligne serpentine'. À Cnide, sa représentation d'une déesse nue fit scandale et gloire.$t$
    AND question IS NOT DISTINCT FROM $t$Quel sculpteur du IVe siècle av. J.-C., rival de Scopas, est célèbre pour son Hermès portant Dionysos enfant, retrouvé à Olympie ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Praxitèle (v. 400–330 av. J.-C.) sculpta l'Hermès d'Olympie (v. 330 av. J.-C.) et l'Aphrodite de Cnide, première statue féminine nue monumentale. Son style lyrique contraste avec le classicisme de Polyclète.$t$
    AND answer IS NOT DISTINCT FROM $t$Praxitèle$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Dans la technique à figures rouges, qui remplace la technique à figures noires vers {530 av. J.-C.}, que représente le fond du vase ?$t$
  WHERE id = 432
    AND lore_text IS NOT DISTINCT FROM $t$Un potier du Kerameikos eut un jour l'idée d'inverser tout le procédé. Ce qui était clair devint sombre, ce qui était sombre devint lumineux. Cette révolution silencieuse allait conquérir toutes les cités grecques en moins d'une génération.$t$
    AND question IS NOT DISTINCT FROM $t$Dans la technique à figures rouges, qui remplace la technique à figures noires vers 530 av. J.-C., que représente le fond du vase ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Dans la technique à figures rouges, le fond est recouvert d'engobe noir tandis que les figures gardent la couleur naturelle rouge de l'argile attique. Les détails sont peints au pinceau, non incisés.$t$
    AND answer IS NOT DISTINCT FROM $t$Le fond est peint en noir$t$
    AND choices IS NOT DISTINCT FROM $t$["Le fond est peint en blanc","Le fond est peint en noir","Le fond est laissé en argile naturelle rouge-ocre","Le fond est peint en bleu"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel était le principal minerai extrait des mines du Laurion, dont l'exploitation finança la flotte athénienne au {Ve siècle av. J.-C.} ?$t$,
    explanation = $t$Les mines d'argent du Laurion (Attique) produisaient le métal qui frappait les tétradrachmes athéniens. En {483 av. J.-C.}, Thémistocle convainquit les Athéniens d'utiliser leur revenu exceptionnel pour construire 200 trières, flotte décisive à Salamine.$t$
  WHERE id = 433
    AND lore_text IS NOT DISTINCT FROM $t$Sous les collines du cap Sounion, des milliers de silhouettes courbées creusaient sans relâche dans l'obscurité. Le sol recrachait un métal brillant qui allait transformer la destinée de la cité — non par magie, mais par la volonté d'un stratège qui convainquit l'Assemblée de ne pas partager le butin.$t$
    AND question IS NOT DISTINCT FROM $t$Quel était le principal minerai extrait des mines du Laurion, dont l'exploitation finança la flotte athénienne au Ve siècle av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Les mines d'argent du Laurion (Attique) produisaient le métal qui frappait les tétradrachmes athéniens. En 483 av. J.-C., Thémistocle convainquit les Athéniens d'utiliser leur revenu exceptionnel pour construire 200 trières, flotte décisive à Salamine.$t$
    AND answer IS NOT DISTINCT FROM $t$L'argent$t$
    AND choices IS NOT DISTINCT FROM $t$["L'or","Le cuivre","L'étain","L'argent"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel détroit ou mer était le principal axe d'importation du blé depuis les comptoirs pontiques vers Athènes au {IVe siècle av. J.-C.} ?$t$
  WHERE id = 434
    AND lore_text IS NOT DISTINCT FROM $t$Les négociants athéniens le savaient : sans ce passage étroit entre deux mers, la cité mourrait de faim en moins d'un an. Des escadres entières y patrouillaient pour protéger les convois chargés de grain scythe. Contrôler ces eaux, c'était tenir Athènes par le ventre.$t$
    AND question IS NOT DISTINCT FROM $t$Quel détroit ou mer était le principal axe d'importation du blé depuis les comptoirs pontiques vers Athènes au IVe siècle av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Bosphore (Bosporos Cimmérien inclus) était l'axe stratégique du commerce céréalier athénien : le blé de Crimée et des cités pontiques transitait par le Bosphore de Thrace, raison pour laquelle Athènes y maintenait une influence diplomatique et militaire constante.$t$
    AND answer IS NOT DISTINCT FROM $t$Bosphore$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Xénophon d'Athènes (vers {430 av. J.-C.}–{355 av. J.-C.}) participa à l'expédition des Dix Mille en tant que simple volontaire, puis fut élu stratège après le massacre des généraux. Son Anabase relate cette retraite en sept livres et reste un document militaire et littéraire de premier ordre.$t$
  WHERE id = 435
    AND lore_text IS NOT DISTINCT FROM $t$Élève d'un philosophe athénien, il choisit pourtant la voie des armes plutôt que celle de la pensée pure. Quand les généraux furent assassinés et que le désespoir gagnait les rangs, il se leva devant les soldats rassemblés, leur parla de courage et de devoir — puis saisit le stylet pour immortaliser cette odyssée dans la prose la plus claire de l'Antiquité.$t$
    AND question IS NOT DISTINCT FROM $t$Quel auteur grec a rédigé l'Anabase, récit de la retraite des mercenaires grecs à travers la Perse ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Xénophon d'Athènes (vers 430–355 av. J.-C.) participa à l'expédition des Dix Mille en tant que simple volontaire, puis fut élu stratège après le massacre des généraux. Son Anabase relate cette retraite en sept livres et reste un document militaire et littéraire de premier ordre.$t$
    AND answer IS NOT DISTINCT FROM $t$Xénophon$t$
    AND choices IS NOT DISTINCT FROM $t$["Thucydide","Polybe","Xénophon","Arrien"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$La catapulte à torsion (palintone ou lithobolos) utilisait l'énergie emmagasinée dans des faisceaux de cordes ou de tendons torsadés pour propulser des boulets de pierre. Perfectionnée sous Philippe II et Alexandre le Grand, elle révolutionna la poliorcétique grecque au {IVe siècle av. J.-C.}$t$
  WHERE id = 436
    AND lore_text IS NOT DISTINCT FROM $t$Devant les hauts murs de pierre, les généraux savaient qu'aucune charge frontale ne suffirait. Les ingénieurs calculaient les angles, tendaient les fibres avec une précision quasi rituelle — et soudain la muraille qui semblait éternelle commençait à craindre pour la première fois la colère humaine.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle machine de siège, utilisant la tension de cordes torsadées, permit de lancer des projectiles lourds lors des sièges grecs et macédoniens ?$t$
    AND explanation IS NOT DISTINCT FROM $t$La catapulte à torsion (palintone ou lithobolos) utilisait l'énergie emmagasinée dans des faisceaux de cordes ou de tendons torsadés pour propulser des boulets de pierre. Perfectionnée sous Philippe II et Alexandre le Grand, elle révolutionna la poliorcétique grecque au IVe siècle av. J.-C.$t$
    AND answer IS NOT DISTINCT FROM $t$Catapulte à torsion (palintone)$t$
    AND choices IS NOT DISTINCT FROM $t$["Bélier couvert (tortue)","Oxybèle","Catapulte à torsion (palintone)","Tour de siège (hélépole)"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quelle reine, vassale de l'empire perse, commanda ses propres navires à la bataille de Salamine en {480 av. J.-C.} ?$t$
  WHERE id = 438
    AND lore_text IS NOT DISTINCT FROM $t$Dans le fracas des éperons et des rames brisées, une figure singulière manœuvrait avec une audace qui stupéfia les deux camps. Xerxès, dit-on, la vit éperonner un navire et s'exclama que ses hommes s'étaient transformés en femmes et ses femmes en hommes. Son origine même semblait un croisement de mondes.$t$
    AND question IS NOT DISTINCT FROM $t$Quelle reine, vassale de l'empire perse, commanda ses propres navires à la bataille de Salamine en 480 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Artémise Ire d'Halicarnasse, reine de Carie et vassale de Xerxès, commanda cinq navires à Salamine. Elle fut la seule à déconseiller l'engagement naval à Xerxès ; pendant la bataille, elle coula un navire allié pour s'échapper, trompant les Athéniens qui la poursuivaient.$t$
    AND answer IS NOT DISTINCT FROM $t$Artémise d'Halicarnasse$t$
    AND choices IS NOT DISTINCT FROM $t$["Artémise d'Halicarnasse","Phérétimé de Cyrène","Atossa de Perse","Laodice de Carie"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Quel nom portait le détroit entre l'Asie et l'Europe que Xerxès franchit sur ses ponts de bateaux en {480 av. J.-C.} ?$t$,
    explanation = $t$L'Hellespont (actuel détroit des Dardanelles) fut franchi par Xerxès en {480 av. J.-C.} grâce à deux ponts de bateaux consécutifs. Hérodote estime que le passage de l'armée prit sept jours et sept nuits.$t$
  WHERE id = 439
    AND lore_text IS NOT DISTINCT FROM $t$Les anciens l'appelaient la frontière entre deux mondes, le lieu où la terre ferme cédait à un bras d'eau chargé de vents capricieux. Des villes prospères gardaient ses rives depuis des siècles, témoins de tous les passages et de toutes les ambitions. Franchir ce seuil liquide n'était pas seulement un acte militaire — c'était une déclaration cosmique.$t$
    AND question IS NOT DISTINCT FROM $t$Quel nom portait le détroit entre l'Asie et l'Europe que Xerxès franchit sur ses ponts de bateaux en 480 av. J.-C. ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'Hellespont (actuel détroit des Dardanelles) fut franchi par Xerxès en 480 av. J.-C. grâce à deux ponts de bateaux consécutifs. Hérodote estime que le passage de l'armée prit sept jours et sept nuits.$t$
    AND answer IS NOT DISTINCT FROM $t$Hellespont$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Démosthène ({384 av. J.-C.}-{322 av. J.-C.}) prononça les Philippiques ({351 av. J.-C.}-{341 av. J.-C.}), série de discours politiques devant l'Ecclesia pour mobiliser Athènes contre la puissance montante de Philippe II de Macédoine.$t$
  WHERE id = 440
    AND lore_text IS NOT DISTINCT FROM $t$Ses mots tombaient sur l'Ecclesia comme des pierres dans un lac calme — chaque discours envoyait des cercles jusqu'aux bords de la cité. On raconte qu'il s'entraînait avec des galets dans la bouche pour forger une éloquence capable de réveiller un peuple endormi.$t$
    AND question IS NOT DISTINCT FROM $t$Quel orateur athénien du IVe siècle prononça les Philippiques pour alerter la cité sur la menace macédonienne croissante ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Démosthène (384-322 av. J.-C.) prononça les Philippiques (351-341 av. J.-C.), série de discours politiques devant l'Ecclesia pour mobiliser Athènes contre la puissance montante de Philippe II de Macédoine.$t$
    AND answer IS NOT DISTINCT FROM $t$Démosthène$t$
    AND choices IS NOT DISTINCT FROM $t$["Isocrate","Eschine","Démosthène","Hypéride"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    explanation = $t$Épictète (vers {50 ap. J.-C.}-{135 ap. J.-C.}) naquit à Hiérapolis en Phrygie (actuelle Turquie). Esclave à Rome, il fut affranchi et fonda à Nicopolis une école dont les leçons furent consignées par Arrien dans le Manuel et les Entretiens.$t$
  WHERE id = 442
    AND lore_text IS NOT DISTINCT FROM $t$Né dans les fers, vendu comme bien meuble, il entendit un jour son maître lui briser la jambe pour en éprouver la résistance. Il resta impassible. Cette impassibilité, il en fit toute sa philosophie : seul l'intérieur nous appartient, jamais les chaînes du monde.$t$
    AND question IS NOT DISTINCT FROM $t$Épictète était esclave avant de devenir philosophe. Dans quelle ville d'Asie Mineure est-il né ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Épictète (vers 50-135 apr. J.-C.) naquit à Hiérapolis en Phrygie (actuelle Turquie). Esclave à Rome, il fut affranchi et fonda à Nicopolis une école dont les leçons furent consignées par Arrien dans le Manuel et les Entretiens.$t$
    AND answer IS NOT DISTINCT FROM $t$Hiérapolis$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Des malades venaient de tout le bassin méditerranéen pour y dormir sur la peau sacrée. Le tholos mystérieux du sanctuaire, aux labyrinthes souterrains, intriguait encore les archéologues du {XXe siècle}. La guérison du corps et la beauté de la pierre semblaient ici inséparables.$t$
  WHERE id = 446
    AND lore_text IS NOT DISTINCT FROM $t$Des malades venaient de tout le bassin méditerranéen pour y dormir sur la peau sacrée. Le tholos mystérieux du sanctuaire, aux labyrinthes souterrains, intriguait encore les archéologues du XXe siècle. La guérison du corps et la beauté de la pierre semblaient ici inséparables.$t$
    AND question IS NOT DISTINCT FROM $t$Quel sanctuaire d'Asclépios, dans le Péloponnèse, était considéré comme le plus grand centre d'incubation du monde grec, célèbre aussi pour son théâtre aux acoustiques parfaites ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le sanctuaire d'Asclépios à Épidaure (Argolide) est le plus grand Asclépeion connu. Son théâtre (IVe s. av. J.-C., architecte Polyclète le Jeune) est réputé pour son acoustique exceptionnelle. Le tholos (rotonde) comportait un couloir souterrain en spirale dont la fonction reste discutée.$t$
    AND answer IS NOT DISTINCT FROM $t$Épidaure$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Myron sculpta vers {450 av. J.-C.} une statue représentant un athlète au moment précis du lancer. Quel sport pratique cet athlète ?$t$,
    explanation = $t$Le Discobole (Diskobolos) de Myron, vers {450 av. J.-C.}, représente un lanceur de disque en pleine rotation, bras tendu en arrière. L'original en bronze est perdu ; on le connaît par des copies romaines en marbre.$t$
  WHERE id = 448
    AND lore_text IS NOT DISTINCT FROM $t$L'œuvre originale en bronze a disparu, mais des copies romaines en marbre ont traversé les siècles. Ce moment figé défie la physique : l'artiste captura un instant impossible, suspendu entre élan et libération, comme si le temps lui-même avait obéi au ciseau.$t$
    AND question IS NOT DISTINCT FROM $t$Myron sculpta vers 450 av. J.-C. une statue représentant un athlète au moment précis du lancer. Quel sport pratique cet athlète ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Le Discobole (Diskobolos) de Myron, vers 450 av. J.-C., représente un lanceur de disque en pleine rotation, bras tendu en arrière. L'original en bronze est perdu ; on le connaît par des copies romaines en marbre.$t$
    AND answer IS NOT DISTINCT FROM $t$Le disque$t$
    AND choices IS NOT DISTINCT FROM $t$["Le javelot","Le marteau","Le disque","La fronde"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    lore_text = $t$Ses pièces avaient presque toutes disparu, réduites à des fragments épars pendant deux millénaires. Puis un papyrus découvert en Égypte au {XXe siècle} rendit à la littérature grecque une voix perdue, celle d'un maître des caractères humains et des intrigues de mœurs.$t$,
    question = $t$Quel auteur comique grec du {IVe siècle av. J.-C.}–{IIIe siècle av. J.-C.}, représentant de la 'comédie nouvelle', est l'auteur du Dyscolos (Le Bourru) ?$t$,
    explanation = $t$Ménandre (v. {342 av. J.-C.}–{290 av. J.-C.}) est le maître de la comédie nouvelle athénienne. Le Dyscolos, sa seule pièce quasi intégrale, a été retrouvé sur le papyrus Bodmer en {1952} en Égypte.$t$
  WHERE id = 449
    AND lore_text IS NOT DISTINCT FROM $t$Ses pièces avaient presque toutes disparu, réduites à des fragments épars pendant deux millénaires. Puis un papyrus découvert en Égypte au XXe siècle rendit à la littérature grecque une voix perdue, celle d'un maître des caractères humains et des intrigues de mœurs.$t$
    AND question IS NOT DISTINCT FROM $t$Quel auteur comique grec du IVe–IIIe siècle av. J.-C., représentant de la 'comédie nouvelle', est l'auteur du Dyscolos (Le Bourru) ?$t$
    AND explanation IS NOT DISTINCT FROM $t$Ménandre (v. 342–290 av. J.-C.) est le maître de la comédie nouvelle athénienne. Le Dyscolos, sa seule pièce quasi intégrale, a été retrouvé sur le papyrus Bodmer en 1952 en Égypte.$t$
    AND answer IS NOT DISTINCT FROM $t$Ménandre$t$
    AND choices IS NOT DISTINCT FROM NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  UPDATE enigmas SET
    question = $t$Lors du siège de Rhodes par Démétrios Poliorcète ({305 av. J.-C.}–{304 av. J.-C.}), quel engin de siège monumental lui valut son surnom ?$t$
  WHERE id = 453
    AND lore_text IS NOT DISTINCT FROM $t$On dit que jamais encore on n'avait vu pareille construction rouler vers une muraille. Des centaines d'hommes tiraient sur des cordages, faisant avancer une tour de neuf étages bardée de métal, protégée par des peaux mouillées contre les projectiles enflammés. Les Rhodiens résistèrent, mais le monde grec retint le nom de celui qui avait osé bâtir une telle bête.$t$
    AND question IS NOT DISTINCT FROM $t$Lors du siège de Rhodes par Démétrios Poliorcète (305–304 av. J.-C.), quel engin de siège monumental lui valut son surnom ?$t$
    AND explanation IS NOT DISTINCT FROM $t$L'hélépole (« preneur de villes ») était une immense tour de siège mobile, construite pour Démétrios Poliorcète par l'ingénieur Épimacos d'Athènes. Lors du siège de Rhodes, elle atteignait environ 40 mètres de haut sur neuf niveaux. C'est cet engin qui valut à Démétrios son surnom de 'Poliorcète' (assiégeur de villes).$t$
    AND answer IS NOT DISTINCT FROM $t$L'hélépole (preneur de ville)$t$
    AND choices IS NOT DISTINCT FROM $t$["L'arète (bélier géant)","L'hélépole (preneur de ville)","Le sambuca (échelle d'assaut navale)","Le gastraphète (arc-ventre)"]$t$::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  IF total <> 251 THEN
    RAISE EXCEPTION 'dates balisées : % énigmes mises à jour sur 251 attendues', total;
  END IF;
END
$migration$;
