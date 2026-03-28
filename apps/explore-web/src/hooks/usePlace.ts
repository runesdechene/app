import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

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
    gauge: 'energy' | 'conquest' | 'construction' | 'vitalite'
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
    claimedByAvatar: string | null
    claimedAt: string
    fortificationLevel: number
    zoneFortification: number
    zoneNeighborCount: number
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
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = () => setRefreshKey(k => k + 1)

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
      const userId = usePlayerStore.getState().userId
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

      // Enrichir le primaryTag avec la gauge
      if (placeData.primaryTag) {
        const { data: gaugeData } = await supabase.rpc('get_place_gauge', { p_place_id: placeId })
        placeData.primaryTag.gauge = (gaugeData as string ?? 'energy') as 'energy' | 'conquest' | 'construction' | 'vitalite'
      }

      // Enrichir les tags avec leurs icônes
      if (tagsRes.data && placeData.tags) {
        const iconMap = new Map(tagsRes.data.map(t => [t.id, t.icon]))
        placeData.tags = placeData.tags.map(tag => ({
          ...tag,
          icon: iconMap.get(tag.id) ?? null,
        }))
      }

      // Enrichir le claim avec l'avatar du protecteur
      if (placeData.claim?.claimedBy) {
        const { data: avatarData } = await supabase.rpc('get_user_avatar', { p_user_id: placeData.claim.claimedBy })
        placeData.claim.claimedByAvatar = (avatarData as string) ?? null
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
        }).then(() => {})
      }
    }

    fetchPlace()
    return () => { cancelled = true }
  }, [placeId, refreshKey])

  return { place, loading, error, refetch }
}
