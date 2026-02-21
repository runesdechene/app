/**
 * Web Worker : calcul des territoires (Voronoi + cercles clippés)
 *
 * Algorithme :
 * 1. Voronoi : chaque lieu reçoit sa cellule naturelle (zone la plus proche)
 * 2. Cercle : rayon = f(likes) → portée d'influence du lieu
 * 3. Clip : Sutherland-Hodgman (cercle ∩ cellule Voronoi convexe)
 *    → ~50ms pour 2400 lieux (vs 5s+ avec turf/intersect)
 *    → Chaque lieu a TOUJOURS un territoire (garanti par Voronoi)
 *    → Zéro superposition (garanti par Voronoi)
 */
import { Delaunay } from 'd3-delaunay'
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson'

// --- Constantes ---

const BASE_RADIUS_KM = 0.15      // rayon minimum pour tout lieu (~150m)
const RADIUS_SCALE_KM = 0.45     // croissance douce par sqrt(likes)
const KM_PER_DEG_LAT = 111
const KM_PER_DEG_LON = 79        // approximation à ~45° latitude
const CIRCLE_SEGMENTS = 32       // réduit (perf), cercle reste lisse
const VORONOI_PAD_DEG = 2

// --- Types ---

interface PlaceInput {
  coordinates: [number, number]
  faction: string
  tagColor: string
  score: number
}

interface WorkerMessage {
  features: PlaceInput[]
}

// --- Helpers ---

/** Rayon du cercle d'influence en km — 0 score = pas de zone */
function radiusForScore(score: number): number {
  if (score <= 0) return 0
  if (score <= 1) return BASE_RADIUS_KM
  return BASE_RADIUS_KM + Math.sqrt(score - 1) * RADIUS_SCALE_KM
}

/** Génère un polygone circulaire fermé [lon, lat][] */
function makeCircle(center: [number, number], radiusKm: number): Position[] {
  const [lon, lat] = center
  const coords: Position[] = []
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS
    const dx = (radiusKm * Math.cos(angle)) / KM_PER_DEG_LON
    const dy = (radiusKm * Math.sin(angle)) / KM_PER_DEG_LAT
    coords.push([lon + dx, lat + dy])
  }
  return coords
}

// --- Sutherland-Hodgman : clip polygon to convex cell ---

/** Détermine si un point est du côté intérieur d'une arête */
function isInside(p: Position, edgeA: Position, edgeB: Position): boolean {
  return (edgeB[0] - edgeA[0]) * (p[1] - edgeA[1]) -
         (edgeB[1] - edgeA[1]) * (p[0] - edgeA[0]) >= 0
}

/** Intersection entre le segment [p1,p2] et la droite passant par [edgeA,edgeB] */
function lineIntersect(p1: Position, p2: Position, eA: Position, eB: Position): Position {
  const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1]
  const x3 = eA[0], y3 = eA[1], x4 = eB[0], y4 = eB[1]
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-12) return p1 // parallèles, fallback
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
}

/** Clip un polygone (sujet) par un polygone convexe (clip). Retourne un anneau fermé. */
function clipToConvex(subject: Position[], clip: Position[]): Position[] | null {
  let output = subject.slice(0, -1) // retirer le point de fermeture
  const clipLen = clip.length - 1    // dernier point = premier

  for (let i = 0; i < clipLen; i++) {
    if (output.length === 0) return null
    const input = output
    output = []
    const eA = clip[i]
    const eB = clip[i + 1]

    for (let j = 0; j < input.length; j++) {
      const curr = input[j]
      const prev = input[(j + input.length - 1) % input.length]
      const currIn = isInside(curr, eA, eB)
      const prevIn = isInside(prev, eA, eB)

      if (currIn) {
        if (!prevIn) output.push(lineIntersect(prev, curr, eA, eB))
        output.push(curr)
      } else if (prevIn) {
        output.push(lineIntersect(prev, curr, eA, eB))
      }
    }
  }

  if (output.length < 3) return null
  output.push(output[0]) // fermer l'anneau
  return output
}

// --- Main ---

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { features } = e.data

  if (features.length === 0) {
    self.postMessage({ type: 'FeatureCollection', partial: false, features: [] })
    return
  }

  // 1. Voronoi
  const points: [number, number][] = features.map(p => p.coordinates)
  const delaunay = Delaunay.from(points)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const voronoi = delaunay.voronoi([
    minX - VORONOI_PAD_DEG, minY - VORONOI_PAD_DEG,
    maxX + VORONOI_PAD_DEG, maxY + VORONOI_PAD_DEG,
  ])

  // 2. Per-place: clip circle to Voronoi cell (Sutherland-Hodgman)
  const territories: Feature<Polygon | MultiPolygon>[] = []

  for (let i = 0; i < features.length; i++) {
    const place = features[i]
    const rKm = radiusForScore(place.score)

    const cellCoords = voronoi.cellPolygon(i)
    if (!cellCoords) continue

    const circleCoords = makeCircle(place.coordinates, rKm)
    const clipped = clipToConvex(circleCoords, cellCoords as unknown as Position[])

    if (clipped) {
      territories.push({
        type: 'Feature',
        id: i,
        geometry: { type: 'Polygon', coordinates: [clipped] },
        properties: {
          tagColor: place.tagColor,
          score: place.score,
        },
      })
    }
  }

  self.postMessage({ type: 'FeatureCollection', partial: false, features: territories })
}
