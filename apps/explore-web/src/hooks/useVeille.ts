import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PlaceVeille, NearbyPlanter, PlantFlagResult } from '../types/veille'

export function useVeille(placeId: string) {
  const [veille, setVeille] = useState<PlaceVeille | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_place_veille', { p_place_id: placeId })
    setLoading(false)
    if (error) {
      console.error('get_place_veille error:', error.message, error.details, error.hint)
      return
    }
    setVeille(data as PlaceVeille)
  }, [placeId])

  const fetchNearby = useCallback(async (userId: string): Promise<NearbyPlanter[]> => {
    const { data, error } = await supabase.rpc('get_nearby_planters', {
      p_user_id: userId,
      p_place_id: placeId,
    })
    if (error) {
      console.error('get_nearby_planters error:', error.message)
      return []
    }
    return ((data as { candidates?: NearbyPlanter[] })?.candidates) ?? []
  }, [placeId])

  const plant = useCallback(async (
    userId: string,
    lat: number,
    lng: number,
    partnersIds: string[],
  ): Promise<PlantFlagResult> => {
    const { data, error } = await supabase.rpc('plant_flag', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: lat,
      p_user_lng: lng,
      p_partners_user_ids: partnersIds,
    })
    if (error) {
      console.error('plant_flag error:', error.message, error.details, error.hint)
      return { error: 'unauthorized' }
    }
    return data as PlantFlagResult
  }, [placeId])

  return { veille, loading, refresh, fetchNearby, plant }
}
