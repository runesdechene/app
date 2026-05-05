# explore-web — La Carte

> App publique (V0.5 — L'Érudition Conquérante). Port dev 3000. Prod : carte.runesdechene.com (Netlify).

## Mémoire projet

Conventions, gotchas, décisions, préférences, architecture :
**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

4-Layer Query Rule et règles Graphify : voir `CLAUDE.md` racine monorepo.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- MapLibre GL JS (carte)
- Zustand (10 stores : `appConfigStore`, `chatStore`, `crownsStore`, `gloryRulesStore`, `mapStore`, `mobileNavStore`, `notificationStore`, `playerStore`, `playersStore`, `toastStore`)
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
```

## Helpers extraits (sprint Purification)

- `lib/discoverPlace.ts` — action standalone (lit le store via getState)
- `lib/loadRecentActivityToasts.ts` — formatting activité utilisateur (184 l.)
- `lib/dateFormat.ts` — `formatFrenchLongDate()`
- `lib/avatarUpload.ts` — `uploadAvatar(userId, file, {cacheBust})`
- `lib/exploreMapConstants.ts` — constantes carte + `PopupInfo`
- `lib/titleProgress.ts` — `STAT_LABELS` + `formatTitleProgress`
- `types/playerProfile.ts` — types V0.5 PlayerProfile
- `types/placeDetail.ts` — `V05Detail`, `V05Contribution`, `PlacePanelActiveTab`

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
