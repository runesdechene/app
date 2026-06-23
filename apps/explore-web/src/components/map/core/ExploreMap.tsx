import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapGL, Source, Layer, Popup, Marker, NavigationControl, GeolocateControl } from '@vis.gl/react-maplibre'
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre'
import type { StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

import { usePlaces } from '../../../hooks/usePlaces'
import type { PlaceProperties } from '../../../hooks/usePlaces'
import { loadParchmentStyle, loadParchmentDetailedStyle, loadSatelliteStyle } from '../../../lib/map-style'
import { loadColoredSvgIcon, loadShieldIcon } from '../../../lib/map-icons'
import {
  buildTerritoryFillLayer, buildTerritoryBorderLayer,
  UNKNOWN_ICON_ID,
  undiscoveredCircleLayer, undiscoveredIconLayer, pointLayer, iconLayer,
} from '../../../lib/map-layers'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { usePlayersStore } from '../../../stores/playersStore'
import { supabase } from '../../../lib/supabase'
import { Minimap } from './Minimap'
import { OnlinePlayerMarkers } from '../markers/OnlinePlayerMarkers'
import { FlyingEmojiLayer, type AvatarPositionResolver } from '../../social/FlyingEmojiLayer'
import { useEmojiThrows } from '../../../hooks/useEmojiThrows'
import { AvatarActionsPopover } from '../../social/AvatarActionsPopover'
import { EnergyIndicator } from '../badges/EnergyIndicator'
import { VeilleurNamePills } from '../markers/VeilleurNamePills'
import { GpsMarkMarkers } from '../markers/GpsMarkMarkers'
import { ExpeditionBanners } from '../markers/ExpeditionBanners'
import { HarvestableChests } from '../markers/HarvestableChests'
import { loadInitialVeilles } from '../../../lib/loadInitialVeilles'
import { useCrownsStore } from '../../../stores/crownsStore'
import { useSiegeStore } from '../../../stores/siegeStore'
import { useSearchFilterStore, placeMatchesFilters } from '../../../stores/searchFilterStore'
import {
  MAP_STYLE_PROP,
  MAP_CONTAINER_STYLE,
  INITIAL_VIEW,
} from '../../../lib/exploreMapConstants'
import type { PopupInfo } from '../../../lib/exploreMapConstants'

export const ExploreMap = memo(function ExploreMap() {
  const mapRef = useRef<MapRef>(null)
  const { geojson, rawGeojson, loading, error } = usePlaces()
  const [territories, setTerritories] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [zoomLevel, setZoomLevel] = useState(8)
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const placeOverrides = useMapStore(state => state.placeOverrides)
  const pendingFlyTo = useMapStore(state => state.pendingFlyTo)
  const clearPendingFlyTo = useMapStore(state => state.clearPendingFlyTo)
  const pendingZoom = useMapStore(state => state.pendingZoom)
  const clearPendingZoom = useMapStore(state => state.clearPendingZoom)
  const setUserPosition = usePlayerStore(s => s.setUserPosition)
  const userPosition = usePlayerStore(s => s.userPosition)
  const userAvatarUrl = usePlayerStore(s => s.userAvatarUrl)
  const userName = usePlayerStore(s => s.userName)
  const userDisplayedTitles = usePlayerStore(s => s.displayedTitles)
  const discoveredIds = usePlayerStore(s => s.discoveredIds)
  const currentUserId = usePlayerStore(s => s.userId)
  const onlinePlayers = usePlayersStore(s => s.players)
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)
  const addPlaceMode = useMapStore(s => s.addPlaceMode)
  const setPendingNewPlaceCoords = useMapStore(s => s.setPendingNewPlaceCoords)
  const mapStyleMode = useMapStore(s => s.mapStyleMode)
  const setSelectedTerritoryData = useMapStore(s => s.setSelectedTerritoryData)

  // V0.7+ Micro-social — channel emoji-throws + queue d'animations.
  // Instance unique du hook : `throwEmoji` est passé à OnlinePlayerMarkers en prop pour
  // que l'envoi local et l'affichage `flying` partagent le même state (broadcast self:false,
  // donc l'envoyeur ne voit son propre emoji que via l'optimistic update interne au hook).
  const { flying, throwEmoji } = useEmojiThrows()
  const [showSelfPopover, setShowSelfPopover] = useState(false)
  // Callback ref via state : un useRef ne déclenche pas de re-render quand le DOM
  // s'attache, donc AvatarActionsPopover recevait null forever.
  const [selfAvatarEl, setSelfAvatarEl] = useState<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const update = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const resolveAvatar = useCallback<AvatarPositionResolver>((targetUserId) => {
    const map = mapRef.current?.getMap()
    if (!map) return null
    let lat: number | null = null
    let lng: number | null = null
    if (targetUserId === currentUserId && userPosition) {
      lat = userPosition.lat
      lng = userPosition.lng
    } else {
      const p = onlinePlayers.get(targetUserId)
      if (!p) return null
      lat = p.position.lat
      lng = p.position.lng
    }
    if (lat == null || lng == null) return null
    const point = map.project([lng, lat])
    return { x: point.x, y: point.y }
  }, [currentUserId, userPosition, onlinePlayers])

  // V0.7 phase 2 — Couronnes de Chêne : Set des lieux où le user peut récolter un coffre
  const harvestableSet = useCrownsStore(s => s.harvestableSet)
  const refreshCrowns = useCrownsStore(s => s.refresh)

  // Refresh balance + harvestable dès qu'on connaît le userId
  useEffect(() => {
    if (currentUserId) refreshCrowns(currentUserId)
  }, [currentUserId, refreshCrowns])

  // V0.7.6 (8/05) — Lieux en siège mécénat : statut ⚔️/🔥 affiché dans la pilule
  // du veilleur (VeilleurNamePills consomme directement le store). Refresh au
  // mount + sur events realtime de place_court_score.
  const refreshSiege = useSiegeStore(s => s.refresh)

  useEffect(() => {
    void refreshSiege()
    const ch = supabase
      .channel('siege-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_court_score' }, () => {
        void refreshSiege()
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [refreshSiege])

  useEffect(() => {
    // V0.7 — coloriage initial par veille
    loadInitialVeilles()
  }, [])

  // Viewport bounds pour la minimap
  const [viewBounds, setViewBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)

  // Icône custom pour les lieux non découverts (chargée depuis app_settings)
  const [unknownIconLoaded, setUnknownIconLoaded] = useState(false)

  // Layers mémorisés pour éviter les flashs à chaque re-render
  const undiscoveredCircleFinal = useMemo(() => ({
    ...undiscoveredCircleLayer,
    layout: { visibility: unknownIconLoaded ? 'none' as const : 'visible' as const },
  }), [unknownIconLoaded])

  const undiscoveredIconFinal = useMemo(() => ({
    ...undiscoveredIconLayer,
    layout: { ...undiscoveredIconLayer.layout, visibility: unknownIconLoaded ? 'visible' as const : 'none' as const },
  }), [unknownIconLoaded])

  // IDs des layers interactifs (mémorisé pour éviter les re-renders MapGL)
  const interactiveLayerIds = useMemo(() => {
    return [
      'places-undiscovered-circle', 'places-undiscovered-icon',
      'places-point', 'places-icon',
      // 'territories-fill' retiré : les zones de territoire sont décoratives (grises,
      // purifiées) et non-cliquables — sinon le clic captait la zone au lieu du lieu,
      // ouvrant une sélection territoire alors que TerritoryPanel est démonté (→ écran flou vide).
    ]
  }, [])

  // Lieux fortifiés → Badge niveau par-dessus l'icône du lieu
  // Fort badges sont maintenant un symbol layer sur la source places (fortBadgeLayer)

  // Charger les 3 styles (jeu épuré, parchemin détaillé, satellite)
  const gameStyleRef = useRef<StyleSpecification | null>(null)
  const parchmentDetailedStyleRef = useRef<StyleSpecification | null>(null)
  const satelliteStyleRef = useRef<StyleSpecification | null>(null)

  useEffect(() => {
    loadParchmentStyle().then(s => {
      gameStyleRef.current = s
      // Style initial (mode par défaut = 'game')
      if (!mapStyle) setMapStyle(s)
    })
    loadParchmentDetailedStyle().then(s => {
      parchmentDetailedStyleRef.current = s
    })
    loadSatelliteStyle().then(s => {
      satelliteStyleRef.current = s
    })
  }, [])

  // Switcher le style selon le mode sélectionné
  useEffect(() => {
    if (mapStyleMode === 'satellite' && satelliteStyleRef.current) {
      setMapStyle(satelliteStyleRef.current)
    } else if (mapStyleMode === 'detailed' && parchmentDetailedStyleRef.current) {
      setMapStyle(parchmentDetailedStyleRef.current)
    } else if (mapStyleMode === 'game' && gameStyleRef.current) {
      setMapStyle(gameStyleRef.current)
    }
    // Après changement de style, MapLibre perd les images custom → re-injecter depuis le cache
    loadedIconsRef.current.clear()
  }, [mapStyleMode])

  // Web Worker : calcul des territoires en arrière-plan
  useEffect(() => {
    const worker = new Worker(
      new URL('../../../workers/territoryWorker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') return
      setTerritories(e.data as FeatureCollection<Polygon | MultiPolygon>)
    }
    workerRef.current = worker
    return () => { worker.terminate() }
  }, [])

  // Envoyer les données au worker quand les lieux ou veilles changent
  const workerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!rawGeojson || !workerRef.current) return
    if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current)
    workerDebounceRef.current = setTimeout(() => {
      if (!workerRef.current) return
      workerRef.current.postMessage({
        features: rawGeojson.features
          .filter(f => placeOverrides.get(f.properties.id)?.claimed)
          .map(f => {
            const ov = placeOverrides.get(f.properties.id)!
            return {
              coordinates: f.geometry.coordinates as [number, number],
              placeId: f.properties.id,
              faction: ov.factionId ?? '__neutral__',
              factionTitle: ov.factionTitle ?? '',
              tagColor: ov.tagColor ?? f.properties.tagColor,
              factionPattern: ov.factionPattern ?? '',
              score: 1,
              likes: f.properties.likes ?? 0,
              discovered: discoveredIds.has(f.properties.id),
              totalInfluence: 0,
              influenceByFaction: {},
              crownsTotal: 0,
            }
          }),
        tiers: [],
        radiusTuning: { enabled: false, baseKm: 1.0, stepKm: 0.2, capKm: 3.0 },
      })
    }, 500)
    return () => { if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current) }
  }, [rawGeojson, placeOverrides, discoveredIds])

  // Layers territoire mémorisés (gris neutres, sans paramètre faction)
  const territoryFillLayer = useMemo(() => buildTerritoryFillLayer(), [])
  const territoryBorderLayer = useMemo(() => buildTerritoryBorderLayer(), [])

  // Géolocalisation navigateur : centrer la carte + alimenter playerStore
  // On stocke la position dans une ref pour l'utiliser dans onMapLoad
  const geoResultRef = useRef<{ lng: number; lat: number } | null>(null)

  useEffect(() => {
    let resolved = false
    const applyPosition = (coords: { lng: number; lat: number }, _source: string) => {
      if (resolved) return
      resolved = true
      setUserPosition(coords)
      geoResultRef.current = coords
      mapRef.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 11, duration: 1500 })
    }

    // Lancer IP fallback immédiatement en parallèle (rapide, ~200ms)
    fetch('https://get.geojs.io/v1/ip/geo.json')
      .then(r => r.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          applyPosition({ lng: parseFloat(data.longitude), lat: parseFloat(data.latitude) }, 'IP')
        }
      })
      .catch(() => {})

    // GPS en parallèle — s'il répond, il écrase l'IP (plus précis)
    let gpsFired = false
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lng: pos.coords.longitude, lat: pos.coords.latitude }
          setUserPosition(coords)
          // flyTo uniquement la 1ère fois (GPS écrase IP)
          if (!gpsFired) {
            gpsFired = true
            resolved = false
            applyPosition(coords, 'GPS')
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      )
      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // Initialiser les coords du centre quand on entre en mode add-place
  useEffect(() => {
    if (addPlaceMode) {
      const center = mapRef.current?.getMap().getCenter()
      if (center) setPendingNewPlaceCoords({ lng: center.lng, lat: center.lat })
    }
  }, [addPlaceMode, setPendingNewPlaceCoords])

  // Zoom demandé depuis l'extérieur (add-place, etc.)
  useEffect(() => {
    if (!pendingZoom) return
    const map = mapRef.current?.getMap()
    if (map) {
      if (pendingZoom === 'in') map.zoomIn()
      else map.zoomOut()
    }
    clearPendingZoom()
  }, [pendingZoom, clearPendingZoom])

  // Fly-to demandé depuis l'extérieur (toast cliqué, bouton GPS, saisie coords, etc.)
  useEffect(() => {
    if (!pendingFlyTo) return
    mapRef.current?.flyTo({ center: [pendingFlyTo.lng, pendingFlyTo.lat], zoom: 14, duration: 1200 })
    if (pendingFlyTo.placeId) {
      setSelectedPlaceId(pendingFlyTo.placeId)
    }
    // En mode add-place, onMoveEnd ignore les mouvements programmatiques,
    // donc on met à jour les coords directement ici (flyTo demandé par l'utilisateur)
    if (addPlaceMode) {
      setPendingNewPlaceCoords({ lng: pendingFlyTo.lng, lat: pendingFlyTo.lat })
    }
    clearPendingFlyTo()
  }, [pendingFlyTo])

  // Quand la map se charge : flyTo géoloc + charger l'icône unknown
  const onMapLoad = useCallback(() => {
    const coords = geoResultRef.current
    if (coords) {
      mapRef.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 11, duration: 1500 })
    }

    // Charger l'icône unknown depuis app_settings
    const map = mapRef.current?.getMap()
    if (!map) return

    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'unknown_place_icon')
      .single()
      .then(({ data, error }) => {
        if (error) { console.warn('[ExploreMap] load unknown_place_icon failed', error); return }
        const url = data?.value
        if (!url) return

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (map.hasImage(UNKNOWN_ICON_ID)) return
          map.addImage(UNKNOWN_ICON_ID, img)
          setUnknownIconLoaded(true)
        }
        img.onerror = () => console.warn('[ExploreMap] unknown_place_icon image load failed', url)
        img.src = url
      })
  }, [])


  // Charger les icônes SVG colorées dans la map
  const loadedIconsRef = useRef(new Set<string>())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!rawGeojson) return
    if (!map) return

    for (const f of rawGeojson.features) {
      const { tagIcon, iconColor } = f.properties
      if (tagIcon && !loadedIconsRef.current.has(tagIcon)) {
        loadedIconsRef.current.add(tagIcon)
        loadColoredSvgIcon(map, tagIcon, iconColor).catch(() => {
          loadedIconsRef.current.delete(tagIcon)
        })
      }
    }
  }, [rawGeojson])

  // Charger les boucliers de fortification (niveaux 1-6)
  const loadedShieldsRef = useRef(new Set<number>())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !geojson) return
    for (let lvl = 1; lvl <= 6; lvl++) {
      if (loadedShieldsRef.current.has(lvl)) continue
      loadedShieldsRef.current.add(lvl)
      loadShieldIcon(map, lvl)
    }
  }, [geojson])

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    // V0.7+ — mode "tap-on-map" pour placer le RDV d'une expédition
    if (useMapStore.getState().expeditionPinMode) {
      useMapStore.getState().setExpeditionPinResult({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      })
      useMapStore.getState().setExpeditionPinMode(false)
      return
    }
    if (addPlaceMode) return // Don't select places while placing

    const feature = event.features?.[0]
    if (!feature) {
      setSelectedPlaceId(null)
      setSelectedTerritoryData(null)
      return
    }

    const props = feature.properties as PlaceProperties
    setSelectedPlaceId(props.id)
    setSelectedTerritoryData(null)
    setPopupInfo(null)
  }, [geojson, addPlaceMode])

  // Minimap : mettre à jour le viewport bounds + coords pour add-place
  const onMoveEnd = useCallback((evt: { originalEvent?: unknown }) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    if (b) setViewBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    if (addPlaceMode) {
      // Ignorer les recentrages programmatiques (GPS tracking du GeolocateControl)
      // Seuls les gestes utilisateur (drag, zoom molette) ont un originalEvent
      if (!evt.originalEvent) return
      const center = map.getCenter()
      setPendingNewPlaceCoords({ lng: center.lng, lat: center.lat })
    }
  }, [addPlaceMode, setPendingNewPlaceCoords])

  const handleMinimapNavigate = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], duration: 800 })
  }, [])

  // Curseur pointer sur les layers interactifs
  const onMouseEnter = useCallback(() => {
    if (addPlaceMode) return
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [addPlaceMode])

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.getCanvas().style.cursor = ''
  }, [])

  // GPS tracking → playerStore
  const onGeolocate = useCallback((e: { coords: { longitude: number; latitude: number } }) => {
    setUserPosition({ lng: e.coords.longitude, lat: e.coords.latitude })
  }, [setUserPosition])

  // Apply placeOverrides + harvestable to geojson
  const enrichedGeojson = useMemo(() => {
    if (!geojson) return geojson
    const needsEnrich = placeOverrides.size > 0 || harvestableSet.size > 0
    if (!needsEnrich) return geojson
    return {
      ...geojson,
      features: geojson.features.map(f => {
        const ov = placeOverrides.get(f.properties.id)
        const props = { ...f.properties }
        if (harvestableSet.has(f.properties.id)) {
          (props as Record<string, unknown>).harvestable = true
        }
        if (ov) {
          if (ov.factionId !== undefined) props.factionId = ov.factionId
          if (ov.tagColor !== undefined) {
            props.tagColor = ov.tagColor
            props.dominantFactionColor = ov.tagColor
          }
          if (ov.factionPattern !== undefined) props.factionPattern = ov.factionPattern
          if (ov.score !== undefined) props.score = ov.score
          if (ov.veilleurUserId !== undefined) props.veilleurUserId = ov.veilleurUserId
          if (ov.veilleurName !== undefined) props.veilleurName = ov.veilleurName
          if (ov.veilleurAvatarUrl !== undefined) props.veilleurAvatarUrl = ov.veilleurAvatarUrl
          if (ov.veilleurExtraCount !== undefined) props.veilleurExtraCount = ov.veilleurExtraCount
        }
        return { ...f, properties: props }
      }),
    }
  }, [geojson, placeOverrides, harvestableSet])

  // Recherche & Filtres (Lot 1) — masque les marqueurs hors filtre (prédicat partagé).
  const filterTagIds = useSearchFilterStore(s => s.tagIds)
  const filterEraIds = useSearchFilterStore(s => s.eraIds)
  const filterProgress = useSearchFilterStore(s => s.progress)
  const filteredGeojson = useMemo(() => {
    if (!enrichedGeojson) return enrichedGeojson
    if (filterTagIds.size === 0 && filterEraIds.size === 0 && filterProgress === 'all') {
      return enrichedGeojson
    }
    const criteria = { tagIds: filterTagIds, eraIds: filterEraIds, progress: filterProgress }
    return {
      ...enrichedGeojson,
      features: enrichedGeojson.features.filter(f => placeMatchesFilters(f.properties, criteria)),
    }
  }, [enrichedGeojson, filterTagIds, filterEraIds, filterProgress])

  if (!mapStyle) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-parchment)]">
        <p className="font-[var(--font-title)] text-[var(--color-ink)] text-lg tracking-wider">
          Chargement de la carte...
        </p>
      </div>
    )
  }

  return (
    <div className="explore-map-root" style={MAP_CONTAINER_STYLE} data-map-style={mapStyleMode}>
    <MapGL
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={MAP_STYLE_PROP}
      mapStyle={mapStyle}
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      fadeDuration={0}
      attributionControl={false}
      onLoad={onMapLoad}
      onMoveEnd={onMoveEnd}
      onZoomEnd={e => {
        const z = e.viewState.zoom
        setZoomLevel(Math.floor(z))
        useMapStore.getState().setMapZoom(z)
      }}
    >
      {!addPlaceMode && <NavigationControl position="top-right" showCompass={false} />}
      {!addPlaceMode && <GeolocateControl position="top-right" trackUserLocation onGeolocate={onGeolocate} />}

      {/* Marqueur position utilisateur */}
      {userPosition && (
        <Marker longitude={userPosition.lng} latitude={userPosition.lat} anchor="center">
          {addPlaceMode ? (
            /* En mode ajout : simple point pulsant (pas d'avatar pour ne pas gêner le viseur) */
            <div
              className="user-position-marker"
              style={{
                '--faction-color': '#C19A6B',
                '--faction-glow': '#C19A6B60',
              } as React.CSSProperties}
            >
              <div className="user-position-pulse" />
              <div className="user-position-dot" />
            </div>
          ) : (
            <div
              className="user-marker-wrapper"
              style={{ '--faction-color': '#C19A6B', position: 'relative' } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation()
                setShowSelfPopover(prev => !prev)
              }}
            >
              <div
                ref={setSelfAvatarEl}
                className="user-position-marker"
                style={{
                  '--faction-color': '#C19A6B',
                  '--faction-glow': '#C19A6B60',
                  cursor: 'pointer',
                } as React.CSSProperties}
              >
                <div className="user-position-pulse" />
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="" className="user-position-avatar" />
                ) : (
                  <div className="user-position-dot" />
                )}
              </div>
              {userName && <span className="other-player-name">{userName}</span>}
              {userDisplayedTitles.map((title, i) => (
                <span key={i} className="other-player-title">{title}</span>
              ))}
              {showSelfPopover && currentUserId && (
                <AvatarActionsPopover
                  mode="self"
                  anchorEl={selfAvatarEl}
                  onClose={() => setShowSelfPopover(false)}
                  onViewProfile={() => setSelectedPlayerId(currentUserId)}
                />
              )}
            </div>
          )}
        </Marker>
      )}

      {/* Marqueurs des autres joueurs connectés */}
      <OnlinePlayerMarkers players={onlinePlayers} onSelectPlayer={setSelectedPlayerId} throwEmoji={throwEmoji} />

      <VeilleurNamePills
        geojson={filteredGeojson}
        zoom={zoomLevel}
        bounds={viewBounds ? { minLng: viewBounds.west, maxLng: viewBounds.east, minLat: viewBounds.south, maxLat: viewBounds.north } : null}
      />

      {/* Brouillons GPS du joueur — marqueurs 📍 interactifs (Task 9/10) */}
      <GpsMarkMarkers />

      {/* V0.7+ Expéditions — bannières sur la carte (chaque expé published) */}
      <ExpeditionBanners />

      {territories && (
        <Source id="territories" type="geojson" data={territories}>
          <Layer {...territoryFillLayer} />
          <Layer {...territoryBorderLayer} />
        </Source>
      )}

      {filteredGeojson && (
        <Source
          id="places"
          type="geojson"
          data={filteredGeojson}
        >
          <Layer {...undiscoveredCircleFinal} />
          <Layer {...undiscoveredIconFinal} />
          <Layer {...pointLayer} />
          <Layer {...iconLayer} />
          {/* V0.7 — Mode Coupe ON : pilules sépia avec nom du veilleur (montées en
              React Markers plus bas dans le JSX, hors du symbol layer pour avoir un vrai
              fond capsule). Mode Coupe OFF : carte épurée, juste les lieux. */}
        </Source>
      )}

      {/* V0.7 phase 2 — Couronnes de Chêne : coffres récoltables (1+/jour selon expé).
          Rendu en React Markers DOM pour gérer animation +N + click sans toucher MapLibre.
          Visible uniquement sur les lieux où le user actuel peut récolter (filtré par crownsStore). */}
      <HarvestableChests geojson={filteredGeojson} />

      {/* V0.7.6 (8/05) — Statut siège affiché dans VeilleurNamePills directement
          (à côté du nom du veilleur), pas via un layer GeoJSON séparé. Refresh
          du store déclenché par le useEffect au mount + realtime ci-dessus. */}

      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          onClose={() => setPopupInfo(null)}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
          className="parchment-popup"
        >
          <div
            className="p-2 cursor-pointer"
            onClick={() => {
              setSelectedPlaceId(popupInfo.id)
              setPopupInfo(null)
            }}
          >
            <h3 className="font-[var(--font-title)] text-sm font-semibold text-[var(--color-ink)] m-0 leading-tight">
              {popupInfo.title}
            </h3>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: popupInfo.tagColor }}
            >
              {popupInfo.tagTitle}
            </span>
            <span className="block mt-1.5 text-xs text-[var(--color-ink-light)] font-[var(--font-body)] italic">
              Voir les détails
            </span>
          </div>
        </Popup>
      )}

      {loading && (
        <div style={{ top: 'calc(var(--safe-top, 0px) + 56px)' }} className="absolute left-1/2 -translate-x-1/2 bg-[var(--color-parchment)] text-[var(--color-ink)] px-4 py-2 rounded shadow-md text-sm font-[var(--font-body)] z-10">
          Chargement des lieux...
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded shadow-md text-sm z-10">
          {error}
        </div>
      )}

    </MapGL>

    {/* V0.7+ Micro-social — couche d'animations emoji-throws au-dessus de la carte */}
    <FlyingEmojiLayer
      flying={flying}
      resolveAvatar={resolveAvatar}
      viewportWidth={viewportSize.w}
      viewportHeight={viewportSize.h}
    />

    {/* Minimap style AoE (masquée en mode add-place) */}
    {!addPlaceMode && geojson && viewBounds && (
      <Minimap geojson={geojson} bounds={viewBounds} onNavigate={handleMinimapNavigate} />
    )}

    {/* Barre de progression découvertes (masquée en mode add-place et si non connecté) */}
    {!addPlaceMode && currentUserId && geojson && (() => {
      const total = geojson.features.length
      const discovered = geojson.features.filter(f => f.properties.discovered).length
      const pct = total > 0 ? (discovered / total) * 100 : 0
      return total > 0 ? (
        <div className="conquest-indicator">
          <div className="conquest-text">
            <span className="conquest-count">{discovered}/{total} lieux dcverts.</span>
            <span className="conquest-pct">{Math.round(pct)}%</span>
          </div>
          <div className="conquest-bar">
            <div className="conquest-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null
    })()}

    {/* Énergie déplacée hors de la toolbar du haut sur mobile : posée à droite de la
        barre "lieux découverts" pour libérer la 1ère ligne (Gloire/Coupe/Couronnes/etc.).
        Cachée sur desktop par défaut (CSS App.css), visible en mobile (mobile.css). */}
    {!addPlaceMode && currentUserId && (
      <div className="mobile-energy-slot"><EnergyIndicator /></div>
    )}

    {/* MapStyleSelect (bouton calques) déplacé dans la barre de recherche
        (SearchBar), à droite du filtre. */}

    </div>
  )
})
