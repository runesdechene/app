# explore-web — La Carte

> App publique (V0.5 — L'Érudition Conquérante). Port dev 3000. Prod : app.runesdechene.com (Netlify).

## Mémoire projet

Conventions, gotchas, décisions, préférences, architecture :
**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

4-Layer Query Rule et règles Graphify : voir `CLAUDE.md` racine monorepo.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- MapLibre GL JS (carte)
- Zustand (12 stores : `appConfigStore`, `chatStore`, `crownsStore`, `dailyQuestsStore`, `expeditionsStore`, `gloryRulesStore`, `mapStore`, `mobileNavStore`, `notificationStore`, `playerStore`, `playersStore`, `toastStore`)
- V0.7 phase 5 (5 mai 2026) : système **La Cour** — influence à distance via Couronnes, sur la fiche de lieu (onglet Infos). Composants `PlaceCourtView` + `CourtTensionBar` + `PatronsList` + `CourtChronicle` + `InvestCrownsModal` dans `components/places/details/` et `components/places/actions/`. Hook `useCourtNotifications` (subscribe activity_log filtré). Énigmes (daily/fragment/place) rapportent **1/1/2/3 Couronnes** selon difficulté (cap silencieux 500). Drop V0.5 : `InfluenceFrame`/`InfluenceToggle`/`users.influence_stock`/tables `place_influence` + `user_place_influence`.
- V0.7+ (6 mai 2026) : système **Expéditions joueur-joueur**. Bannière temporaire sur la carte (point GPS libre), chef d'expédition unique, chat privé, comptes rendus opt-in (texte + photos + vidéos), galerie agrégée, archives consultables, "L'appel" modifiable collectivement, +10 XP au premier compte rendu. Sous-dossier `components/expeditions/` (Hud, Modal, Creator, Chat, Gallery, ReportEditor, Card, List). Sous-dossier `components/quests/` (QuestsBoardPanel — panneau HUD intégré sous toasts, liste unifiée Expéditions/Missions/Du jour avec pilules de type). Store Zustand `expeditionsStore`. Tables SQL préfixées `voyage_*` (mig 104-110) à cause d'une collision avec la table `expeditions` du système Plantage/Veille V0.7 (cf. docs/db/tech-debt.md D1). Bucket Supabase Storage `voyage-medias` (RLS). Renommage : ancien `ExpeditionOptInModal` (Plantage) → `VeillePartageeModal`. Notifications étendues avec 7 types `expedition_*`.
- ⚠️ **`vite.config.ts` a `envDir: '../..'`** — les `.env*` sont lus depuis la **racine du monorepo** (pas `apps/explore-web/`). Toute nouvelle `VITE_*` se met dans le `.env` racine.
- V0.8.22 (24 mai 2026) : **mécénat d'un challenger** (soutenir un attaquant). La Cour est user-centric (veilleur = user, `place_court_action.beneficiary_user_id`). `invest_crowns` reçoit un param optionnel `p_beneficiary_user_id` (mig 173) : crédite le score d'un challenger désigné au lieu du caller, avec dérivation serveur de son expé (anti `place_veille` incohérent) + erreurs `not_a_challenger`/`challenger_expedition_missing`. `get_place_court_state` expose `challengers` (cibles soutenables, score-bénéficiaire). Front : bouton « Soutenir » par challenger dans `PatronsList` (basé sur `challengers`, plus sur `topPatrons`), `InvestCrownsModal` prop `beneficiaryUserId`, câblage dans `PlaceCourtView`. Notif au challenger soutenu via `place_court_support` + `targetSide:'attack'` (wording distinct dans `courtToastMessages`). Faiseur de roi : le soutenu prend le trône, pas le mécène. Spec/plan : `docs/superpowers/specs|plans/2026-05-24-mecenat-challenger*`.
- V0.8.21 (24 mai 2026) : **cycle de vie carte des expéditions**. Le cron `archive_passed_voyages()` (mig 109, jamais branché) est enfin planifié via pg_cron (mig 172, horaire). Transition `passed → archived` ramenée à **7j** (grâce carte couplée : à J+7 → hors carte + Archives publiques + chat fermé). Nouveau RPC `list_voyages_for_map()` (published + passed) + champ store `mapBanners`, distinct de `list_voyages_upcoming`/`upcoming` (resté published-only pour la liste HUD). Bannières `passed` rendues en N&B + opacité dégressive (1.0→0.35 sur 7j) dans `ExpeditionBanner` (calcul sur `rdv_at`, classe `is-passed`). Section compte rendu **masquée** (`REPORTS_SECTION_ENABLED=false` dans `ExpeditionModal`) en attendant la refonte "album-souvenir chef" (parquée, cf. Bible Game Design).
- V0.7.9 (10 mai 2026) : section **Coupe des Héritages** sur la home `/accueil`. Composants dans `components/home/coupe/` : `CoupeHeritagesSection` (orchestrateur, fetch via `useCoupe(autoLoad=true, pollMs=0)` + listener `visibilitychange` pour refetch au retour onglet), `CoupePodium` (4 marches proportionnelles ordre 4-3-2-1, leader couronné à droite, hauteur = `max(score/topScore × 80, 12)` px), `CoupeOnboarding` (coupe SVG hero + 4 bannières neutres + CTA "Choisir ma Maison" pour user sans Maison, anti-bandwagon). Toujours visible (pas de toggle `factionColorMode`). `MobileLayout` expose `openFactionModal` aux routes enfants via Outlet context React Router (interface `MobileLayoutContext`). Pas de RPC nouvelle (réutilise `get_coupe_state` + fetch séparé `factions.pattern`). Modales `FactionMembersModal` et `CoupeModal` montées localement par l'orchestrateur. La `FactionBar` carte reste en place pour V0.7.9. Fix iOS dans `mobile.css` : `.faction-members-modal` reçoit `padding-top: calc(env(safe-area-inset-top, 0px) + 20px)` + fallback @supports webkit-touch-callout (47px). Spec : `docs/superpowers/specs/2026-05-10-coupe-heritages-home-design.md`. Plan : `docs/superpowers/plans/2026-05-10-coupe-heritages-home.md`.
- V0.7.7 (9 mai 2026) : **Push Notifications V1**. 6 types pushés (`daily_enigma_ready` (cron 12h30 Europe/Paris DST-safe), `expedition_message`, `place_taken_remote/back_gps/reaffirmed`, `level_up_imminent` (cron 17h UTC, xp-based), `weekly_new_places_recap` (lundi 8h UTC)). Tout autre type reste in-app silent. Stack : Edge Function Deno `supabase/functions/send-push` (npm:web-push + VAPID), trigger SQL `AFTER INSERT ON notifications` → `pg_net.http_post` (mig 142), table `push_subscriptions` (mig 141 + RLS), 2 cols `users.push_important_enabled/push_recap_enabled`, 3 crons pg_cron (mig 144-146). Front : bascule `vite-plugin-pwa` mode `injectManifest` + SW custom `src/sw.ts` (push + notificationclick), lib `lib/pushNotifications.ts` (subscribe/unsub/sync + `pushSupportStatus` détecte iOS standalone), hook `hooks/useEnsurePushPermission.tsx` (PushPromptHost + PushSubscriptionSync montés dans MapPage), modales `components/notifications/PushPermissionModal` + `IOSInstallGuideModal` + `PushSettings`. Opt-in well-timed après submit énigme et création d'expédition. VAPID public dans `VITE_VAPID_PUBLIC_KEY`, private dans secrets Supabase. Spec : `docs/superpowers/specs/2026-05-09-push-notifications-design.md`. Plan : `docs/superpowers/plans/2026-05-09-push-notifications.md`.
- V0.7.6 (7 mai 2026) : refonte **éco Couronnes progressive** + **Quêtes du jour** dans le HUD. Mig 121-125. Tirage indépendant par lieu `p(N) = K/sqrt(N)` + drip intra-journée 6h-20h, paramètres dans `app_settings`. Découverte (remote ET GPS) crédite +1 🪙. Mini-quête "Découvre 3 lieux à distance" → +1 🪙 bonus, dédupliqué via `activity_log`. RPC `get_today_quests_state(p_user_id)` retourne array de quêtes (architecture multi-quêtes). Nouveau store `dailyQuestsStore`, composants `DailyQuestsList` + `DailyQuestCard` + `DailyQuestModal` (cette dernière utilise `InfoModal` avec slot `extraContent` pour la barre de progression — portal vers body, style canonique badges Gloire/Couronnes/Coupe). Refetch déclenché depuis `discoverPlace.ts` après action remote. Toasts énigme harmonisés : `🎖️ +G / 🏆 +C / 🪙 +K` (Couronne enfin créditée à l'écran, fini les 🦉/📖). Renaming UX panel "Événements" → "Quêtes en cours". Encart "L'esprit Rune de Chêne" en tête de `ExpeditionCreator` (4 bulles mentalité, pattern aligné `expedition-modal-rules`). Sémantique sacrée : **découvrir = à distance + énergie ; visiter en GPS = gratuit** (cf. `feedback_decouvrir_vs_visiter_gps.md` mémoire).
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
