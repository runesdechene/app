# Charte de ton des énigmes + passe didactique sur la Grèce antique

> Spec — 2026-06-16
> Statut : en attente de revue utilisateur

## Problème

Le 2e batch d'énigmes grecques (`mig 261`, ~88 énigmes) est **trop académique et trop pointu**. Beaucoup interrogent des détails de spécialiste dont « tout le monde s'en fout » (la théurgie de Jamblique, les *énagismata*, le *métoikion*, des noms de navarques ou de Diadoques obscurs), souvent sous forme de **loterie entre 4 noms grecs inconnus**. Résultat : ça intimide et risque de faire fuir le joueur, au lieu de lui faire **découvrir un monde merveilleux**.

La « charte mig 010 » en vigueur prônait l'immersion *sans fuite de réponse* — un objectif qui, poussé trop loin, produit des questions injouables pour un non-historien.

## Objectif

1. **Définir et enregistrer une charte de ton didactique** réutilisable par le workflow multi-agents de génération *et* par l'humain.
2. **Réécrire les énigmes grecques les plus pointues** en les *reformulant vers l'iconique* (on garde le nombre d'énigmes, on change le sujet pour quelque chose de célèbre et marquant).

Hors-scope : les énigmes des autres thèmes (la charte les couvrira pour le futur, mais on ne les retouche pas maintenant) ; la génération de tout nouveau batch.

## La charte de ton (artefact durable)

**Esprit directeur :** chaque énigme fait *découvrir un monde merveilleux*, pas passer un examen. On s'adresse au joueur comme à un voyageur qu'on émerveille, jamais comme à un étudiant en histoire ancienne.

**Règle 1 — Le sujet : l'émerveillement avant l'érudition.**
On interroge ce qui fait rêver et résonne (Marathon, le cheval de Troie, l'oracle de Delphes, Socrate, le Phare d'Alexandrie, les 300 des Thermopyles), pas le détail de spécialiste.
*Test décisif* : « un curieux non-historien a-t-il envie de connaître cette réponse ? » Si non → on retire ou on reformule vers l'iconique.

**Règle 2 — Le ton : la voix du conteur.**
Lore et question parlent avec chaleur et émerveillement (« On raconte que… », « Imagine une cité où… »), comme une porte qui s'ouvre sur un monde. On évite l'énoncé sec et la surcharge de dates précises (« en 479 av. J.-C. ») dans la *question* ; les dates vivent dans l'explication.

**Règle 3 — La jouabilité : une chance honnête.**
Une seule mauvaise réponse vraiment plausible ; les autres reconnaissables ou clairement hors-sujet / hors-époque. Jamais 4 noms inconnus interchangeables. On préfère une difficulté qui vient de la *réflexion*, pas de l'érudition pure.

**Règle 4 — L'explication : la mini-leçon qui reste.**
Le champ `explanation` devient une petite histoire mémorable qui apprend *et* donne envie d'en savoir plus (le moment « ah, je ne savais pas, c'est fascinant ! »), pas une fiche encyclopédique laconique.

### Où l'enregistrer

- **Source de vérité : la Citadelle (Obsidian)** — note dédiée dans la zone game-design de l'app (chemin exact à confirmer en revue ; candidat : `📱 L'application (La Carte)/🛠️ DEV/` ou la Bible Game Design). C'est une décision de marque/design → couche Obsidian du 4-Layer Query Rule.
- **Pointeur technique** : l'en-tête de la nouvelle migration référence cette charte (comme `mig 261` référençait « charte mig 010 »), pour que le prochain workflow de génération la retrouve.

## Passe d'application sur la Grèce antique

### Critère de sélection
Une énigme est réécrite si elle viole **R1** (sujet de spécialiste sans attrait grand public) **ou R3** (distracteurs = loterie de noms obscurs).

### Lot « clairement à reformuler » (mig 261)
Reformulation vers un sujet iconique du **même registre** (politique / guerre / philo / sciences / religion / art), **dé-dupliqué** contre tout le corpus existant (mig 010 + 261) :

| Ligne | Sujet actuel (trop pointu) | Registre pour le remplacement iconique |
|------|-----------------------------|-----------------------------------------|
| 10 | Mardonios (général perse à Platées) | guerres médiques |
| 15 | l'Apella (assemblée spartiate) | institutions/Sparte |
| 24 | bataille d'Ipsos (Diadoques) | époque hellénistique |
| 39 | Ephialte (réforme de l'Aréopage) | démocratie athénienne |
| 40 | les périèques | société spartiate |
| 47 | « roue de la Génèse » (orphisme) | religion/mystères |
| 48 | les *énagismata* | religion/rites |
| 58 | Iphicrate (réforme militaire) | armée grecque |
| 61 | Léotychidas (Mycale) | guerres médiques |
| 64 | la *mistophorie* | démocratie athénienne |
| 70 | Érasistrate (anatomie) | sciences/médecine |
| 87 | Démocrite (connaissance bâtarde/légitime) | philosophie |
| 89 | la théurgie (Jamblique) | philosophie/religion |
| 95 | le *métoikion* (impôt des métèques) | société athénienne |

### Lot « à adoucir » (confirmer en revue, ne pas forcer)
Sujets un peu niches mais récupérables — soit on adoucit le ton/distracteurs sans changer le sujet, soit on laisse : Anaximène (l.17), pentécontère (l.32), Artémision (l.36), Héliée (l.37), Théophraste (l.44), Séleukos (l.52), apoikia (l.57), peltaste (l.59), Anaxagore/Noûs (l.68), Hipparque/coordonnées (l.88), orchestra (l.94), Épictète/ville natale (l.86 → recadrer sur l'homme, pas sur Hiérapolis).

### À conserver tels quels
Mig 010 dans son ensemble (déjà iconique) ; et dans mig 261 les belles entrées évocatrices : Salamine, Ératosthène, Phare d'Alexandrie, chouette d'Athènes, Xerxès/pont de bateaux, Orphée, Zénon & la tortue, Artémise d'Halicarnasse, Démosthène, Discobole de Myron, oracle de Trophonios, Épidaure, etc. Le chêne de Dodone (l.21) est conservé (clin d'œil à la marque).

## Mécanisme technique

- **Nouvelle migration** `supabase/migrations/262_enigmes_grecques_ton.sql`, idempotente.
- Chaque réécriture = un `UPDATE enigmas SET question=…, lore_text=…, choices=…, answer=…, explanation=…, difficulty=… WHERE theme='grecque' AND question = '<texte exact de la question actuelle>'`.
  - La **question actuelle (texte exact)** sert de clé stable inter-environnements (les `id` sériels peuvent différer ; pas de `heritage_id` depuis mig 260).
  - **Idempotence** : la migration est *one-shot par construction*. Ré-exécutée, le `WHERE` sur l'ancien texte de question ne matche plus aucune ligne (elle a été remplacée) → 0 update, aucun effet de bord. C'est le comportement attendu et sûr ; pas besoin d'identifiant artificiel.
- **Anti-doublon** : avant d'écrire chaque nouveau sujet, vérifier qu'aucune énigme existante (mig 010 + 261) ne le couvre déjà.
- **Pipeline Graphify SQL** : le hook post-commit relance `scripts/graphify-sql.py` sur les migrations — rien de spécial à faire.

## Exécution

La réécriture de ~14 énigmes (+ adoucissements éventuels) avec **fact-check** et **dé-duplication** est un travail de contenu soigné. Deux options, à trancher au moment du plan :
- **Inline** : je les rédige par lots, avec vérification factuelle, dans la session.
- **Workflow multi-agents** (même pattern que la génération de mig 261 : fan-out + fact-check adversarial) — *uniquement si tu l'actives explicitement*, car c'est consommateur de tokens.

## Critères de succès

- Une charte de ton existe, est enregistrée dans la Citadelle et référencée par la migration.
- Les 14 énigmes « loterie/spécialiste » identifiées sont remplacées par des énigmes iconiques, jouables, au ton de conteur, avec explication « mini-leçon ».
- Aucun doublon introduit ; répartition de difficulté préservée (ou ajustée sciemment).
- `pnpm build` OK ; migration idempotente vérifiée.
