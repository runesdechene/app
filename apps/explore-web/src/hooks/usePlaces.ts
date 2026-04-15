import { useEffect, useState, useMemo } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useMapStore } from '../stores/mapStore'
import { useAuth } from './useAuth'

interface MapPlace {
  id: string
  title: string
  type: {
    id: string
    title: string
  }
  primaryTag: {
    id: string
    title: string
    color: string
    background: string
  } | null
  faction: {
    id: string
    title: string
    color: string
    pattern: string | null
  } | null
  claimedByName: string | null
  claimedById: string | null
  fortificationLevel: number
  location: {
    latitude: number
    longitude: number
  }
  likes: number
  score: number
  totalInfluence: number
  influenceByFaction: Record<string, number>
}

export interface PlaceProperties {
  id: string
  title: string
  tagTitle: string
  tagColor: string
  /** Couleur du tag primaire (jamais ecrasee par la faction) — pour les icones */
  iconColor: string
  tagBackground: string
  tagIcon: string
  factionId: string
  factionColor: string
  dominantFactionColor: string
  /** Clé d'icône en mode bannières = faction:{tagIcon}::{factionColor} */
  bannerIcon: string
  factionPattern: string
  claimedByName: string
  claimedById: string
  claimed: boolean
  fortificationLevel: number
  likes: number
  score: number
  discovered: boolean
  ownFaction: boolean
  totalInfluence: number
  influenceByFaction: Record<string, number>
}

export type PlacesGeoJSON = FeatureCollection<Point, PlaceProperties>

export function usePlaces() {
  const [rawGeojson, setRawGeojson] = useState<PlacesGeoJSON | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const discoveredIds = usePlayerStore(s => s.discoveredIds)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const fogLoading = usePlayerStore(s => s.loading)
  const deletedPlaceIds = useMapStore(s => s.deletedPlaceIds)
  const placesRefreshKey = useMapStore(s => s.placesRefreshKey)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    async function fetchPlaces() {
      setLoading(true)
      setError(null)

      let placesRes, tagsRes, factionsRes
      try {
        // Fetch places, tag icons et couleurs factions en parallèle
        ;[placesRes, tagsRes, factionsRes] = await Promise.all([
          supabase.rpc('get_map_places', { p_type: 'all', p_limit: 5000 }),
          supabase.from('tags').select('id, icon').not('icon', 'is', null),
          supabase.from('factions').select('id, color'),
        ])
      } catch (err) {
        console.error('[usePlaces] fetch threw', err)
        setError(err instanceof Error ? err.message : 'Erreur réseau lors du chargement de la carte')
        setLoading(false)
        return
      }

      if (placesRes.error) {
        console.error('[usePlaces] get_map_places error', placesRes.error)
        setError(placesRes.error.message)
        setLoading(false)
        return
      }

      const places: MapPlace[] = Array.isArray(placesRes.data) ? placesRes.data : []

      // Map tag id → icon emoji
      const tagIcons = new Map<string, string>()
      if (tagsRes.data) {
        for (const t of tagsRes.data) {
          if (t.icon) tagIcons.set(t.id, t.icon)
        }
      }

      // Map faction id → color
      const factionColorMap = new Map<string, string>()
      if (factionsRes.data) {
        for (const f of factionsRes.data) {
          factionColorMap.set(f.id, f.color)
        }
      }

      const fc: PlacesGeoJSON = {
        type: 'FeatureCollection',
        features: places
          .filter(p => p.location?.latitude && p.location?.longitude)
          .map(place => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [place.location.longitude, place.location.latitude],
            },
            properties: {
              id: place.id,
              title: place.title,
              tagTitle: place.faction?.title ?? place.primaryTag?.title ?? '',
              tagColor: place.faction?.color ?? place.primaryTag?.color ?? '#C19A6B',
              iconColor: place.primaryTag?.color ?? '#C19A6B',
              tagBackground: place.primaryTag?.background ?? '#F5E6D3',
              tagIcon: (place.primaryTag?.id ? tagIcons.get(place.primaryTag.id) : undefined) ?? '',
              factionId: place.faction?.id ?? '',
              factionColor: place.faction?.color ?? '',
              dominantFactionColor: (() => {
                const inf = place.influenceByFaction ?? {}
                let maxId = ''
                let maxPts = 0
                for (const [fid, pts] of Object.entries(inf)) {
                  if (pts > maxPts) { maxPts = pts; maxId = fid }
                }
                // Gris si aucun point ou si égalité parfaite entre toutes les factions
                if (maxPts === 0) return ''
                const vals = Object.values(inf)
                if (vals.length > 1 && vals.every(v => v === maxPts)) return ''
                return factionColorMap.get(maxId) ?? ''
              })(),
              bannerIcon: (() => {
                const icon = (place.primaryTag?.id ? tagIcons.get(place.primaryTag.id) : undefined) ?? ''
                if (!icon) return ''
                const inf = place.influenceByFaction ?? {}
                let maxId = ''
                let maxPts = 0
                for (const [fid, pts] of Object.entries(inf)) {
                  if (pts > maxPts) { maxPts = pts; maxId = fid }
                }
                let fc = ''
                if (maxPts > 0) {
                  const vals = Object.values(inf)
                  if (!(vals.length > 1 && vals.every(v => v === maxPts))) {
                    fc = factionColorMap.get(maxId) ?? ''
                  }
                }
                return `faction::${icon}::${fc || '#8A8A8A'}`
              })(),
              factionPattern: place.faction?.pattern ?? '',
              claimedByName: place.claimedByName ?? '',
              claimedById: place.claimedById ?? '',
              claimed: !!place.faction || (place.totalInfluence ?? 0) > 0,
              fortificationLevel: place.fortificationLevel ?? 0,
              likes: place.likes ?? 0,
              score: place.score ?? 0,
              totalInfluence: place.totalInfluence ?? 0,
              influenceByFaction: place.influenceByFaction ?? {},
              discovered: false, // sera enrichi par le useMemo
              ownFaction: false, // sera enrichi par le useMemo
            },
          })),
      }

      setRawGeojson(fc)
      setLoading(false)
    }

    fetchPlaces()
  }, [placesRefreshKey])

  // Enrichir le GeoJSON avec l'état discovered + ownFaction (re-calcule quand fog change)
  const geojson = useMemo(() => {
    if (!rawGeojson) return null

    return {
      ...rawGeojson,
      features: rawGeojson.features
        .filter(f => !deletedPlaceIds.has(f.properties.id))
        .map(f => {
          const personallyDiscovered = isAuthenticated && discoveredIds.has(f.properties.id)
          const isOwnFaction = isAuthenticated
            && userFactionId !== null
            && f.properties.factionId === userFactionId
            && !personallyDiscovered

          return {
            ...f,
            properties: {
              ...f.properties,
              discovered: personallyDiscovered,
              ownFaction: isOwnFaction,
            },
          }
        }),
    }
  }, [rawGeojson, discoveredIds, userFactionId, isAuthenticated, deletedPlaceIds])

  return { geojson, rawGeojson, loading: loading || fogLoading, error }
}
