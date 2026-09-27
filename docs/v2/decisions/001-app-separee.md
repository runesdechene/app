# 001 — Une app séparée, servie sous /v2/

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
La V2 réécrit tout le front, de zéro, contre le même Supabase. Elle doit vivre à côté de la V1
sans la toucher, rester invisible aux joueurs pendant sa construction, et permettre de passer de
l'une à l'autre sans se reconnecter.

## Décision
Une app neuve, `apps/web-v2`, publiée sur son propre site Netlify (`rdc-web-v2`) et servie sous
`app.runesdechene.com/v2/` par une redirection 200 depuis le site de la V1 — le même mécanisme
que `/lieu/*` vers `seo-pages`. Même origine, donc même session Supabase.

## Écarté
- **Un dossier `src/v2/` dans explore-web**, derrière un drapeau (méthode Fellowship) — la V2
  hériterait des dépendances, de la configuration et de la tentation d'importer la V1. Jamais pure,
  et la bascule finale deviendrait un démêlage.
- **Un sous-domaine `v2.runesdechene.com`** — autre origine, donc autre session : reconnexion
  obligatoire à chaque passage, pour Uriel comme pour ses testeurs.

## Conséquences
- Le service worker de la V1 doit ignorer `/v2` ; celui de la V2 a pour portée `/v2/`.
- Le jour de la bascule : on inverse les deux sites et on supprime `apps/explore-web`.
