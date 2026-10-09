# 003 — TanStack Query pour les données serveur

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
Dans la V1, chaque store Zustand charge ses données lui-même : chargement, erreur, nouvelle
tentative et cache y sont réécrits à la main, différemment à chaque fois. Le backlog technique
relève un motif d'« échecs muets » — des flux qui échouent sans trace pendant des mois.

## Décision
Toute donnée qui vient du serveur passe par TanStack Query : un cache unique (`app/queryClient.ts`),
des états chargement / erreur / données uniformes, des relances réglées une fois. Zustand ne sert
que pour un état d'interface que React seul ne porte pas bien — et jamais pour stocker des
données serveur.

## Écarté
- **Des stores Zustand qui chargent eux-mêmes** (le modèle V1) — chaque store réinvente la
  gestion d'erreur, c'est là que naissent les échecs muets.

## Conséquences
- Une erreur de chargement est un état visible, toujours rendu par l'écran.
