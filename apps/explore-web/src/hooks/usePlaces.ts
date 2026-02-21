import { useEffect, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { supabase } from '../lib/supabase'

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
  location: {
    latitude: number
    longitude: number
  }
  likes: number
  score: number
}

export interface PlaceProperties {
  id: string
  title: string
  tagTitle: string
  tagColor: string
  tagBackground: string
  tagIcon: string
  factionId: string
  factionPattern: string
  claimed: boolean
  likes: number
  score: number
}

export type PlacesGeoJSON = FeatureCollection<Point, PlaceProperties>

export function usePlaces() {
  const [geojson, setGeojson] = useState<PlacesGeoJSON | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlaces() {
      setLoading(true)
      setError(null)

      // Fetch places et tag icons en parallèle
      const [placesRes, tagsRes] = await Promise.all([
        supabase.rpc('get_map_places', { p_type: 'all', p_limit: 5000 }),
        supabase.from('tags').select('id, icon').not('icon', 'is', null),
      ])

      if (placesRes.error) {
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
              tagBackground: place.primaryTag?.background ?? '#F5E6D3',
              tagIcon: (place.primaryTag?.id ? tagIcons.get(place.primaryTag.id) : undefined) ?? '',
              factionId: place.faction?.id ?? '',
              factionPattern: place.faction?.pattern ?? '',
              claimed: !!place.faction,
              likes: place.likes ?? 0,
              score: place.score ?? 0,
            },
          })),
      }

      setGeojson(fc)
      setLoading(false)
    }

    fetchPlaces()
  }, [])

  return { geojson, loading, error }
}
