# Spec — Chat d'événement visible en lecture seule par les spectateurs

> Date : 2026-06-19 · App : explore-web · Sous-système : Expéditions (tables `voyage_*`)

## Contexte & problème

Le chat d'un événement (expédition) n'est aujourd'hui visible **que pour les membres**
(chef ou participant `validated`). Un utilisateur qui n'a pas (encore) rejoint ne voit
rien de la discussion — alors que voir l'équipage échanger donne envie de rejoindre et
montre que l'événement est vivant.

On veut **rendre le chat lisible par les non-participants (spectateurs)**, en **lecture
seule**, avec un appel à l'action clair pour rejoindre.

## Décisions produit (validées)

- **Niveau d'accès** : lecture seule pour les spectateurs. Seuls chef/participants
  validés écrivent.
- **Vue spectateur** : à la place de la zone de saisie, un bandeau « Tu observes cet
  événement » + bouton « Rejoindre l'équipage ».
- **Portée** : toujours visible pour tous les événements. Pas d'option privé/public.

## Faisabilité — 100% front

Aucune migration, aucun changement serveur. Vérifié :

- `send_voyage_message` (mig 107/115) restreint déjà l'écriture au chef ou participant
  `validated` → l'écriture spectateur est **déjà bloquée serveur**.
- La lecture des messages ne passe par **aucun RPC ni RLS** : `useExpeditionChat`
  fait un `SELECT` direct sur `voyage_messages` + une subscription Realtime
  `postgres_changes`. La garde actuelle est **purement front** (`chatVisible = isMember`).
- `get_voyage` (mig 105) renvoie déjà `chief` + `validated_participants` à **tout
  utilisateur**, donc `participantsById` (avatars/noms/couleurs du fil) est peuplable
  pour un spectateur sans donnée serveur supplémentaire.

## Changements

### 1. `ExpeditionModal.tsx` — visibilité du chat

Avant :
```ts
const chatVisible = isMember && (e.status === 'published' || e.status === 'passed')
```
Après :
```ts
const chatVisible = e.status === 'published' || e.status === 'passed'
```
Le chat s'affiche pour tout utilisateur authentifié tant que l'événement est sur la
carte. Il disparaît toujours à `archived` (inchangé).

`isMember` reste calculé et est transmis à `<ExpeditionChat>` via une nouvelle prop
`canWrite` (voir §2).

### 2. `ExpeditionChat.tsx` — écriture réservée aux membres + bandeau spectateur

Nouvelle prop : `canWrite: boolean` (= `isMember`) et `onJoin: () => void`.

- `canWrite === true` → input de saisie affiché (comportement actuel).
- `canWrite === false` → à la place de l'input, un **bandeau spectateur** :
  - icône 👁️ + texte « Tu observes cet événement »
  - bouton « Rejoindre l'équipage » → appelle `onJoin`.

Le hook `useExpeditionChat` reste monté pour tous (lecture live), mais voir §4 pour
`markRead`.

### 3. CTA « Rejoindre » — réutilisation du flux existant

`onJoin` (fourni par `ExpeditionModal`) réutilise la candidature existante
(`requestJoinExpedition` / `handleRequest`, section « Demande à rejoindre » l.491) :

- `validation_mode === 'free'` → rejoint immédiatement (`handleRequest`).
- sinon → amener l'utilisateur vers la section « Demande à rejoindre » existante
  (scroll desktop / bascule tab Infos mobile) pour qu'il laisse un mot au chef.

Aucune duplication de la logique de jointure.

### 4. Libellé & cohérence

- Header « Préparation · chat **privé** » → « Préparation · chat de l'équipage »
  (« privé » est désormais faux — et l'était déjà techniquement).
- `markExpeditionMessagesRead` **n'est appelé que pour les membres** : un spectateur ne
  doit pas créer d'enregistrements de lecture ni affecter les compteurs non-lus.
  Vérifier/garder cette garde dans `useExpeditionChat` (passer `canWrite`/`isMember` au
  hook si nécessaire, ou conditionner l'appel).

## Hors périmètre (YAGNI)

- Pas de toggle privé/public (portée « toujours visible » validée).
- Pas de RLS ni de RPC de lecture.
- Pas de séparation visuelle de messages par type d'auteur : en lecture seule, seuls les
  membres postent, il n'y a pas de message « spectateur » à distinguer dans le fil.

## Note de transparence

Le chat « privé » est en réalité **déjà lisible** par n'importe quel client connaissant
l'`voyage_id` (table `voyage_messages` sans RLS). Ce changement aligne l'UI sur cette
réalité existante. Un *vrai* chat privé sélectif serait un chantier inverse (RLS + RPC de
lecture) — hors de ce ticket.

## Critères de succès

- Un non-participant qui ouvre un événement `published`/`passed` voit le fil de
  discussion en lecture seule.
- Il voit le bandeau « Tu observes… » + « Rejoindre l'équipage » à la place de l'input.
- Le bouton déclenche le flux de candidature existant (join direct si `free`, sinon
  section demande).
- Un membre garde l'input et peut écrire comme avant.
- Un spectateur ne génère aucun enregistrement `mark_voyage_messages_read`.
- À `archived`, le chat disparaît pour tous (inchangé).
- Build TS strict OK, pas de `any`, pas de code mort.
