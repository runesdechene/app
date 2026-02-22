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
import { union } from '@turf/union'
import { polygon as turfPolygon, featureCollection } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson'

// --- Constantes ---

const BASE_RADIUS_KM = 0.25      // rayon minimum pour tout lieu (~150m)
const RADIUS_SCALE_KM = 0.65     // croissance douce par sqrt(likes)
const KM_PER_DEG_LAT = 111
const KM_PER_DEG_LON = 79        // approximation à ~45° latitude
const CIRCLE_SEGMENTS = 12        // octogone
const VORONOI_PAD_DEG = 2
const UNION_EPSILON = 0.00003  // ~3m — comble les micro-gaps floating-point pour l'union

// --- Types ---

interface PlaceInput {
  coordinates: [number, number]
  faction: string
  factionTitle: string
  tagColor: string
  factionPattern: string
  score: number
  claimedByName: string
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

/** Dilate légèrement un anneau convexe depuis son centroïde (comble les micro-gaps pour union) */
function expandRing(ring: Position[]): Position[] {
  const n = ring.length - 1 // exclure le point de fermeture
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1] }
  cx /= n; cy /= n

  return ring.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 1e-12) return [x, y]
    return [x + (dx / d) * UNION_EPSILON, y + (dy / d) * UNION_EPSILON]
  })
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

/** Point-in-polygon (ray casting) — teste si [x,y] est à l'intérieur d'un anneau fermé */
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
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
  //    Grouper par faction (nom) pour fusion visuelle
  const factionRings = new Map<string, { polygons: Position[][][], totalScore: number, count: number, color: string, pattern: string, title: string, players: Set<string>, centroidSum: [number, number], placeCoords: [number, number][] }>()

  for (let i = 0; i < features.length; i++) {
    const place = features[i]
    const rKm = radiusForScore(place.score)
    if (rKm <= 0) continue

    const cellCoords = voronoi.cellPolygon(i)
    if (!cellCoords) continue

    const circleCoords = makeCircle(place.coordinates, rKm)
    const clipped = clipToConvex(circleCoords, cellCoords as unknown as Position[])

    if (clipped) {
      const key = place.faction
      if (!factionRings.has(key)) {
        factionRings.set(key, { polygons: [], totalScore: 0, count: 0, color: place.tagColor, pattern: place.factionPattern, title: place.factionTitle, players: new Set(), centroidSum: [0, 0], placeCoords: [] })
      }
      const group = factionRings.get(key)!
      group.polygons.push([clipped])  // chaque polygon = [ring]
      group.totalScore += place.score
      group.count++
      if (place.claimedByName) group.players.add(place.claimedByName)
      group.placeCoords.push(place.coordinates)
      group.centroidSum[0] += place.coordinates[0]
      group.centroidSum[1] += place.coordinates[1]
    }
  }

  // 3. Union géométrique par faction → contour extérieur uniquement
  const territories: Feature<Polygon | MultiPolygon>[] = []
  let id = 0

  for (const [factionId, group] of factionRings) {
    let geometry: Polygon | MultiPolygon

    if (group.polygons.length === 1) {
      geometry = { type: 'Polygon', coordinates: group.polygons[0] }
    } else {
      try {
        const polys = group.polygons.map(coords => turfPolygon([expandRing(coords[0])]))
        const merged = union(featureCollection(polys))
        if (!merged) continue
        geometry = merged.geometry
      } catch {
        // Fallback : MultiPolygon brut si union échoue
        geometry = { type: 'MultiPolygon', coordinates: group.polygons }
      }
    }

    const baseProps = {
      tagColor: group.color,
      pattern: group.pattern,
      score: group.totalScore,
      faction: factionId,
      factionTitle: group.title,
      players: Array.from(group.players).join(', '),
    }

    const smoothed = geometry  // pas de lissage → contours angulaires

    // Éclater les MultiPolygon en features séparées (chaque blob = son propre ID)
    // et compter les lieux dans chaque blob via point-in-polygon
    if (smoothed.type === 'MultiPolygon') {
      for (const polyCoords of smoothed.coordinates) {
        const outerRing = polyCoords[0]
        let blobCount = 0
        for (const [px, py] of group.placeCoords) {
          if (pointInRing(px, py, outerRing)) blobCount++
        }
        territories.push({
          type: 'Feature',
          id: id++,
          geometry: { type: 'Polygon', coordinates: polyCoords },
          properties: { ...baseProps, placesCount: blobCount },
        })
      }
    } else {
      territories.push({
        type: 'Feature',
        id: id++,
        geometry: smoothed,
        properties: { ...baseProps, placesCount: group.count },
      })
    }
  }

  self.postMessage({ type: 'FeatureCollection', partial: false, features: territories })
}
