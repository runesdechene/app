# Façon de travailler dans ce dépôt

> Se charge toujours. Le reste de la méthode vit dans le vault : `_Socle/Méthode.md`.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## Pas d'assomption sur l'heure de la journée

Ne jamais clore une session avec un "bonne nuit" / "bon matin" / "bonne journée" sans avoir vérifié l'heure réelle.

**Why:** 6 mai 2026 — fin de session "Costaud" V0.7+ Expéditions, j'ai écrit "Bonne nuit 🚩" alors qu'il était 16h56 (milieu d'après-midi). Uriel m'a corrigé : *"On est le matin haha, cesse de me dire bonne nuit, et vérifie le timestamp du pc."* Présomption flemmarde — j'ai assumé que fin de session = fin de journée. Faux.

**How to apply:**
- Si je veux marquer la fin d'une session avec une formule de politesse, **vérifier d'abord l'heure** via `Get-Date` (PowerShell) ou `date` (bash).
- Préférer des formules neutres qui ne dépendent pas du moment : "À la prochaine", "On s'arrête là", "Session bouclée", "Bon retour à tes autres trucs".
- Si vraiment je veux contextualiser temporellement : checker l'heure d'abord, puis dire "bon après-midi" / "bonne soirée" / "bonne nuit" en connaissance de cause.
- Uriel bosse à des heures variées — ne jamais assumer son rythme depuis le mien (qui n'existe pas).

## Décisions BDD dans le code, pas dans Obsidian

À partir du 23 avril 2026, **toute nouvelle décision BDD** (schema, RPC,
migration, gotcha SQL) va dans le **code du repo**, pas dans Obsidian :

- **Décision liée à une migration** → commentaire SQL en tête du fichier
  migration : `-- WHY: ...` qui explique le pourquoi du choix.
- **Gotcha DB transverse** (ex: STABLE ignore UPDATE silencieusement) →
  `docs/db/gotchas.md` versionné dans le repo (à créer quand on en a une
  première à écrire — YAGNI).
- **Convention SQL / workflow migrations** → `CLAUDE.md` du repo (déjà fait
  en partie).

**Why** : Uriel a tranché le 23 avril que la zone DEV d'Obsidian est
sous-utilisée et finit par produire des doublons (avec le code, avec les
vues racine, avec elle-même). Graphify indexe le code, donc une décision
SQL colocalisée avec sa migration est :
1. Jamais désynchronisée (le commentaire suit le code)
2. Lue en même temps que la migration
3. Indexée par Graphify
4. Suit les branches Git

**How to apply** :
- Plus rien de nouveau dans `📱 L'application (La Carte)/🛠️ DEV/` du vault.
- Le legacy DEV reste pour l'instant — migration progressive plus tard
  (étape 2, pas urgent).
- Obsidian = vues racine, brainstorm conceptuel, stratégie, marque, missions,
  rétrospectives, planification. **Pas le technique**.

**Plan de bascule** :
- Étape 1 (acquise 23/04) : règle "code-first" pour tout NOUVEAU technique.
- ✅ Étape 2 (faite 28/04) : zone DEV entièrement dissoute, 40 notes migrées
  vers `<repo>/docs/db/` (gotchas, auth, storage, migrations-workflow, README)
  + 4 notes vault consolidées (`Préférences Uriel`, `Décisions Game Design 2026`,
  `Setup nouveau PC`, `_Index DEV` slim). Wrapper `scripts/graphify-sql.py`
  ingère les commentaires SQL en tête de migration (104 RPCs + 55 tables).
  Hook post-commit auto. Commits `0c5fc5c` + `7ae7a36`.

## Relire et nettoyer la mémoire régulièrement

Relire la mémoire (MEMORY.md + fichiers liés) environ une fois par semaine pour vérifier que tout est à jour.

**Why:** Uriel a demandé le 29 mars 2026 que je vérifie régulièrement si ma mémoire est cohérente avec l'état réel du projet. Les sessions passent vite, les décisions changent (ex: rollback 4 jauges → 1), et des infos obsolètes peuvent induire en erreur.

**How to apply:** En début de session, si ça fait plus d'une semaine depuis la dernière revue :
1. Relire MEMORY.md — les sections sont-elles toujours vraies ?
2. Vérifier les sessions récentes — retirer celles de plus de 2 semaines ou les archiver
3. Vérifier les feedbacks — sont-ils toujours applicables ?
4. Mettre à jour la date de dernière revue dans le fichier
5. Ne pas encombrer : si un fichier de session est trop vieux et les infos sont dans le CLAUDE.md → supprimer le fichier

**Dernière revue : 29 mars 2026**

## Toujours mettre à jour CLAUDE.md en fin de session

En fin de session, quand Uriel indique qu'on a terminé, le XO DOIT mettre à jour le CLAUDE.md du projet sur lequel on a travaillé.

**Why:** Uriel veut garder une trace des avancements session par session. Le CLAUDE.md est la mémoire du projet — sans mise à jour, les sessions suivantes ne savent pas ce qui a changé.

**How to apply:** À chaque fin de session (ou quand Uriel dit "on a fini" / "bonne nuit" / "on s'arrête là"), mettre à jour :
- La date de dernière mise à jour
- Les bugs corrigés
- Les features ajoutées
- Les migrations créées
- Les changements d'architecture
