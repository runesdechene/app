# Stores Zustand (6)

## playerStore — État joueur
```
discoveredIds, userId, userName, userAvatarUrl,
userFactionId/Color/Title/Pattern, factionTitle2,
energy/maxEnergy/energyCycle, notorietyPoints (=Gloire),
unlockedTitles, displayedTitles, primaryTitle,
gameMode ('exploration'|'conquest'), isAdmin, loading, userPosition,
activeBuff (free_discover|free_claim|...|null)
```

## mapStore — État carte
```
selectedPlaceId, selectedPlayerId, pendingFlyTo, pendingZoom,
placeOverrides (Map), deletedPlaceIds (Set), addPlaceMode,
pendingNewPlaceCoords, placesRefreshKey, mapStyleMode,
selectedTerritoryData, territoryNames (Map)
```

## chatStore — Chat
```
showGeneral/showFaction/showBugs, sendChannel,
generalMessages/factionMessages/bugsMessages (max 100/canal)
```

## toastStore — Toasts in-game
```
toasts (GameToast[]) — types: claim/discover/explore/new_place/new_user/like/fortify
```

## playersStore — Joueurs en ligne
```
players (Map<string, OnlinePlayer>) — id, name, avatar, faction, lat/lng, primaryTitle, last_seen
```

## mobileNavStore — Navigation mobile
```
activePanel ('notifications'|'chat'|'profile'|null), notificationsSeenAt, chatSeenAt
```
