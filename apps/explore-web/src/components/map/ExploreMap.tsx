import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapGL, Source, Layer, Popup, Marker, NavigationControl, GeolocateControl } from '@vis.gl/react-maplibre'
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

import { usePlaces } from '../../hooks/usePlaces'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { loadParchmentStyle, loadParchmentDetailedStyle, loadSatelliteStyle, MAP_COLORS } from '../../lib/map-style'
import { useMapStore } from '../../stores/mapStore'
import { useFogStore } from '../../stores/fogStore'
import { usePlayersStore } from '../../stores/playersStore'
import { supabase } from '../../lib/supabase'
import { Minimap } from './Minimap'

// --- Utilitaire : SVG coloré avec bordure → ImageData pour MapLibre ---

const ICON_SIZE = 120

/** Charge un SVG text en HTMLImageElement */
function svgToImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const blobUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject() }
    img.src = blobUrl
  })
}

/** Force une couleur de fill sur tout le SVG via <style> !important */
function colorizeSvg(rawSvg: string, color: string): string {
  const style = `<style>path,circle,rect,polygon,polyline,ellipse,line{fill:${color}!important}[fill="none"]{fill:none!important}</style>`
  return rawSvg.replace(/(<svg[^>]*>)/, `$1${style}`)
}

/** Ajuste une couleur hex : amount > 0 éclaircit, < 0 assombrit */
function shiftColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const shift = (c: number) => Math.max(0, Math.min(255, Math.round(
    amount > 0 ? c + (255 - c) * amount : c * (1 + amount),
  )))
  return `rgb(${shift(r)},${shift(g)},${shift(b)})`
}

async function loadColoredSvgIcon(
  map: maplibregl.Map,
  url: string,
  color: string,
): Promise<void> {
  const res = await fetch(`${url}?v=${Date.now()}`)
  const rawSvg = await res.text()

  // Icône en blanc
  const whiteIcon = await svgToImage(colorizeSvg(rawSvg, '#ffffff'))

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')!
  const cx = ICON_SIZE / 2
  const cy = ICON_SIZE / 2
  const r = ICON_SIZE / 2 - 1

  // Fond : cercle avec dégradé linéaire (clair en haut, sombre en bas)
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
  grad.addColorStop(0, shiftColor(color, 0.35))    // haut clair
  grad.addColorStop(0.5, color)                     // milieu couleur tag
  grad.addColorStop(1, shiftColor(color, -0.25))   // bas assombri

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Icône blanche centrée (60% du diamètre du cercle)
  const iconSize = ICON_SIZE * 0.55
  const iconOffset = (ICON_SIZE - iconSize) / 2
  ctx.drawImage(whiteIcon, iconOffset, iconOffset, iconSize, iconSize)

  const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
  if (!map.hasImage(url)) {
    map.addImage(url, imageData, { sdf: false })
  }
}

// --- Layer style : Territoires (construits dynamiquement selon la faction du joueur) ---

function buildTerritoryFillLayer(userFactionId: string | null): LayerSpecification {
  const myFaction = userFactionId ?? ''
  return {
    id: 'territories-fill',
    type: 'fill',
    source: 'territories',
    paint: {
      'fill-color': ['get', 'tagColor'],
      'fill-opacity': [
        'case',
        ['==', ['get', 'faction'], myFaction],
        0.28,    // Ma faction : bien visible
        ['boolean', ['feature-state', 'hover'], false],
        0.30,    // Hover autre faction
        0.18,    // Autre faction : standard
      ],
      'fill-antialias': false,
    },
  }
}

function buildTerritoryBorderLayer(): LayerSpecification {
  return {
    id: 'territories-border',
    type: 'line',
    source: 'territories',
    paint: {
      'line-color': ['get', 'tagColor'],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3.5,
        2.5,
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.45,
      ],
    },
  }
}

// --- Layer style : Markers ---

const UNKNOWN_ICON_ID = '__unknown-place'

// Fallback cercles flous si pas d'icône unknown configurée (caché quand icône dispo)
// S'applique à TOUS les lieux non découverts (y compris faction alliée)
const undiscoveredCircleLayer: LayerSpecification = {
  id: 'places-undiscovered-circle',
  type: 'circle',
  source: 'places',
  filter: ['==', ['get', 'discovered'], false],
  paint: {
    'circle-color': '#8A7B6A',
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 4,
      8, 6,
      12, 9,
    ],
    'circle-stroke-width': 0,
    'circle-opacity': 0.6,
    'circle-blur': 1,
  },
}

// Icône custom pour les lieux non découverts (visible quand icône chargée)
// S'applique à TOUS les lieux non découverts (y compris faction alliée)
const undiscoveredIconLayer: LayerSpecification = {
  id: 'places-undiscovered-icon',
  type: 'symbol',
  source: 'places',
  filter: ['==', ['get', 'discovered'], false],
  layout: {
    'icon-image': UNKNOWN_ICON_ID,
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.25,
      8, 0.35,
      12, 0.5,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 0.8,
  },
}

// Cercles colorés nets — lieux découverts SANS icône
const pointLayer: LayerSpecification = {
  id: 'places-point',
  type: 'circle',
  source: 'places',
  filter: ['all',
    ['==', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
  ],
  paint: {
    'circle-color': ['get', 'tagColor'],
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 3,
      8, 5,
      12, 7,
    ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': MAP_COLORS.land,
    'circle-opacity': 1,
    'circle-blur': 0,
  },
}

// Icônes SVG colorées — lieux découverts avec icône
const iconLayer: LayerSpecification = {
  id: 'places-icon',
  type: 'symbol',
  source: 'places',
  filter: ['all',
    ['!=', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
  ],
  layout: {
    'icon-image': ['get', 'tagIcon'],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.15,
      8, 0.25,
      12, 0.4,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 1,
  },
}

// --- Component ---

interface PopupInfo {
  id: string
  longitude: number
  latitude: number
  title: string
  tagTitle: string
  tagColor: string
}

// --- Map Style Select (dropdown vers le haut, style Google Maps) ---

type MapStyleMode = 'game' | 'detailed' | 'satellite'

const STYLE_OPTIONS: { mode: MapStyleMode; label: string; icon: string }[] = [
  { mode: 'game',      label: 'Jeu',       icon: '\uD83D\uDCDC' },  // 📜
  { mode: 'detailed',  label: 'Détaillé',  icon: '\uD83C\uDFD8\uFE0F' },  // 🏘️
  { mode: 'satellite', label: 'Satellite', icon: '\uD83D\uDEF0\uFE0F' },  // 🛰️
]

function MapStyleSelect({ mode, onChange, addPlaceMode }: {
  mode: MapStyleMode
  onChange: (m: MapStyleMode) => void
  addPlaceMode: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = STYLE_OPTIONS.find(o => o.mode === mode)!

  return (
    <div
      ref={ref}
      className="map-style-select"
      style={addPlaceMode ? { bottom: 70 } : undefined}
    >
      {/* Dropdown (s'ouvre vers le haut) */}
      {open && (
        <div className="map-style-dropdown">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              className={`map-style-option${opt.mode === mode ? ' active' : ''}`}
              onClick={() => { onChange(opt.mode); setOpen(false) }}
            >
              <span className="map-style-option-icon">{opt.icon}</span>
              <span className="map-style-option-label">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bouton principal (icône layers) */}
      <button
        className="map-style-trigger"
        onClick={() => setOpen(!open)}
        title={`Style : ${current.label}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>
    </div>
  )
}

const MAP_STYLE_PROP = { width: '100%', height: '100%' } as const
const MAP_CONTAINER_STYLE = { position: 'relative' as const, width: '100%', height: '100%' }
const INITIAL_VIEW = { longitude: 7.26, latitude: 43.7, zoom: 9 }

export const ExploreMap = memo(function ExploreMap() {
  const mapRef = useRef<MapRef>(null)
  const { geojson, loading, error } = usePlaces()
  const [territories, setTerritories] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [workerProgress, setWorkerProgress] = useState<{ phase: string; percent: number } | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const placeOverrides = useMapStore(state => state.placeOverrides)
  const pendingFlyTo = useMapStore(state => state.pendingFlyTo)
  const clearPendingFlyTo = useMapStore(state => state.clearPendingFlyTo)
  const setUserPosition = useFogStore(s => s.setUserPosition)
  const userPosition = useFogStore(s => s.userPosition)
  const userAvatarUrl = useFogStore(s => s.userAvatarUrl)
  const userFactionId = useFogStore(s => s.userFactionId)
  const userFactionColor = useFogStore(s => s.userFactionColor)
  const currentUserId = useFogStore(s => s.userId)
  const onlinePlayers = usePlayersStore(s => s.players)
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)
  const addPlaceMode = useMapStore(s => s.addPlaceMode)
  const setPendingNewPlaceCoords = useMapStore(s => s.setPendingNewPlaceCoords)
  const mapStyleMode = useMapStore(s => s.mapStyleMode)
  const setMapStyleMode = useMapStore(s => s.setMapStyleMode)

  // Viewport bounds pour la minimap
  const [viewBounds, setViewBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)

  // Icône custom pour les lieux non découverts (chargée depuis app_settings)
  const [unknownIconLoaded, setUnknownIconLoaded] = useState(false)

  // Layers territoires mémorisés (dépendent de la faction du joueur)
  const territoryFillLayer = useMemo(() => buildTerritoryFillLayer(userFactionId), [userFactionId])
  const territoryBorderLayer = useMemo(() => buildTerritoryBorderLayer(), [])

  // Labels joueurs + blason par territoire
  const territoryLabels = useMemo(() => {
    if (!territories) return null

    const labels: {
      lon: number; lat: number
      emblemLon: number; emblemLat: number
      territoryId: number
      factionTitle: string; players: string; placesCount: number
      hourlyRate: number
      tagColor: string; pattern: string
    }[] = []

    for (const f of territories.features) {
      const props = f.properties as Record<string, unknown>
      const territoryId = f.id as number
      const factionTitle = (props.factionTitle as string) || ''
      const tagColor = (props.tagColor as string) || '#C19A6B'
      const pattern = (props.pattern as string) || ''
      const players = (typeof props.players === 'string' ? props.players : '')
      const placesCount = (typeof props.placesCount === 'number' ? props.placesCount : 0)
      const hourlyRate = (typeof props.hourlyRate === 'number' ? props.hourlyRate : 0)

      // Extraire les anneaux extérieurs
      const rings: number[][][] =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates[0]]
          : f.geometry.coordinates.map(poly => poly[0])

      for (const ring of rings) {
        // Point le plus au nord (pour le label texte)
        let topLon = ring[0][0], topLat = ring[0][1]
        for (let i = 1; i < ring.length - 1; i++) {
          if (ring[i][1] > topLat) {
            topLon = ring[i][0]
            topLat = ring[i][1]
          }
        }

        // Bounding box pour positionner le blason en haut-droite
        let maxLon = -Infinity, maxLat = -Infinity
        for (let i = 0; i < ring.length - 1; i++) {
          if (ring[i][0] > maxLon) maxLon = ring[i][0]
          if (ring[i][1] > maxLat) maxLat = ring[i][1]
        }
        // Vers l'intérieur — décalé à gauche du coin nord-est
        const emblemLon = maxLon - (maxLon - topLon) * 0.55
        const emblemLat = maxLat - (maxLat - topLat) * 0.65

        labels.push({
          lon: topLon, lat: topLat,
          emblemLon, emblemLat,
          territoryId, factionTitle, players, placesCount, hourlyRate, tagColor, pattern,
        })
      }
    }

    return labels
  }, [territories])

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
  const interactiveLayerIds = useMemo(() => [
    'places-undiscovered-circle', 'places-undiscovered-icon',
    'places-point', 'places-icon', 'territories-fill',
  ], [])

  // Lieux fortifiés → Markers ⭐ par-dessus l'icône du lieu
  const fortifiedPlaces = useMemo(() => {
    if (!geojson) return []
    return geojson.features
      .filter(f => (f.properties.fortificationLevel ?? 0) > 0)
      .map(f => ({
        id: f.properties.id as string,
        lon: (f.geometry.coordinates as [number, number])[0],
        lat: (f.geometry.coordinates as [number, number])[1],
      }))
  }, [geojson])

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
    return () => worker.terminate()
  }, [])

  // Géolocalisation navigateur : centrer la carte + alimenter fogStore
  // On stocke la position dans une ref pour l'utiliser dans onMapLoad
  const geoResultRef = useRef<{ lng: number; lat: number } | null>(null)

  useEffect(() => {
    let resolved = false
    const applyPosition = (coords: { lng: number; lat: number }, source: string) => {
      if (resolved) return
      resolved = true
      console.log(`[GEO] Position via ${source}:`, coords)
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
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          // GPS gagne toujours, même si IP a déjà répondu
          resolved = false // force override
          applyPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude }, 'GPS')
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

  // Fly-to demandé depuis l'extérieur (toast cliqué, etc.)
  useEffect(() => {
    if (!pendingFlyTo) return
    mapRef.current?.flyTo({ center: [pendingFlyTo.lng, pendingFlyTo.lat], zoom: 14, duration: 1200 })
    if (pendingFlyTo.placeId) {
      setSelectedPlaceId(pendingFlyTo.placeId)
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
        img.src = `${url}?v=${Date.now()}`
      })
  }, [])

  useEffect(() => {
    if (!geojson || !workerRef.current) return
    // Tous les lieux revendiqués → zone d'influence (visible même non découverts)
    workerRef.current.postMessage({
      features: geojson.features
        .filter(f => {
          const ov = placeOverrides.get(f.properties.id)
          return f.properties.claimed || ov?.claimed
        })
        .map(f => {
          const ov = placeOverrides.get(f.properties.id)
          return {
            coordinates: f.geometry.coordinates as [number, number],
            faction: ov?.factionId || f.properties.factionId,
            factionTitle: f.properties.tagTitle,
            tagColor: ov?.tagColor || f.properties.tagColor,
            factionPattern: ov?.factionPattern || f.properties.factionPattern,
            score: Math.max(ov?.score ?? f.properties.score, (ov?.claimed || f.properties.claimed) ? 1 : 0),
            fortificationLevel: f.properties.fortificationLevel ?? 0,
            claimedByName: f.properties.claimedByName,
          }
        }),
    })
  }, [geojson, placeOverrides])

  // Charger les icônes SVG colorées dans la map
  const loadedIconsRef = useRef(new Set<string>())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !geojson) return

    // Collecter les paires (url, color) uniques
    const iconColors = new Map<string, string>()
    for (const f of geojson.features) {
      if (f.properties.tagIcon) {
        iconColors.set(f.properties.tagIcon, f.properties.tagColor)
      }
    }

    for (const [url, color] of iconColors) {
      if (loadedIconsRef.current.has(url)) continue
      loadedIconsRef.current.add(url)

      loadColoredSvgIcon(map, url, color).catch(() => {
        loadedIconsRef.current.delete(url)
      })
    }
  }, [geojson])

  // Note: fill-pattern supprimé — les blasons flottants (Markers HTML) remplacent le pattern

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    if (addPlaceMode) return // Don't select places while placing

    const feature = event.features?.[0]
    if (!feature) {
      setSelectedPlaceId(null)
      return
    }

    // Clic sur un territoire → ouvrir le lieu le plus proche (= générateur Voronoi)
    if (feature.layer?.id?.startsWith('territories')) {
      if (!geojson) return
      const { lng, lat } = event.lngLat
      let nearestId: string | null = null
      let minDist = Infinity
      for (const f of geojson.features) {
        const [pLng, pLat] = f.geometry.coordinates
        const dx = pLng - lng
        const dy = pLat - lat
        const dist = dx * dx + dy * dy
        if (dist < minDist) {
          minDist = dist
          nearestId = f.properties.id
        }
      }
      if (nearestId) setSelectedPlaceId(nearestId)
      return
    }

    const props = feature.properties as PlaceProperties
    setSelectedPlaceId(props.id)
    setPopupInfo(null)
  }, [geojson, addPlaceMode])

  // Minimap : mettre à jour le viewport bounds + coords pour add-place
  const onMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    if (b) setViewBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    if (addPlaceMode) {
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
    // Clear territory hover
    if (hoveredTerritoryRef.current !== null) {
      map.setFeatureState(
        { source: 'territories', id: hoveredTerritoryRef.current },
        { hover: false },
      )
      hoveredTerritoryRef.current = null
    }
    setHoveredTerritoryId(null)
  }, [])

  // GPS tracking → fogStore
  const onGeolocate = useCallback((e: { coords: { longitude: number; latitude: number } }) => {
    setUserPosition({ lng: e.coords.longitude, lat: e.coords.latitude })
  }, [setUserPosition])

  // Hover sur les territoires — feature-state + faction hovered pour labels
  const hoveredTerritoryRef = useRef<number | null>(null)
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState<number | null>(null)

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap()
    if (!map || !map.getLayer('territories-fill')) return

    const features = map.queryRenderedFeatures(e.point, { layers: ['territories-fill'] })

    // Clear previous hover
    if (hoveredTerritoryRef.current !== null) {
      map.setFeatureState(
        { source: 'territories', id: hoveredTerritoryRef.current },
        { hover: false },
      )
      hoveredTerritoryRef.current = null
    }

    if (features.length > 0 && features[0].id != null) {
      const id = features[0].id as number
      hoveredTerritoryRef.current = id
      map.setFeatureState(
        { source: 'territories', id },
        { hover: true },
      )
      setHoveredTerritoryId(id)
    } else {
      setHoveredTerritoryId(null)
    }
  }, [])

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
              className="user-position-marker"
              style={{
                '--faction-color': userFactionColor ?? '#4A90D9',
                '--faction-glow': `${userFactionColor ?? '#4A90D9'}60`,
                cursor: 'pointer',
              } as React.CSSProperties}
              onClick={() => currentUserId && setSelectedPlayerId(currentUserId)}
            >
              <div className="user-position-pulse" />
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="" className="user-position-avatar" />
              ) : (
                <div className="user-position-dot" />
              )}
            </div>
          )}
        </Marker>
      )}

      {/* Marqueurs des autres joueurs connectés */}
      {Array.from(onlinePlayers.values()).map(player => (
        <Marker key={player.userId} longitude={player.position.lng} latitude={player.position.lat} anchor="center">
          <div
            className="other-player-marker"
            style={{
              '--faction-color': player.factionColor ?? '#888',
            } as React.CSSProperties}
            onClick={() => setSelectedPlayerId(player.userId)}
          >
            {player.avatarUrl ? (
              <img src={player.avatarUrl} alt="" className="other-player-avatar" />
            ) : (
              <div className="other-player-dot" />
            )}
            <span className="other-player-name">{player.name}</span>
          </div>
        </Marker>
      ))}

      {geojson && (
        <Source
          id="places"
          type="geojson"
          data={geojson}
        >
          <Layer {...undiscoveredCircleFinal} />
          <Layer {...undiscoveredIconFinal} />
          <Layer {...pointLayer} />
          <Layer {...iconLayer} />
        </Source>
      )}

      {territories && (
        <Source id="territories" type="geojson" data={territories}>
          <Layer {...territoryFillLayer} beforeId="places-undiscovered-circle" />
          <Layer {...territoryBorderLayer} beforeId="places-undiscovered-circle" />
        </Source>
      )}

      {/* Blasons flottants au centroïde de chaque territoire */}
      {territoryLabels && territoryLabels.map((label, i) => (
        label.pattern ? (
          <Marker
            key={`emblem-${i}`}
            longitude={label.emblemLon}
            latitude={label.emblemLat}
            anchor="center"
          >
            <div className="territory-emblem-wrap">
              <div
                className="territory-emblem"
                style={{ '--emblem-color': label.tagColor } as React.CSSProperties}
              >
                <img src={label.pattern} alt="" className="territory-emblem-img" />
              </div>
              {label.hourlyRate > 0 && (
                <span className="territory-emblem-rate" style={{ color: label.tagColor }}>
                  +{label.hourlyRate % 1 === 0 ? label.hourlyRate : label.hourlyRate.toFixed(1)}/h
                </span>
              )}
            </div>
          </Marker>
        ) : null
      ))}

      {/* ⭐ sur les lieux fortifiés */}
      {fortifiedPlaces.map(p => (
        <Marker key={`fort-${p.id}`} longitude={p.lon} latitude={p.lat} anchor="center">
          <span className="place-fortified-star">{'🛡️'}</span>
        </Marker>
      ))}

      {/* Labels texte au survol (point le plus au nord) */}
      {territoryLabels && territoryLabels.map((label, i) => (
        label.players ? (
          <Marker
            key={`label-${i}`}
            longitude={label.lon}
            latitude={label.lat}
            anchor="bottom"
          >
            <div
              className={`territory-label${hoveredTerritoryId === label.territoryId ? ' visible' : ''}`}
              style={{ '--label-color': label.tagColor } as React.CSSProperties}
            >
              <div className="territory-label-faction">{label.factionTitle}</div>
              <div className="territory-label-players">{label.players}</div>
              <div className="territory-label-count">{label.placesCount} lieu{label.placesCount > 1 ? 'x' : ''} contrôlé{label.placesCount > 1 ? 's' : ''}</div>
            </div>
          </Marker>
        ) : null
      ))}

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--color-parchment)] text-[var(--color-ink)] px-4 py-2 rounded shadow-md text-sm font-[var(--font-body)] z-10">
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

    {/* Barre de progression découvertes (masquée en mode add-place) */}
    {!addPlaceMode && geojson && (() => {
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
