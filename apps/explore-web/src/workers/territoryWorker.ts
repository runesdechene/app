/**
 * Web Worker : calcul des territoires (Voronoï pondéré par grille)
 *
 * Algorithme :
 * 1. Chaque lieu a une force = max(1, likes) + coalition_bonus
 * 2. Chaque lieu peint une influence décroissante (linéaire) sur une grille
 * 3. Pour chaque cellule, les influences s'additionnent par faction
 * 4. La cellule appartient à la faction avec la plus forte influence totale
 * 5. Zéro superposition par construction (chaque cellule a un seul gagnant)
 * 6. Les cellules sont converties en bandes horizontales fusionnées verticalement,
 *    puis union par faction, puis lissage (simplify + Chaikin)
 *
 * Stratégie local-first :
 * - Phase 1 : lieux < 150km du centre → résultat partiel rapide
 * - Phase 2 : tous les lieux → résultat final complet
 */
import { polygon, featureCollection } from '@turf/helpers'
import union from '@turf/union'
import simplify from '@turf/simplify'
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson'

// --- Constantes ---

const INFLUENCE_BASE_KM = 1
const INFLUENCE_PER_LIKE = 0.3
const INFLUENCE_MAX_KM = 50
const COALITION_BONUS = 1
const LOCAL_RADIUS_KM = 150
const GRID_STEP_DEG = 0.004       // ~450m de résolution
const SIMPLIFY_TOL = 0.002
const CHAIKIN_ITERS = 2
const KM_PER_DEG_LAT = 111
const KM_PER_DEG_LON = 79

// --- Types ---

interface PlaceInput {
  coordinates: [number, number]
  faction: string
  tagColor: string
  likes: number
}

interface WorkerMessage {
  features: PlaceInput[]
  center: [number, number]
}

interface PlaceForce {
  coordinates: [number, number]
  faction: string
  tagColor: string
  likes: number
  radiusKm: number
  effectiveForce: number
}

// --- Helpers ---

function progress(phase: string, pct: number) {
  self.postMessage({ type: 'progress', phase, percent: Math.round(pct) })
}

function radiusForLikes(likes: number): number {
  return Math.min(INFLUENCE_BASE_KM + Math.max(1, likes) * INFLUENCE_PER_LIKE, INFLUENCE_MAX_KM)
}

function roughDistKm(a: [number, number], b: [number, number]): number {
  const dx = (b[0] - a[0]) * KM_PER_DEG_LON
  const dy = (b[1] - a[1]) * KM_PER_DEG_LAT
  return Math.sqrt(dx * dx + dy * dy)
}

// --- Étape 1 : forces + coalition ---

function computeForces(inputs: PlaceInput[]): PlaceForce[] {
  const places: PlaceForce[] = inputs.map(f => ({
    coordinates: f.coordinates,
    faction: f.faction,
    tagColor: f.tagColor,
    likes: f.likes,
    radiusKm: radiusForLikes(f.likes),
    effectiveForce: Math.max(1, f.likes),
  }))

  for (let i = 0; i < places.length; i++) {
    let allies = 0
    for (let j = 0; j < places.length; j++) {
      if (i === j || places[i].faction !== places[j].faction) continue
      if (roughDistKm(places[i].coordinates, places[j].coordinates) <= places[i].radiusKm + places[j].radiusKm) {
        allies++
      }
    }
    places[i].effectiveForce += allies * COALITION_BONUS
  }

  return places
}

// --- Étape 2 : grille d'influence + résolution ---

interface GridResult {
  winners: Map<number, Map<number, string>>
  minLon: number
  minLat: number
  factionColors: Map<string, string>
  factionLikes: Map<string, number>
}

function computeGrid(places: PlaceForce[]): GridResult {
  // Bbox englobante (avec padding = rayon max de chaque lieu)
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const p of places) {
    const padLon = p.radiusKm / KM_PER_DEG_LON
    const padLat = p.radiusKm / KM_PER_DEG_LAT
    if (p.coordinates[0] - padLon < minLon) minLon = p.coordinates[0] - padLon
    if (p.coordinates[0] + padLon > maxLon) maxLon = p.coordinates[0] + padLon
    if (p.coordinates[1] - padLat < minLat) minLat = p.coordinates[1] - padLat
    if (p.coordinates[1] + padLat > maxLat) maxLat = p.coordinates[1] + padLat
  }

  // Métadonnées par faction
  const factionColors = new Map<string, string>()
  const factionLikes = new Map<string, number>()
  for (const p of places) {
    if (!factionColors.has(p.faction)) factionColors.set(p.faction, p.tagColor)
    factionLikes.set(p.faction, (factionLikes.get(p.faction) || 0) + p.likes)
  }

  // Grille sparse : row → col → Map<faction, influence>
  const grid = new Map<number, Map<number, Map<string, number>>>()

  for (const p of places) {
    const cellRLat = Math.ceil(p.radiusKm / KM_PER_DEG_LAT / GRID_STEP_DEG)
    const cellRLon = Math.ceil(p.radiusKm / KM_PER_DEG_LON / GRID_STEP_DEG)
    const cCol = Math.round((p.coordinates[0] - minLon) / GRID_STEP_DEG)
    const cRow = Math.round((p.coordinates[1] - minLat) / GRID_STEP_DEG)

    for (let dr = -cellRLat; dr <= cellRLat; dr++) {
      const row = cRow + dr
      for (let dc = -cellRLon; dc <= cellRLon; dc++) {
        const col = cCol + dc
        const lon = minLon + col * GRID_STEP_DEG
        const lat = minLat + row * GRID_STEP_DEG
        const dist = roughDistKm(p.coordinates, [lon, lat])
        if (dist >= p.radiusKm) continue

        const influence = ((p.radiusKm - dist) / p.radiusKm) * p.effectiveForce

        if (!grid.has(row)) grid.set(row, new Map())
        const rm = grid.get(row)!
        if (!rm.has(col)) rm.set(col, new Map())
        const cm = rm.get(col)!
        cm.set(p.faction, (cm.get(p.faction) || 0) + influence)
      }
    }
  }

  // Résoudre : chaque cellule → faction gagnante
  const winners = new Map<number, Map<number, string>>()
  for (const [row, cols] of grid) {
    const rw = new Map<number, string>()
    for (const [col, factions] of cols) {
      let best = '', bestV = 0
      for (const [f, v] of factions) {
        if (v > bestV) { bestV = v; best = f }
      }
      if (best) rw.set(col, best)
    }
    if (rw.size > 0) winners.set(row, rw)
  }

  return { winners, minLon, minLat, factionColors, factionLikes }
}

// --- Étape 3 : grille → polygones ---

interface RawStrip { row: number; c1: number; c2: number }
interface Block { r1: number; r2: number; c1: number; c2: number }

/** Fusionne verticalement les bandes adjacentes de même largeur */
function mergeVertically(strips: RawStrip[]): Block[] {
  strips.sort((a, b) => a.c1 - b.c1 || a.c2 - b.c2 || a.row - b.row)
  const blocks: Block[] = []
  let i = 0
  while (i < strips.length) {
    const s = strips[i]
    let r2 = s.row
    i++
    while (
      i < strips.length &&
      strips[i].c1 === s.c1 &&
      strips[i].c2 === s.c2 &&
      strips[i].row === r2 + 1
    ) {
      r2 = strips[i].row
      i++
    }
    blocks.push({ r1: s.row, r2, c1: s.c1, c2: s.c2 })
  }
  return blocks
}

function gridToTerritories(result: GridResult): Feature<Polygon | MultiPolygon>[] {
  const { winners, minLon, minLat, factionColors, factionLikes } = result
  const half = GRID_STEP_DEG / 2

  // Grouper les cellules par faction
  const factionStrips = new Map<string, RawStrip[]>()
  const sortedRows = [...winners.keys()].sort((a, b) => a - b)

  for (const row of sortedRows) {
    const cols = winners.get(row)!
    const sortedCols = [...cols.keys()].sort((a, b) => a - b)

    let i = 0
    while (i < sortedCols.length) {
      const faction = cols.get(sortedCols[i])!
      const c1 = sortedCols[i]
      let c2 = c1
      i++
      while (i < sortedCols.length && cols.get(sortedCols[i]) === faction && sortedCols[i] === c2 + 1) {
        c2 = sortedCols[i]
        i++
      }
      if (!factionStrips.has(faction)) factionStrips.set(faction, [])
      factionStrips.get(faction)!.push({ row, c1, c2 })
    }
  }

  // Pour chaque faction : fusionner verticalement → rectangles → union → lissage
  const territories: Feature<Polygon | MultiPolygon>[] = []

  for (const [faction, strips] of factionStrips) {
    const blocks = mergeVertically(strips)
    if (blocks.length === 0) continue

    const polys: Feature<Polygon>[] = blocks.map(b => {
      const x1 = minLon + b.c1 * GRID_STEP_DEG - half
      const x2 = minLon + b.c2 * GRID_STEP_DEG + half
      const y1 = minLat + b.r1 * GRID_STEP_DEG - half
      const y2 = minLat + b.r2 * GRID_STEP_DEG + half
      return polygon([[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]])
    })

    let merged = mergeBinary(polys)
    if (!merged) continue

    merged = smoothTerritory(merged)
    merged.properties = {
      tagColor: factionColors.get(faction) ?? '#C19A6B',
      totalLikes: factionLikes.get(faction) ?? 0,
    }
    territories.push(merged)
  }

  territories.sort((a, b) => (a.properties!.totalLikes as number) - (b.properties!.totalLikes as number))
  return territories
}

// --- Lissage ---

function chaikinRing(ring: Position[], iterations: number): Position[] {
  let coords = ring
  for (let iter = 0; iter < iterations; iter++) {
    const next: Position[] = []
    const len = coords.length - 1
    for (let i = 0; i < len; i++) {
      const p1 = coords[i]
      const p2 = coords[(i + 1) % len]
      next.push([0.75 * p1[0] + 0.25 * p2[0], 0.75 * p1[1] + 0.25 * p2[1]])
      next.push([0.25 * p1[0] + 0.75 * p2[0], 0.25 * p1[1] + 0.75 * p2[1]])
    }
    next.push(next[0])
    coords = next
  }
  return coords
}

function smoothTerritory(feat: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  const s = simplify(feat, { tolerance: SIMPLIFY_TOL, highQuality: true })
  const g = s.geometry
  if (g.type === 'Polygon') {
    g.coordinates = g.coordinates.map(r => chaikinRing(r, CHAIKIN_ITERS))
  } else {
    g.coordinates = g.coordinates.map(p => p.map(r => chaikinRing(r, CHAIKIN_ITERS)))
  }
  return s as Feature<Polygon | MultiPolygon>
}

// --- Union binaire ---

function mergeBinary(
  polys: Feature<Polygon | MultiPolygon>[],
): Feature<Polygon | MultiPolygon> | null {
  if (polys.length === 0) return null
  if (polys.length === 1) return polys[0]

  const next: Feature<Polygon | MultiPolygon>[] = []
  for (let i = 0; i < polys.length; i += 2) {
    if (i + 1 < polys.length) {
      try {
        const u = union(featureCollection([polys[i], polys[i + 1]]))
        next.push(u ? (u as Feature<Polygon | MultiPolygon>) : polys[i])
      } catch {
        next.push(polys[i])
      }
    } else {
      next.push(polys[i])
    }
  }

  return mergeBinary(next)
}

// --- Main ---

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { features, center } = e.data

  progress('Tri des zones', 0)

  const local: PlaceInput[] = []
  const distant: PlaceInput[] = []
  for (const f of features) {
    if (roughDistKm(center, f.coordinates) <= LOCAL_RADIUS_KM) {
      local.push(f)
    } else {
      distant.push(f)
    }
  }

  // --- Phase 1 : locale ---
  progress('Forces locales', 5)
  const localPlaces = computeForces(local)

  progress('Grille locale', 15)
  const localGrid = computeGrid(localPlaces)

  progress('Territoires locaux', 40)
  const localTerr = gridToTerritories(localGrid)

  self.postMessage({ type: 'FeatureCollection', partial: true, features: localTerr })

  // --- Phase 2 : globale ---
  if (distant.length === 0) {
    self.postMessage({ type: 'FeatureCollection', partial: false, features: localTerr })
    return
  }

  progress('Forces globales', 50)
  const allPlaces = computeForces(features)

  progress('Grille globale', 60)
  const allGrid = computeGrid(allPlaces)

  progress('Territoires finaux', 85)
  const finalTerr = gridToTerritories(allGrid)

  self.postMessage({ type: 'FeatureCollection', partial: false, features: finalTerr })
}
