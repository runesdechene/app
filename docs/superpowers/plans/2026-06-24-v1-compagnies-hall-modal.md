# Hall de la Compagnie — modale 2 colonnes (desktop) + chat-canal — Plan

> Suite du Lot 1 Compagnies. Design validé + maquetté avec Uriel le 24/06 (XO render).
> Socle déjà livré : chat de Compagnie = canal `chat_messages` (`channel = company_id`),
> commit a0b06af (`useCompanyChat` repointé).

## Design VERROUILLÉ — Version B (maquetté + validé 24/06, XO render)

Le **Hall de la Compagnie**, sur **desktop = modale centrale 2 colonnes**, design **repris fidèlement
de `ExpeditionModal` + `ExpeditionChat`** (parchemin `#f5e9d4`/`#faf2dd`/`#fff8eb`, titres en
`var(--font-signature)` italique, eyebrows `var(--font-accent)` capitales `letter-spacing:.24em`
couleur `#8a7050`, avatars dégradé `#b89a6a→#6e5435`, boutons primaires `#2a1f10`). **Réutiliser les
classes `.expedition-modal-*` / `.expedition-chat-*` quand possible** plutôt que réinventer.

- **Colonne GAUCHE (identité)** : eyebrow « Compagnie officielle » (pastille couleur compagnie) ;
  emblème (couleur compagnie) + nom (signature italique) ; ligne de **totaux compagnie**
  (👥 membres · 🏆 gloire totale · 🪙 couronnes) ; **« La mission »** = description **GRANDE**
  (les gens y mettent du texte → bloc ample, scrollable si long) ; footer **Quitter** /
  **Éditer (Chef)**.
- **Colonne DROITE (≈38%) : CLASSEMENT de la Compagnie** — membres **classés par contribution**,
  scrollable **scrollbar cachée** (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).
  Chaque membre : rang + avatar + nom + métriques **🏆 gloire · 🪙 couronnes · ⚔️ actions**.
  Le **rang 1 = ♛ Chef de Compagnie** (badge), surligné couleur compagnie. **PAS de « Fondateur »** :
  le Chef est **détrônable** (le plus contributeur mène). Footer : lien **« 💬 Ouvrir le canal dans le Tchat »**.
- **PAS de chat dans le Hall** (il serait redondant avec l'onglet Tchat). Le chat = uniquement
  l'onglet Tchat, canal `chat_messages`/`channel=company_id` (socle déjà livré).
- **Bannière (« Porter ces couleurs ») = SUR LA CARTE, pas dans le Hall** (correction Uriel).
- **Mobile** : onglets **Infos / Classement**.

### Métriques de statut — « gloire d'abord » (décidé 24/06)
- **Lot courant** : classement par **GLOIRE** (existe déjà, stat de profil). **Chef = plus haute gloire**
  (détrônable). Afficher gloire par membre + total compagnie.
- **Couronnes investies** (trésor de compagnie versable) + **actions sous bannière** (territoire) =
  **nouvelles mécaniques**, branchées plus tard (couronnes = trésor à créer ; actions = SPEC 3).
  Afficher les colonnes 🪙/⚔️ à 0 / masquées tant que la mécanique n'existe pas.

> ⚠️ Le `founder_user_id` n'est plus le « chef » affiché : le Chef est calculé (max gloire).
> Garder `founder_user_id` en base (utile), mais l'UI parle de « Chef de Compagnie ».

## Fichiers / tâches

### Task 1 — `CompanyChat` (composant chat de canal Compagnie)
- Create `apps/explore-web/src/components/companies/CompanyChat.tsx`.
- Mirror `components/expeditions/ExpeditionChat.tsx` : liste de bulles (avatar/nom via une
  map `membersById: Record<userId, {name}>` passée en prop, ou via `get_company`), input 500 max,
  auto-scroll, `active?` pour le re-scroll mobile.
- Données : `useCompanyChat(companyId)` (déjà repointé sur `chat_messages`) → `{ messages, send }`.
  `messages` portent `id, userId, content, createdAt` (pas de nom) → résoudre le nom via la
  liste des membres du Hall. Pour les non-membres (anciens), fallback « Veilleur ».
- Écriture réservée aux membres (sinon lecture seule, comme ExpeditionChat spectateur).

### Task 2 — `CompanyHallModal` (modale 2 colonnes)
- Create `apps/explore-web/src/components/companies/CompanyHallModal.tsx` + `.css`.
- Props : `{ companyId: string, onClose: () => void }`.
- Structure (mirror `ExpeditionModal` + sa CSS `ExpeditionModal.css`) :
  - overlay (ferme au clic fond : `e.target === e.currentTarget`) ;
  - carte 2 colonnes desktop / 1 colonne + onglets mobile (`mobileTab: 'info'|'chat'`, `useMediaQuery('(max-width:768px)')`) ;
  - **gauche** : reprendre le CONTENU de `CompanyDetailPanel` SANS le chat (identité, membres,
    bannière, classement, quitter, éditer). → soit extraire un `CompanyHallInfo` partagé, soit
    passer une prop `hideChat` à `CompanyDetailPanel`. Préférer extraire `CompanyHallInfo` propre.
  - **droite** : `<CompanyChat companyId={companyId} membersById={...} />`.
- Charger le détail via `get_company` (déjà corrigé en prod : ORDER BY `t."joinedAt"`).
- Accent couleur = `company.color` (bandeau haut + emblème), fond parchemin (vrais tokens CSS du projet,
  pas les vars XO de la maquette) : `var(--color-parchment)`, `var(--color-ink)`, etc.

### Task 3 — Brancher le Hall modal (desktop)
- L'onglet sidebar 🛡️ « Compagnie » : au lieu d'afficher le hall inline, il liste la/les
  compagnie(s) et **un clic ouvre `CompanyHallModal`** (modale centrale). Alternative simple :
  garder la sidebar comme aujourd'hui mais remplacer l'affichage inline du `CompanyDetailPanel`
  par l'ouverture de `CompanyHallModal`. Décider avec Uriel : la sidebar devient-elle juste une
  liste cliquable, ou un raccourci qui ouvre direct le Hall de la compagnie active ?
- Au **join** (CompaniesJoinCreateModal) : ouvrir `CompanyHallModal` de la compagnie rejointe
  (remplace le `setTab('compagnie')` actuel).
- ProfileMenu « Mes Compagnies » (desktop) : ouvre le Hall de la compagnie active (ou la modale
  rejoindre/fonder si aucune).

### Task 4 — Canal « Compagnie » dans l'onglet Tchat
- `components/chat/ChatPanel.tsx` : ajouter un filtre/onglet **« Compagnie »** (à côté de
  Général / Dortoir / Bugs) qui lit `channel = <companyId actif>`.
- `hooks/useChat.ts` + `stores/chatStore.ts` : ajouter le slice du canal compagnie (souscription
  `channel=eq.<companyId>`, comme la faction). Le `companyId` = la **bannière active** de l'utilisateur
  (cf. `users.active_company_id` / `get_my_companies.activeCompanyId`). Si pas de compagnie active → pas d'onglet.
- `sendChatMessage` : supporter `channelType: 'company'` → `channel = activeCompanyId`.
- ⚠️ Desktop : vérifier où l'onglet Tchat est surfacé sur PC (chat mobile-only en route ; sur desktop,
  voir s'il y a un accès chat — sinon le Hall reste le point d'accès desktop au chat de compagnie).

### Task 5 — Mobile
- `/compagnies` (CompaniesPage) : le détail d'une compagnie ouvre le Hall en **plein écran avec
  onglets Infos/Chat** (réutiliser `CompanyHallModal` en mode mobile, ou un layout équivalent).

### Nettoyage (différé, cleanup-v1-identity)
- `company_messages` (table) + `send_company_message` / `get_company_messages` (RPC) deviennent
  **morts** (le chat est passé sur `chat_messages`). À DROP au grand nettoyage de fin de campagne.
  Noter dans `docs/db/cleanup-v1-identity.md`.

## Garde-fous
- RLS `chat_messages` : vérifier qu'un membre peut lire/écrire `channel = companyId` (le Dortoir
  lit déjà `channel = factionId` en direct → même posture attendue ; tester en prod).
- Multi-compagnie (max 2) : le canal Tchat = compagnie **active** ; le Hall = la compagnie ouverte.
- Pas de runtime test possible hors navigateur → valider `pnpm build` + click-flow Uriel.
