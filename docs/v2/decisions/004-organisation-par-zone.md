# 004 — Le code rangé par zone

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
Chercher « le Codex » doit mener à un seul dossier. La V1 range par type technique et compte
huit fichiers de plus de 700 lignes.

## Décision
`src/features/<zone>/` par zone de l'app (accueil, carte, messages, codex, campement, compte),
`src/shared/` pour ce que deux zones utilisent, `src/app/` pour la coquille. Trois règles,
vérifiées par ESLint :
1. un composant ne parle jamais à Supabase — il passe par un hook, qui passe par `api/` ;
2. une zone n'importe jamais une autre zone ;
3. rien n'importe la V1.

Et 400 lignes au plus par fichier (`max-lines`).

## Écarté
- **Rangement par type** (`components/`, `stores/`, `hooks/` à la racine) — une zone s'éparpille
  dans tout l'arbre.

## Conséquences
- Un code partagé monte dans `shared/` quand une deuxième zone en a besoin, pas avant.
