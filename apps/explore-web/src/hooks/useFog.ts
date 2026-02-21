import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'
import { useAuth } from './useAuth'

const GPS_PROXIMITY_M = 500

/** Distance haversine en mètres */
function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useFog() {
  const { user, isAuthenticated } = useAuth()

  const setDiscoveredIds = useFogStore(s => s.setDiscoveredIds)
  const addDiscoveredId = useFogStore(s => s.addDiscoveredId)
  const setUserFactionId = useFogStore(s => s.setUserFactionId)
  const setUserId = useFogStore(s => s.setUserId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const setLoading = useFogStore(s => s.setLoading)
  const setUserAvatarUrl = useFogStore(s => s.setUserAvatarUrl)

  // Init : charger les découvertes + énergie + faction à l'authentification
  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
      setUserFactionId(null)
      setUserId(null)
      setUserAvatarUrl(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      setLoading(true)

      // Récupérer l'ID interne de l'utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('id, faction_id')
        .eq('email_address', user!.email)
        .single()

      if (cancelled || !userData) {
        setLoading(false)
        return
      }

      setUserId(userData.id)
      setUserFactionId(userData.faction_id)

      // Fetch découvertes + énergie + profil en parallèle
      const [discRes, energyRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_discoveries', { p_user_id: userData.id }),
        supabase.rpc('get_user_energy', { p_user_id: userData.id }),
        supabase.rpc('get_my_informations', { p_user_id: userData.id }),
      ])

      if (cancelled) return

      if (discRes.data) {
        setDiscoveredIds(discRes.data as string[])
      }
      if (energyRes.data) {
        setEnergy((energyRes.data as { energy: number }).energy)
      }
      if (profileRes.data) {
        const profile = profileRes.data as { profileImage?: { url: string } | null }
        setUserAvatarUrl(profile.profileImage?.url ?? null)
      }

      setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.email])

  // Découvrir un lieu
  const discover = useCallback(async (
    placeId: string,
    placeLat: number,
    placeLng: number,
  ): Promise<{ success: boolean; error?: string }> => {
    const userId = useFogStore.getState().userId
    if (!userId) return { success: false, error: 'Not authenticated' }

    // Déterminer la méthode (GPS ou remote) basé sur la distance
    let method = 'remote'
    const pos = useFogStore.getState().userPosition
    if (pos) {
      const dist = haversineM(pos.lat, pos.lng, placeLat, placeLng)
      if (dist <= GPS_PROXIMITY_M) {
        method = 'gps'
      }
    }

    const { data } = await supabase.rpc('discover_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_method: method,
    })

    if (data?.error) {
      return { success: false, error: data.error }
    }

    // Update optimiste
    addDiscoveredId(placeId)
    if (data?.energy !== undefined) {
      setEnergy(data.energy)
    }

    return { success: true }
  }, [])

  return { discover }
}
