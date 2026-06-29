# Mode Démo Borne — Design

**Date :** 2026-06-29
**Statut :** Spec validée, en attente de plan d'implémentation

## Contexte & objectif

Sur le stand Runes de Chêne, un grand écran tactile en **format portrait** affiche
l'application. On veut que les visiteurs puissent **jouer librement** avec
l'application : énergie infinie, Couronnes infinies, énigmes résolvables en boucle —
le tout **sans jamais polluer le vrai jeu** (classements, lieux, compagnies, données
des vrais veilleurs).

La démo est purement **visuelle et éphémère** : tout ce qui se passe pendant une
session vit en mémoire et disparaît au reset.

## Décisions verrouillées (brainstorming)

1. **Isolement = zéro écriture (sandbox client).** La démo *lit* la vraie carte mais
   aucune action n'écrit en base.
2. **Profil de départ = vierge.** Niveau 1, pas de compagnie, 0 lieu découvert. Le
   visiteur découvre l'app comme un nouveau veilleur.
3. **GPS = tout est « à distance ».** Aucune simulation de position. Comme l'énergie
   est infinie, le visiteur Découvre tout à distance. On ne montre pas le geste
   « Visiter sur place » (GPS).
4. **Scope jouable :** Découvrir des lieux ; Dépenser des Couronnes ; Énigmes
   (résolvables en boucle, infinies). **Compagnies = hors-démo** (panneau bloquant).
5. **Reset = écran d'intro après 10 min d'inactivité** (belle photo + voile + gros
   bouton « Entrer sur la carte »), puis mini-popup de bienvenue très court, puis jeu.
6. **Résilience = approche A + préchargement au démarrage** (live + cache d'une zone
   de carte généreuse au lancement).
7. **Compte de lecture = vrai compte démo Supabase dédié**, sans aucun droit
   d'écriture en base (filet de sécurité réel).

## Architecture

### Vue d'ensemble

```
Borne (kiosk plein écran)
  └── demo.runesdechene.com   (build démo, VITE_DEMO_MODE=true)
        ├── Coque kiosk      : écran d'intro + timer d'inactivité + onboarding éclair
        ├── App explore-web  : la vraie app, inchangée
        ├── Proxy Supabase   : trie lectures / écritures faked / écritures bloquées
        ├── Demo store        : énergie ∞, Couronnes ∞, découvertes/énigmes/Gloire en mémoire
        └── Compte démo réel  : lecture seule en base (carte vivante)
```

### 1. Build démo dédié

- Drapeau de build `VITE_DEMO_MODE` (booléen). En prod normale : `false`/absent ⇒
  **aucun** code démo ne s'exécute.
- Déploiement séparé sur `demo.runesdechene.com`.
- Un helper unique `isDemoMode()` (lecture de `import.meta.env.VITE_DEMO_MODE`)
  centralise toutes les branches. Pas de booléen baladé partout.

### 2. Proxy Supabase (cœur du « zéro écriture »)

Le client `lib/supabase.ts` exporte un singleton ; tout l'app appelle
`supabase.rpc(...)`. En mode démo on enveloppe ce singleton dans un proxy qui
intercepte `.rpc(name, args)` :

- **Lectures** (`get_*` et autres RPC de lecture) → **pass-through** vers le vrai
  compte démo. Carte, lieux, énigmes réels.
- **Écritures faked** (liste blanche explicite) → **n'atteignent jamais le réseau** :
  le proxy renvoie une réponse optimiste synthétique et met à jour le *demo store*.
  Liste blanche initiale :
  - `discover_place` → succès, lieu ajouté aux découvertes mémoire, gains Gloire/Couronnes visuels.
  - RPC de soumission d'énigme → toujours succès (voir §4).
  - RPC de dépense de Couronnes / influence → succès sans débit réel.
- **Toute autre écriture** (`plant_flag`, chat, mute, rejoindre compagnie, etc.) →
  **no-op bloqué** : le proxy renvoie un résultat neutre, rien ne part au serveur.
- **Filet de sécurité base** : le compte démo n'a **aucun droit d'écriture** côté
  Postgres. Même si une écriture échappait au proxy, la base la rejette.

> Le tri lecture/écriture se fait par **liste blanche d'écritures faked** + **liste
> de no-op** ; tout RPC inconnu est traité par défaut comme lecture pass-through SI
> son nom commence par `get_`/`list_`/`fetch_`, sinon comme écriture bloquée (no-op).
> Choix conservateur : on ne laisse jamais passer une écriture par défaut.

### 3. Demo store (état de session en mémoire)

Un store Zustand `demoStore` (uniquement chargé en mode démo) porte :

- `energy` / `maxEnergy` → toujours pleins (jauge pleine, affichage « ∞ »).
- `crownsBalance` → infini (affiché « ∞ » ou grand nombre).
- `discoveredIds` → lieux découverts pendant la session.
- `solvedEnigmaIds` → purement indicatif (les énigmes restent rejouables, voir §4).
- `glory` / `level` → progression **visuelle** de la session.

Les stores existants (`playerStore`, `crownsStore`) lisent ces valeurs via le proxy /
helper démo plutôt que la base, en mode démo uniquement.

**Reset** = `demoStore.reset()` remet tout à l'état vierge. Pas de re-login.

### 4. Ressources infinies & énigmes en boucle

- **Énergie** : `get_user_energy` faked renvoie `energy = maxEnergy`. `discover_place`
  ne décrémente jamais. Affichage « ∞ ».
- **Couronnes** : balance infinie. Chaque dépense acceptée sans débit.
- **Énigmes infinies** : on retire le verrou « déjà résolue / cooldown » côté client.
  Le visiteur peut résoudre la même énigme autant de fois qu'il veut, **toast de
  réussite à chaque fois**. Gloire gagnée = visuelle, remise à zéro au reset.

### 5. Coque kiosk (l'attractant)

- **Écran d'intro** plein écran : belle photo, voile sombre, gros bouton
  **« Entrer sur la carte »**. Affiché au premier chargement et après **10 min**
  d'inactivité.
- **Timer d'inactivité** global : réarmé à chaque interaction (tap, scroll, clic).
  À expiration → réaffiche l'écran d'intro.
- **Flux d'entrée** : tap « Entrer sur la carte » → `demoStore.reset()` → mini-popup
  de bienvenue **très courte** (« Bienvenue dans le mouvement Runes de Chêne… ») →
  fermeture → le visiteur joue.

### 6. Compagnies bloquées

Toute entrée vers les Compagnies (onglet, bouton rejoindre, lien) → **panneau
bloquant** : *« Les Compagnies ne sont pas accessibles en mode démo. »* Aucun faking
social.

### 7. Résilience hors-ligne

- Au **démarrage de la borne**, préchargement d'une **zone de carte généreuse**
  (lieux + énigmes) mis en cache.
- En session, lectures servies depuis le cache si le réseau coupe ; écritures déjà en
  mémoire. Une coupure wifi ne casse pas la démo.

## Découpage en unités

| Unité | Rôle | Dépend de |
|-------|------|-----------|
| `isDemoMode()` helper | Source unique de vérité du flag | `import.meta.env` |
| Proxy Supabase démo | Tri lecture / faked / bloqué | `isDemoMode`, demoStore |
| `demoStore` | État de session en mémoire (∞, découvertes, Gloire) | — |
| Coque kiosk | Écran d'intro + timer inactivité + onboarding | demoStore.reset |
| Garde Compagnies | Panneau bloquant | isDemoMode |
| Préchargement carte | Cache zone au démarrage | compte démo |

## Gestion d'erreurs

- **Réseau coupé en lecture** : servir le cache préchargé ; si absent, message doux
  (« Connexion en cours… ») sans casser l'écran.
- **RPC d'écriture inconnu reçu par le proxy** : no-op + log console (mode démo), jamais
  d'appel réseau.
- **Compte démo expiré / déconnecté** : la coque détecte l'absence de session et
  re-login silencieusement sur le compte démo.

## Tests

- **Proxy** : un RPC de lecture passe ; un RPC faked renvoie la réponse synthétique
  sans toucher le réseau ; un RPC d'écriture inconnu est no-op.
- **demoStore.reset()** : remet énergie pleine, Couronnes ∞, découvertes/Gloire vides.
- **Énigme rejouable** : résoudre 2× la même énigme → 2 toasts de réussite.
- **Garde Compagnies** : navigation Compagnies → panneau bloquant.
- **Timer inactivité** : pas d'interaction 10 min → écran d'intro réaffiché.
- **Garde-fou prod** : `VITE_DEMO_MODE` absent ⇒ proxy/coque/demoStore inertes.

## Hors-scope (YAGNI)

- Aucune simulation GPS / geste « Visiter sur place ».
- Aucun faking social (compagnies, chat, mécénat).
- Aucun profil « pré-chargé impressionnant » (départ vierge uniquement).
- Aucune persistance entre sessions.

## À créer / configurer

- **Compte démo Supabase** dédié, **sans droit d'écriture** (à confirmer côté base :
  RLS / révocation des grants pour ce user).
- **Sous-domaine** `demo.runesdechene.com` + déploiement dédié (Netlify) avec
  `VITE_DEMO_MODE=true`.
