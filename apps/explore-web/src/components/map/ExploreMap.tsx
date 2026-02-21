import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapGL, Source, Layer, Popup, NavigationControl, GeolocateControl } from '@vis.gl/react-maplibre'
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { usePlaces } from '../../hooks/usePlaces'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { loadParchmentStyle, MAP_COLORS } from '../../lib/map-style'
import { useMapStore } from '../../stores/mapStore'

// --- Utilitaire : SVG coloré avec bordure → ImageData pour MapLibre ---

const ICON_SIZE = 120
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

// --- Layer style ---

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
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)

  // Charger le style parchemin
  useEffect(() => {
    loadParchmentStyle().then(setMapStyle)
  }, [])

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
      // Clic dans le vide → fermer le panel
      setSelectedPlaceId(null)
      return
    }

    const props = feature.properties as PlaceProperties

    setSelectedPlaceId(props.id)
    setPopupInfo(null)
  }, [])

  // Curseur pointer sur les layers interactifs
  const onMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = ''
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
        longitude: 2.35,
        latitude: 46.6,
        zoom: 5.5,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      interactiveLayerIds={['places-point', 'places-icon']}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
    </MapGL>
  )
}
