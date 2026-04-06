import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapGL, Source, Layer, Popup, Marker, NavigationControl, GeolocateControl } from '@vis.gl/react-maplibre'
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre'
import type { StyleSpecification, Map as MaplibreMap } from 'maplibre-gl'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

import { usePlaces } from '../../hooks/usePlaces'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { loadParchmentStyle, loadParchmentDetailedStyle, loadSatelliteStyle } from '../../lib/map-style'
import { loadColoredSvgIcon, loadBannerIcon, loadShieldIcon, loadFactionTile } from '../../lib/map-icons'
import {
  buildTerritoryFillLayer, buildTerritoryBorderLayer, buildTerritoryPatternLayer, UNKNOWN_ICON_ID,
  undiscoveredCircleLayer, undiscoveredIconLayer, pointLayer, iconLayer,
  fortBadgeLayer, territoryEmblemLayer, territoryHoverLabelLayer,
} from '../../lib/map-layers'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { usePlayersStore } from '../../stores/playersStore'
import { supabase } from '../../lib/supabase'
import { Minimap } from './Minimap'
import { OnlinePlayerMarkers } from './OnlinePlayerMarkers'
import { MapStyleSelect } from './MapStyleSelect'

// --- Component ---

interface PopupInfo {
  id: string
  longitude: number
  latitude: number
  title: string
  tagTitle: string
  tagColor: string
}

const MAP_STYLE_PROP = { width: '100%', height: '100%' } as const
const MAP_CONTAINER_STYLE = { position: 'relative' as const, width: '100%', height: '100%' }
const INITIAL_VIEW = { longitude: 2.45, latitude: 46.6, zoom: 6 }

export const ExploreMap = memo(function ExploreMap() {
  const mapRef = useRef<MapRef>(null)
  const { geojson, rawGeojson, loading, error } = usePlaces()
  const [territories, setTerritories] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [workerProgress, setWorkerProgress] = useState<{ phase: string; percent: number } | null>(null)
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
  const userPrimaryTitle = usePlayerStore(s => s.primaryTitle)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const currentUserId = usePlayerStore(s => s.userId)
  const onlinePlayers = usePlayersStore(s => s.players)
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)
  const addPlaceMode = useMapStore(s => s.addPlaceMode)
  const setPendingNewPlaceCoords = useMapStore(s => s.setPendingNewPlaceCoords)
  const mapStyleMode = useMapStore(s => s.mapStyleMode)
  const gameMode = usePlayerStore(s => s.gameMode)
  const showFactions = gameMode === 'conquest'
  const setMapStyleMode = useMapStore(s => s.setMapStyleMode)
  const setSelectedTerritoryData = useMapStore(s => s.setSelectedTerritoryData)

  // Territory tiers (configurés dans le Hub)
  const [territoryTiers, setTerritoryTiers] = useState<{ minPlaces: number; title: string }[]>([])
  // Territory names (noms custom par les joueurs) — dans le store pour mise à jour depuis TerritoryPanel
  const territoryNames = useMapStore(s => s.territoryNames)
  const setTerritoryNamesStore = useMapStore(s => s.setTerritoryNames)

  useEffect(() => {
    supabase.from('territory_tiers').select('min_places, title').order('min_places', { ascending: false })
      .then(({ data }) => {
        if (data) setTerritoryTiers(data.map(r => ({ minPlaces: r.min_places, title: r.title })))
      })
    supabase.rpc('get_winning_territory_names')
      .then(({ data }) => {
        if (data) {
          const m = new Map<string, { customName: string | null; namedBy: string }>()
          for (const r of data as Array<{ anchor_place_id: string; winning_name: string | null }>) {
            m.set(r.anchor_place_id, { customName: r.winning_name, namedBy: '' })
          }
          setTerritoryNamesStore(m)
        }
      })
  }, [])

  // Viewport bounds pour la minimap
  const [viewBounds, setViewBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)

  // Icône custom pour les lieux non découverts (chargée depuis app_settings)
  const [unknownIconLoaded, setUnknownIconLoaded] = useState(false)

  // Layers territoires mémorisés (dépendent de la faction du joueur)
  const territoryFillLayer = useMemo(() => buildTerritoryFillLayer(userFactionId), [userFactionId])
  const territoryBorderLayer = useMemo(() => buildTerritoryBorderLayer(), [])

  // Source GeoJSON Points pour les symbol layers territoire (emblèmes, labels, noms)
  // Les positions labelLon/labelLat et emblemLon/emblemLat sont pré-calculées dans le worker
  const territoryLabelsGeojson = useMemo(() => {
    if (!territories) return null

    const features = territories.features.map(f => {
      const props = f.properties as Record<string, unknown>
      const anchorPlaceId = (props.anchorPlaceId as string) || ''
      let placeIds: string[] = []
      try { placeIds = JSON.parse((props.placeIds as string) || '[]') } catch { /* ignore */ }

      // Résoudre le nom custom via territoryNames
      let customName = ''
      if (anchorPlaceId && territoryNames.has(anchorPlaceId)) {
        customName = territoryNames.get(anchorPlaceId)!.customName || ''
      }
      if (!customName) {
        for (const pid of placeIds) {
          if (territoryNames.has(pid)) { customName = territoryNames.get(pid)!.customName || ''; break }
        }
      }

      const emblemLon = props.emblemLon as number
      const emblemLat = props.emblemLat as number
      const hourlyRate = (typeof props.hourlyRate === 'number' ? props.hourlyRate : 0)

      return {
        type: 'Feature' as const,
        id: f.id,
        geometry: { type: 'Point' as const, coordinates: [emblemLon, emblemLat] },
        properties: {
          territoryId: f.id,
          tagColor: (props.tagColor as string) || '#C19A6B',
          pattern: (props.pattern as string) ? `banner::${props.pattern}` : '',
          factionTitle: (props.factionTitle as string) || '',
          placesCount: (typeof props.placesCount === 'number' ? props.placesCount : 0),
          hourlyRate: hourlyRate % 1 === 0 ? hourlyRate : Math.round(hourlyRate * 10) / 10,
          customName,
          labelLon: props.labelLon as number,
          labelLat: props.labelLat as number,
        },
      }
    })

    return { type: 'FeatureCollection' as const, features }
  }, [territories, territoryNames])

  // Source séparée pour les hover labels (positionnés au point nord, pas au centroïde)
  const territoryHoverGeojson = useMemo(() => {
    if (!territoryLabelsGeojson) return null
    return {
      type: 'FeatureCollection' as const,
      features: territoryLabelsGeojson.features.map(f => ({
        ...f,
        geometry: { type: 'Point' as const, coordinates: [f.properties.labelLon, f.properties.labelLat] },
      })),
    }
  }, [territoryLabelsGeojson])

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
    const ids = [
      'places-undiscovered-circle', 'places-undiscovered-icon',
      'places-point', 'places-icon',
    ]
    if (showFactions) ids.push('territories-fill')
    return ids
  }, [showFactions])

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
      new URL('../../workers/territoryWorker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setWorkerProgress({ phase: e.data.phase, percent: e.data.percent })
        return
      }
      setTerritories(e.data as FeatureCollection<Polygon | MultiPolygon>)
      setWorkerProgress(null)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

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
      .then(({ data }) => {
        const url = data?.value
        if (!url) return

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (map.hasImage(UNKNOWN_ICON_ID)) return
          map.addImage(UNKNOWN_ICON_ID, img)
          setUnknownIconLoaded(true)
        }
        img.src = url
      })
  }, [])

  const workerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!rawGeojson || !workerRef.current) return
    // Debounce 500ms : évite de recalculer les territoires à chaque micro-changement
    if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current)
    workerDebounceRef.current = setTimeout(() => {
      if (!workerRef.current) return
      workerRef.current.postMessage({
        features: rawGeojson.features
          .filter(f => {
            const ov = placeOverrides.get(f.properties.id)
            return f.properties.claimed || (f.properties.totalInfluence ?? 0) > 0 || ov?.claimed
          })
          .map(f => {
            const ov = placeOverrides.get(f.properties.id)
            return {
              coordinates: f.geometry.coordinates as [number, number],
              placeId: f.properties.id,
              faction: ov?.factionId || f.properties.factionId,
              factionTitle: f.properties.tagTitle,
              tagColor: ov?.tagColor || f.properties.tagColor,
              factionPattern: ov?.factionPattern || f.properties.factionPattern,
              score: Math.max(ov?.score ?? f.properties.score, (ov?.claimed || f.properties.claimed) ? 1 : 0),
              likes: f.properties.likes ?? 0,
              fortificationLevel: ov?.fortificationLevel ?? f.properties.fortificationLevel ?? 0,
              claimedByName: f.properties.claimedByName,
              claimedById: f.properties.claimedById,
              totalInfluence: f.properties.totalInfluence ?? 0,
              influenceByFaction: f.properties.influenceByFaction ?? {},
            }
          }),
        tiers: territoryTiers,
      })
    }, 500)
    return () => { if (workerDebounceRef.current) clearTimeout(workerDebounceRef.current) }
  }, [rawGeojson, placeOverrides, territoryTiers])

  // Charger les icônes SVG colorées dans la map
  // Utilise rawGeojson (stable) — les icônes ne dépendent pas du statut discovered
  const loadedIconsRef = useRef(new Set<string>())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !rawGeojson) return

    const iconColors = new Map<string, string>()
    for (const f of rawGeojson.features) {
      if (f.properties.tagIcon) {
        iconColors.set(f.properties.tagIcon, f.properties.iconColor)
      }
    }

    for (const [url, color] of iconColors) {
      if (loadedIconsRef.current.has(url)) continue
      loadedIconsRef.current.add(url)

      loadColoredSvgIcon(map, url, color).catch(() => {
        loadedIconsRef.current.delete(url)
      })
    }
  }, [rawGeojson])

  // Charger les bannières faction + tuiles pattern dans MapLibre
  const loadedPatternsRef = useRef(new Set<string>())
  const loadedTilesRef = useRef(new Set<string>())
  const loadedShieldsRef = useRef(new Set<number>())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !territoryLabelsGeojson || !territories) return

    // Charger les bannières
    for (const f of territoryLabelsGeojson.features) {
      const { pattern, tagColor } = f.properties
      if (!pattern || loadedPatternsRef.current.has(pattern)) continue
      loadedPatternsRef.current.add(pattern)
      loadBannerIcon(map, pattern, tagColor).catch(() => {
        loadedPatternsRef.current.delete(pattern)
      })
    }

    // Charger les tuiles pattern par faction (pour fill-pattern)
    // Extraire les factions uniques depuis les territories
    const factionMap = new Map<string, { pattern: string; color: string }>()
    for (const f of territories.features) {
      const factionId = f.properties?.faction as string
      const patternUrl = f.properties?.pattern as string
      const tagColor = f.properties?.tagColor as string
      if (factionId && patternUrl && !factionMap.has(factionId)) {
        factionMap.set(factionId, { pattern: patternUrl, color: tagColor })
      }
    }

    for (const [factionId, { pattern, color }] of factionMap) {
      if (loadedTilesRef.current.has(factionId)) continue
      loadedTilesRef.current.add(factionId)
      loadFactionTile(map, factionId, pattern, color).then(() => {
        // Ajouter le layer de pattern une fois la tuile chargée
        const layerId = `territories-pattern-${factionId}`
        if (!map.getLayer(layerId) && map.getSource('territories')) {
          const layer = buildTerritoryPatternLayer(factionId)
          map.addLayer(layer as any, 'territories-fill')
        }
      }).catch(() => {
        loadedTilesRef.current.delete(factionId)
      })
    }
  }, [territoryLabelsGeojson, territories])

  // Charger les boucliers de fortification (niveaux 1-6)
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
    if (addPlaceMode) return // Don't select places while placing

    const feature = event.features?.[0]
    if (!feature) {
      setSelectedPlaceId(null)
      setSelectedTerritoryData(null)
      return
    }

    // Clic sur un territoire → ouvrir le TerritoryPanel avec les infos du blob
    if (feature.layer?.id?.startsWith('territories')) {
      // Lire les propriétés directement depuis la feature territory (plus besoin de territoryLabels)
      const tp = feature.properties as Record<string, unknown>
      const placesCount = (typeof tp.placesCount === 'number' ? tp.placesCount : 0)
      if (placesCount >= 3) {
        let placeIds: string[] = []
        try { placeIds = JSON.parse((tp.placeIds as string) || '[]') } catch { /* ignore */ }

        // Resolve customName from territory names store
        const anchorId = (tp.anchorPlaceId as string) || ''
        let resolvedName: string | null = null
        if (anchorId && territoryNames.has(anchorId)) {
          resolvedName = territoryNames.get(anchorId)!.customName
        }
        if (!resolvedName) {
          for (const pid of placeIds) {
            if (territoryNames.has(pid)) { resolvedName = territoryNames.get(pid)!.customName; break }
          }
        }

        setSelectedPlaceId(null)
        setSelectedTerritoryData({
          territoryTitle: (tp.territoryTitle as string) || '',
          customName: resolvedName,
          anchorPlaceId: anchorId,
          placeIds,
          topContributorId: (tp.topContributorId as string) || '',
          topContributorName: (tp.topContributorName as string) || '',
          factionTitle: (tp.factionTitle as string) || '',
          tagColor: (tp.tagColor as string) || '#C19A6B',
          placesCount,
          hourlyRate: (typeof tp.hourlyRate === 'number' ? tp.hourlyRate : 0),
          totalFortification: (typeof tp.totalFortification === 'number' ? tp.totalFortification : 0),
          players: (tp.players as string) || '',
        })
      }
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

  // Hover sur les territoires — feature-state sur territories + territory-hover-labels
  const hoveredTerritoryRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  /** Met le feature-state hover sur les 2 sources liées aux territoires */
  const setTerritoryHover = useCallback((map: MaplibreMap, id: number, hover: boolean) => {
    const state = { hover }
    if (map.getSource('territories')) map.setFeatureState({ source: 'territories', id }, state)
    if (map.getSource('territory-hover-labels')) map.setFeatureState({ source: 'territory-hover-labels', id }, state)
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
    // Clear territory hover
    if (hoveredTerritoryRef.current !== null) {
      setTerritoryHover(map, hoveredTerritoryRef.current, false)
      hoveredTerritoryRef.current = null
    }
  }, [setTerritoryHover])

  // GPS tracking → playerStore
  const onGeolocate = useCallback((e: { coords: { longitude: number; latitude: number } }) => {
    setUserPosition({ lng: e.coords.longitude, lat: e.coords.latitude })
  }, [setUserPosition])

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    // Throttle : 1 traitement par frame max (évite 60 queries GPU/sec)
    const point = e.point
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const map = mapRef.current?.getMap()
      if (!map || !map.getLayer('territories-fill') || !map.getSource('territories')) return

      const features = map.queryRenderedFeatures(point, { layers: ['territories-fill'] })

      // Clear previous hover
      if (hoveredTerritoryRef.current !== null) {
        setTerritoryHover(map, hoveredTerritoryRef.current, false)
        hoveredTerritoryRef.current = null
      }

      if (features.length > 0 && features[0].id != null) {
        const id = features[0].id as number
        hoveredTerritoryRef.current = id
        setTerritoryHover(map, id, true)
      }
    })
  }, [setTerritoryHover])

  // Apply placeOverrides to geojson for icon/badge rendering (fortification, faction, etc.)
  const enrichedGeojson = useMemo(() => {
    if (!geojson || placeOverrides.size === 0) return geojson
    return {
      ...geojson,
      features: geojson.features.map(f => {
        const ov = placeOverrides.get(f.properties.id)
        if (!ov) return f
        return {
          ...f,
          properties: {
            ...f.properties,
            ...(ov.fortificationLevel !== undefined && { fortificationLevel: ov.fortificationLevel }),
            ...(ov.factionId !== undefined && { factionId: ov.factionId }),
            ...(ov.tagColor !== undefined && { tagColor: ov.tagColor }),
            ...(ov.factionPattern !== undefined && { factionPattern: ov.factionPattern }),
            ...(ov.score !== undefined && { score: ov.score }),
          },
        }
      }),
    }
  }, [geojson, placeOverrides])

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
    <div style={MAP_CONTAINER_STYLE} data-map-style={mapStyleMode}>
    <MapGL
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={MAP_STYLE_PROP}
      mapStyle={mapStyle}
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      fadeDuration={0}
      attributionControl={false}
      onLoad={onMapLoad}
      onMoveEnd={onMoveEnd}
      onZoomEnd={e => setZoomLevel(Math.floor(e.viewState.zoom))}
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
                '--faction-color': userFactionColor ?? '#4A90D9',
                '--faction-glow': `${userFactionColor ?? '#4A90D9'}60`,
              } as React.CSSProperties}
            >
              <div className="user-position-pulse" />
              <div className="user-position-dot" />
            </div>
          ) : (
            <div
              className="user-marker-wrapper"
              style={{ '--faction-color': userFactionColor ?? '#4A90D9' } as React.CSSProperties}
              onClick={() => currentUserId && setSelectedPlayerId(currentUserId)}
            >
              <div
                className="user-position-marker"
                style={{
                  '--faction-color': userFactionColor ?? '#4A90D9',
                  '--faction-glow': `${userFactionColor ?? '#4A90D9'}60`,
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
              {userPrimaryTitle && (
                <span className="other-player-title">{userPrimaryTitle}</span>
              )}
            </div>
          )}
        </Marker>
      )}

      {/* Marqueurs des autres joueurs connectés */}
      <OnlinePlayerMarkers players={onlinePlayers} onSelectPlayer={setSelectedPlayerId} />

      {enrichedGeojson && (
        <Source
          id="places"
          type="geojson"
          data={enrichedGeojson}
        >
          <Layer {...undiscoveredCircleFinal} />
          <Layer {...undiscoveredIconFinal} />
          <Layer {...pointLayer} />
          <Layer {...iconLayer} />
          {showFactions && <Layer {...fortBadgeLayer} />}
        </Source>
      )}

      {showFactions && territories && (
        <Source id="territories" type="geojson" data={territories}>
          <Layer {...territoryFillLayer} beforeId="places-undiscovered-circle" />
          <Layer {...territoryBorderLayer} beforeId="places-undiscovered-circle" />
        </Source>
      )}

      {/* Emblèmes, noms custom, labels hover — symbol layers GPU (0 DOM nodes) */}
      {showFactions && territoryLabelsGeojson && (
        <Source id="territory-labels" type="geojson" data={territoryLabelsGeojson}>
          <Layer {...territoryEmblemLayer} />
        </Source>
      )}
      {/* Noms custom des territoires — HTML Markers pour contrôle CSS total */}
      {showFactions && zoomLevel >= 6 && territoryLabelsGeojson?.features.map(f => {
        const { customName, tagColor } = f.properties as Record<string, unknown>
        if (!customName) return null
        const [lon, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates
        const style = { '--t-color': tagColor } as React.CSSProperties;
        return (
          <Marker key={`tname-${f.id}`} longitude={lon} latitude={lat} anchor="top" offset={[0, Math.round(150 * (0.20 + (Math.min(Math.max(zoomLevel, 6), 12) - 6) * (0.60 - 0.20) / 6) / 2)]}>
            <div
              className={`territory-name-label${zoomLevel >= 7 ? ' visible' : ''}`}
              style={style}
            >
              <span className="territory-name-text">{(customName as string).toUpperCase()}</span>
            </div>
          </Marker>
        )
      })}

      {showFactions && territoryHoverGeojson && (
        <Source id="territory-hover-labels" type="geojson" data={territoryHoverGeojson}>
          <Layer {...territoryHoverLabelLayer} />
        </Source>
      )}

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

      {workerProgress && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--color-parchment)] text-[var(--color-ink)] px-4 py-2 rounded shadow-md text-xs font-[var(--font-body)] z-10 flex items-center gap-3 min-w-[220px]">
          <span>{workerProgress.phase}</span>
          <div className="flex-1 h-1.5 bg-[var(--color-ink)]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-ink)] rounded-full transition-[width] duration-300"
              style={{ width: `${workerProgress.percent}%` }}
            />
          </div>
          <span className="tabular-nums">{workerProgress.percent}%</span>
        </div>
      )}
    </MapGL>

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
            <span className="conquest-count">{discovered}/{total} lieux découverts</span>
            <span className="conquest-pct">{Math.round(pct)}%</span>
          </div>
          <div className="conquest-bar">
            <div className="conquest-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null
    })()}

    {/* Sélecteur de style de carte (toujours visible) */}
    <MapStyleSelect
      mode={mapStyleMode}
      onChange={setMapStyleMode}
      addPlaceMode={addPlaceMode}
    />

    </div>
  )
})
