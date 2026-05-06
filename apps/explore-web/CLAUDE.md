# explore-web — La Carte

> App publique (V0.5 — L'Érudition Conquérante). Port dev 3000. Prod : carte.runesdechene.com (Netlify).

## Mémoire projet

Conventions, gotchas, décisions, préférences, architecture :
**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

4-Layer Query Rule et règles Graphify : voir `CLAUDE.md` racine monorepo.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- MapLibre GL JS (carte)
- Zustand (11 stores : `appConfigStore`, `chatStore`, `crownsStore`, `expeditionsStore`, `gloryRulesStore`, `mapStore`, `mobileNavStore`, `notificationStore`, `playerStore`, `playersStore`, `toastStore`)
- V0.7 phase 5 (5 mai 2026) : système **La Cour** — influence à distance via Couronnes, sur la fiche de lieu (onglet Infos). Composants `PlaceCourtView` + `CourtTensionBar` + `PatronsList` + `CourtChronicle` + `InvestCrownsModal` dans `components/places/details/` et `components/places/actions/`. Hook `useCourtNotifications` (subscribe activity_log filtré). Énigmes (daily/fragment/place) rapportent **1/1/2/3 Couronnes** selon difficulté (cap silencieux 500). Drop V0.5 : `InfluenceFrame`/`InfluenceToggle`/`users.influence_stock`/tables `place_influence` + `user_place_influence`.
- V0.7+ (6 mai 2026) : système **Expéditions joueur-joueur**. Bannière temporaire sur la carte (point GPS libre), chef d'expédition unique, chat privé, comptes rendus opt-in (texte + photos + vidéos), galerie agrégée, archives consultables, "L'appel" modifiable collectivement, +10 XP au premier compte rendu. Sous-dossier `components/expeditions/` (Hud, Modal, Creator, Chat, Gallery, ReportEditor, Card, List). Sous-dossier `components/quests/` (QuestsBoardPanel — panneau HUD intégré sous toasts, liste unifiée Expéditions/Missions/Du jour avec pilules de type). Store Zustand `expeditionsStore`. Tables SQL préfixées `voyage_*` (mig 104-110) à cause d'une collision avec la table `expeditions` du système Plantage/Veille V0.7 (cf. docs/db/tech-debt.md D1). Bucket Supabase Storage `voyage-medias` (RLS). Renommage : ancien `ExpeditionOptInModal` (Plantage) → `VeillePartageeModal`. Notifications étendues avec 7 types `expedition_*`.
- CSS par composant, media queries dans `styles/mobile.css`
- Supabase client : `src/lib/supabase.ts`

## Structure components/

Sprint Purification (mai 2026) — sous-dossiers thématiques :

```
components/
├─ map/
│  ├─ core/        ExploreMap, MapMarkers, MapWorker, OverlayLayer
│  ├─ panels/      panneaux flottants (Crowns, Glory, Energy, Stack…)
│  ├─ modals/      PlayerProfileModal, FactionsList, NotificationsPanel…
│  ├─ filters/     LayerToggle, FactionFilters, EraFilters
│  ├─ toasts/      ToastStack, LevelUpToast, EmojiToast
│  └─ ui/          ContextMenu, ActionButton…
├─ places/
│  ├─ views/       PlacePanel (978 l.) + onglets
│  ├─ actions/     ClaimButton, AddPlace, ContestForm…
│  ├─ details/     V0.5 timeline / réviews / contributions
│  └─ shared/      sous-composants partagés
├─ enigma/         DailyEnigma, FragmentEnigma, EnigmaResult
├─ profile/        avatar / settings (intégré modals/ pour les fenêtres)
├─ expeditions/    ExpeditionsHud (orchestrateur), QuestsBoardPanel, ExpeditionsList,
│                  ExpeditionCard, ExpeditionCreator, ExpeditionModal, ExpeditionChat,
│                  ExpeditionGallery, ReportEditor (V0.7+, 6 mai 2026)
├─ quests/         QuestsBoardPanel (panneau HUD agrégateur)
```

## Helpers extraits (sprint Purification)

- `lib/discoverPlace.ts` — action standalone (lit le store via getState)
- `lib/loadRecentActivityToasts.ts` — formatting activité utilisateur (184 l.)
- `lib/dateFormat.ts` — `formatFrenchLongDate()`
- `lib/avatarUpload.ts` — `uploadAvatar(userId, file, {cacheBust})`
- `lib/exploreMapConstants.ts` — constantes carte + `PopupInfo`
- `lib/titleProgress.ts` — `STAT_LABELS` + `formatTitleProgress`
- `lib/expeditionsApi.ts` — wrapper RPCs voyages (V0.7+, mappe voyage_* SQL → Expedition* TS)
- `lib/expeditionDateFormat.ts` — `formatRelativeRdv()` pour les libellés date d'expédition
- `hooks/useExpeditionChat.ts` — Realtime chat live d'une expédition (pattern useChat)
- `types/playerProfile.ts` — types V0.5 PlayerProfile
- `types/placeDetail.ts` — `V05Detail`, `V05Contribution`, `PlacePanelActiveTab`
- `types/expedition.ts` — types V0.7+ ExpeditionListItem, Detail, FullPayload, Report

## Commandes

```bash
pnpm dev                # port 3000
pnpm build              # tsc && vite build
# Deploy :
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
```

## Règles inviolables

- **Pas de `any`** (TS strict)
- **Pas de `console.log`** en prod
- **Pas de code mort** — supprimer si unused
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER`

Détail : voir Citadelle `DEV/Conventions/` et `DEV/Gotchas/`.
