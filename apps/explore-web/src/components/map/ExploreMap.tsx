import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapGL, Source, Layer, Popup, NavigationControl, GeolocateControl } from '@vis.gl/react-maplibre'
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

import { usePlaces } from '../../hooks/usePlaces'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { loadParchmentStyle, MAP_COLORS } from '../../lib/map-style'
import { useMapStore } from '../../stores/mapStore'

// --- Utilitaire : SVG coloré avec bordure → ImageData pour MapLibre ---

const ICON_SIZE = 100
const BORDER = 6 // épaisseur du contour en pixels

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

async function loadColoredSvgIcon(
  map: maplibregl.Map,
  url: string,
  color: string,
): Promise<void> {
  const res = await fetch(url)
  const rawSvg = await res.text()

  // Deux versions : bordure (couleur parchemin) et remplissage (couleur du tag)
  const [borderImg, fillImg] = await Promise.all([
    svgToImage(colorizeSvg(rawSvg, MAP_COLORS.land)),
    svgToImage(colorizeSvg(rawSvg, color)),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')!

  const drawSize = ICON_SIZE - BORDER * 2

  // Dessiner la bordure : même forme décalée dans toutes les directions
  for (let dx = -BORDER; dx <= BORDER; dx++) {
    for (let dy = -BORDER; dy <= BORDER; dy++) {
      if (dx === 0 && dy === 0) continue
      ctx.drawImage(borderImg, BORDER + dx, BORDER + dy, drawSize, drawSize)
    }
  }

  // Dessiner le remplissage par-dessus, centré
  ctx.drawImage(fillImg, BORDER, BORDER, drawSize, drawSize)

  const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
  if (!map.hasImage(url)) {
    map.addImage(url, imageData, { sdf: false })
  }
}

// --- Layer style : Territoires ---

const territoryFillLayer: LayerSpecification = {
  id: 'territories-fill',
  type: 'fill',
  source: 'territories',
  paint: {
    'fill-color': ['get', 'tagColor'],
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.22,    // hover → boost léger
      0.12,    // fixe
    ],
    'fill-antialias': false,  // supprime les coutures entre polygones
  },
}

const territoryBorderLayer: LayerSpecification = {
  id: 'territories-border',
  type: 'line',
  source: 'territories',
  paint: {
    'line-color': ['get', 'tagColor'],
    'line-width': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      2,       // hover → bordure visible
      0,       // caché → pas de séparation entre même faction
    ],
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.6,
      0,
    ],
  },
}

// --- Layer style : Markers ---

// Cercles colorés — uniquement pour les lieux SANS icône
const pointLayer: LayerSpecification = {
  id: 'places-point',
  type: 'circle',
  source: 'places',
  filter: ['==', ['get', 'tagIcon'], ''],
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
  },
}

// Icônes SVG colorées — remplace le cercle pour les lieux qui ont une icône
const iconLayer: LayerSpecification = {
  id: 'places-icon',
  type: 'symbol',
  source: 'places',
  filter: ['!=', ['get', 'tagIcon'], ''],
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

export function ExploreMap() {
  const mapRef = useRef<MapRef>(null)
  const { geojson, loading, error } = usePlaces()
  const [territories, setTerritories] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [workerProgress, setWorkerProgress] = useState<{ phase: string; percent: number } | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const placeOverrides = useMapStore(state => state.placeOverrides)

  // Charger le style parchemin
  useEffect(() => {
    loadParchmentStyle().then(setMapStyle)
  }, [])

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

  // Nice par défaut — sera remplacé par la géoloc utilisateur plus tard
  const userCenter: [number, number] = [7.26, 43.7]

  useEffect(() => {
    if (!geojson || !workerRef.current) return
    workerRef.current.postMessage({
      features: geojson.features.map(f => {
        const ov = placeOverrides.get(f.properties.id)
        return {
          coordinates: f.geometry.coordinates as [number, number],
          faction: ov?.tagTitle || f.properties.tagTitle || 'inconnu',
          tagColor: ov?.tagColor || f.properties.tagColor,
          score: ov?.score ?? f.properties.score,
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

  const onClick = useCallback((event: MapLayerMouseEvent) => {
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
  }, [geojson])

  // Curseur pointer sur les layers interactifs
  const onMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

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
  }, [])

  // Hover sur les territoires — feature-state
  const hoveredTerritoryRef = useRef<number | null>(null)

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap()
    if (!map) return

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
    <MapGL
      ref={mapRef}
      initialViewState={{
        longitude: userCenter[0],
        latitude: userCenter[1],
        zoom: 9,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      interactiveLayerIds={['places-point', 'places-icon', 'territories-fill']}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      fadeDuration={0}
      attributionControl={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl position="top-right" />

      {geojson && (
        <Source
          id="places"
          type="geojson"
          data={geojson}
        >
          <Layer {...pointLayer} />
          <Layer {...iconLayer} />
        </Source>
      )}

      {territories && (
        <Source id="territories" type="geojson" data={territories}>
          <Layer {...territoryFillLayer} beforeId="places-point" />
          <Layer {...territoryBorderLayer} beforeId="places-point" />
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
  )
}
