import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'

export interface PlaceDetail {
  id: string
  title: string
  text: string
  address: string
  accessibility: string | null
  sensible: boolean
  geocaching: boolean
  images: Array<{ id: string; url: string }>
  author: {
    id: string
    lastName: string
    profileImageUrl: string | null
  }
  type: { id: string; title: string }
  primaryTag: {
    id: string
    title: string
    color: string
    background: string
  } | null
  tags: Array<{
    id: string
    title: string
    color: string
    background: string
    icon?: string | null
    isPrimary: boolean
  }>
  location: { latitude: number; longitude: number }
  metrics: {
    views: number
    likes: number
    explored: number
    note: number | null
  }
  claim: {
    factionId: string
    factionTitle: string
    factionColor: string
    factionPattern: string | null
    claimedBy: string
    claimedByName: string
    claimedAt: string
    fortificationLevel: number
    zoneFortification: number
  } | null
  requester: {
    bookmarked: boolean
    liked: boolean
    explored: boolean
  } | null
  lastExplorers: Array<{
    id: string
    lastName: string
    profileImageUrl: string | null
  }>
  beginAt: string | null
  endAt: string | null
  createdAt: string | null
}

export function usePlace(placeId: string | null) {
  const [place, setPlace] = useState<PlaceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!placeId) {
      setPlace(null)
      return
    }

    let cancelled = false

    async function fetchPlace() {
      setLoading(true)
      setError(null)

      // Fetch lieu et tag icons en parallèle
      const userId = useFogStore.getState().userId
      const [placeRes, tagsRes] = await Promise.all([
        supabase.rpc('get_place_by_id', { p_id: placeId, p_user_id: userId }),
        supabase.from('tags').select('id, icon').not('icon', 'is', null),
      ])

      if (cancelled) return

      if (placeRes.error) {
        setError(placeRes.error.message)
        setLoading(false)
        return
      }

      if (placeRes.data?.error) {
        setError(placeRes.data.error)
        setLoading(false)
        return
      }

      const placeData = placeRes.data as PlaceDetail

      // Enrichir les tags avec leurs icônes
      if (tagsRes.data && placeData.tags) {
        const iconMap = new Map(tagsRes.data.map(t => [t.id, t.icon]))
        placeData.tags = placeData.tags.map(tag => ({
          ...tag,
          icon: iconMap.get(tag.id) ?? null,
        }))
      }

      setPlace(placeData)
      setLoading(false)

      // Enregistrer la vue
      if (userId) {
        supabase.from('places_viewed').insert({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId,
          place_id: placeId,
        }).then(({ error: viewErr }) => {
          if (viewErr) console.error('places_viewed insert error:', viewErr)
        })
      }
    }

    fetchPlace()
    return () => { cancelled = true }
  }, [placeId])

  return { place, loading, error }
}
