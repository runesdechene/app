# 005 — La documentation dans le code

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
Uriel doit pouvoir ouvrir n'importe quel fichier et le comprendre en codeur moyen.

## Décision
Trois étages :
- **en tête de chaque fichier**, un bloc `QUOI` (ce qu'il fait), `POURQUOI` (sa raison d'être ou
  le choix non évident), `ATTENTION` si un piège existe, avec son renvoi ;
- **un `README.md` par dossier** : ce qu'on y range, ce qu'on n'y range pas ;
- **`docs/v2/decisions/`** : une page par choix structurant.

Dans le corps du code, un commentaire dit **pourquoi**, jamais ce que la ligne dit déjà.

## Écarté
- **Une ligne « utilisé par »** dans l'en-tête — fausse au premier déplacement, et l'éditeur la
  retrouve seul.

## Conséquences
- Les fichiers générés (`database.types.ts`) et les JSON sont dispensés d'en-tête.
