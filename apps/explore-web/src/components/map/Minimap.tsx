import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import type { PlaceProperties } from '../../hooks/usePlaces'

interface ViewBounds {
  north: number
  south: number
  east: number
  west: number
}

interface MinimapProps {
  geojson: FeatureCollection<Point, PlaceProperties>
  bounds: ViewBounds
  onNavigate: (lng: number, lat: number) => void
}

const CANVAS_W = 600 // 2x retina (affiché 300px)
const CANVAS_H = 450
const PADDING = 0.2
const UNCLAIMED_COLOR = '#D4C4A8'
const FOG_ALPHA = 0.3
const BG_COLOR = '#F5E6D3'
const VIEWPORT_STROKE = 'rgba(74, 55, 40, 0.85)'
const VIEWPORT_FILL = 'rgba(74, 55, 40, 0.15)'
const POINT_RADIUS = 3
const TILE_ZOOM = 5

// ---- Mercator helpers ----
function latToMercY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat))
  const latRad = clamped * Math.PI / 180
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2))
}

function mercYToLat(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI
}

// ---- Tile math (Web Mercator) ----
function lngToTileX(lng: number, zoom: number): number {
  return Math.floor((lng + 180) / 360 * Math.pow(2, zoom))
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = lat * Math.PI / 180
  return Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom),
  )
}

function tileToLng(x: number, zoom: number): number {
  return x / Math.pow(2, zoom) * 360 - 180
}

function tileToLat(y: number, zoom: number): number {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom)
  return Math.atan(Math.sinh(n)) * 180 / Math.PI
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)]
}

export function Minimap({ geojson, bounds, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsImageRef = useRef<ImageData | null>(null)
  const [bgImage, setBgImage] = useState<ImageData | null>(null)

  // Bornes par percentile 2-98% → ignore les DOM-TOM, focus France métropolitaine
  const globalBounds = useMemo(() => {
    const lngs = geojson.features.map(f => f.geometry.coordinates[0]).sort((a, b) => a - b)
    const lats = geojson.features.map(f => f.geometry.coordinates[1]).sort((a, b) => a - b)

    const minLng = percentile(lngs, 0.02)
    const maxLng = percentile(lngs, 0.98)
    const minLat = percentile(lats, 0.02)
    const maxLat = percentile(lats, 0.98)

    const dLng = (maxLng - minLng) * PADDING
    const dLat = (maxLat - minLat) * PADDING

    const bMinLat = minLat - dLat
    const bMaxLat = maxLat + dLat

    return {
      minLng: minLng - dLng,
      maxLng: maxLng + dLng,
      minLat: bMinLat,
      maxLat: bMaxLat,
      mercMinY: latToMercY(bMinLat),
      mercMaxY: latToMercY(bMaxLat),
    }
  }, [geojson])

  // Convertir lng/lat → pixel canvas (projection Mercator Y)
  const toPixel = useCallback((lng: number, lat: number): [number, number] => {
    const x = ((lng - globalBounds.minLng) / (globalBounds.maxLng - globalBounds.minLng)) * CANVAS_W
    const mercY = latToMercY(lat)
    const y = ((globalBounds.mercMaxY - mercY) / (globalBounds.mercMaxY - globalBounds.mercMinY)) * CANVAS_H
    return [x, y]
  }, [globalBounds])

  // Charger les tuiles CartoCDN en arrière-plan
  useEffect(() => {
    let cancelled = false
    const { minLng, maxLng, minLat, maxLat } = globalBounds

    const tileMinX = lngToTileX(minLng, TILE_ZOOM)
    const tileMaxX = lngToTileX(maxLng, TILE_ZOOM)
    const tileMinY = latToTileY(maxLat, TILE_ZOOM) // nord = petit Y
    const tileMaxY = latToTileY(minLat, TILE_ZOOM) // sud = grand Y

    const tilePromises: Promise<{ bitmap: ImageBitmap; tx: number; ty: number } | null>[] = []

    for (let tx = tileMinX; tx <= tileMaxX; tx++) {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        const url = `https://a.basemaps.cartocdn.com/light_nolabels/${TILE_ZOOM}/${tx}/${ty}.png`
        tilePromises.push(
          fetch(url)
            .then((r) => r.blob())
            .then((blob) => createImageBitmap(blob))
            .then((bitmap) => ({ bitmap, tx, ty }))
            .catch(() => null),
        )
      }
    }

    Promise.all(tilePromises).then((results) => {
      if (cancelled) return

      const tiles = results.filter(
        (t): t is { bitmap: ImageBitmap; tx: number; ty: number } => t !== null,
      )

      const offscreen = document.createElement('canvas')
      offscreen.width = CANVAS_W
      offscreen.height = CANVAS_H
      const ctx = offscreen.getContext('2d')!

      // Fond parchemin
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Dessiner chaque tuile à sa position (Mercator → canvas)
      for (const { bitmap, tx, ty } of tiles) {
        const nwLng = tileToLng(tx, TILE_ZOOM)
        const nwLat = tileToLat(ty, TILE_ZOOM)
        const seLng = tileToLng(tx + 1, TILE_ZOOM)
        const seLat = tileToLat(ty + 1, TILE_ZOOM)

        const [px1, py1] = toPixel(nwLng, nwLat)
        const [px2, py2] = toPixel(seLng, seLat)

        ctx.drawImage(bitmap, px1, py1, px2 - px1, py2 - py1)
        bitmap.close()
      }

      // Teinte parchemin légère par-dessus
      ctx.globalAlpha = 0.2
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.globalAlpha = 1

      setBgImage(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H))
    })

    return () => { cancelled = true }
  }, [globalBounds, toPixel])

  // Dessiner les points (quand geojson ou background change)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fond : tuiles ou parchemin uni
    if (bgImage) {
      ctx.putImageData(bgImage, 0, 0)
    } else {
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    // Dessiner chaque point
    for (const f of geojson.features) {
      const [lng, lat] = f.geometry.coordinates
      const [x, y] = toPixel(lng, lat)
      const props = f.properties

      ctx.globalAlpha = props.discovered ? 1 : FOG_ALPHA
      ctx.fillStyle = props.claimed ? props.tagColor : UNCLAIMED_COLOR

      ctx.beginPath()
      ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    pointsImageRef.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)
  }, [geojson, toPixel, bgImage])

  // Dessiner le rectangle viewport
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pointsImageRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(pointsImageRef.current, 0, 0)

    const [x1, y1] = toPixel(bounds.west, bounds.north)
    const [x2, y2] = toPixel(bounds.east, bounds.south)

    const rx = Math.max(0, Math.min(x1, x2))
    const ry = Math.max(0, Math.min(y1, y2))
    const rw = Math.min(CANVAS_W, Math.abs(x2 - x1))
    const rh = Math.min(CANVAS_H, Math.abs(y2 - y1))

    ctx.fillStyle = VIEWPORT_FILL
    ctx.fillRect(rx, ry, rw, rh)

    ctx.strokeStyle = VIEWPORT_STROKE
    ctx.lineWidth = 4
    ctx.strokeRect(rx, ry, rw, rh)
  }, [bounds, toPixel])

  // Click → naviguer (Mercator inverse)
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    const lng = globalBounds.minLng + (cx / CANVAS_W) * (globalBounds.maxLng - globalBounds.minLng)
    const mercY = globalBounds.mercMaxY - (cy / CANVAS_H) * (globalBounds.mercMaxY - globalBounds.mercMinY)
    const lat = mercYToLat(mercY)

    onNavigate(lng, lat)
  }, [globalBounds, onNavigate])

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
      />
    </div>
  )
}
