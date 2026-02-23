import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'
import { useToastStore } from '../stores/toastStore'
import type { GameToast } from '../stores/toastStore'
import { useAuth } from './useAuth'
import type { RealtimeChannel } from '@supabase/supabase-js'

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

/**
 * Hook d'initialisation du fog — à appeler UNE SEULE FOIS au niveau App.
 * Charge les découvertes, énergie, faction et avatar à l'authentification.
 */
export function useFog() {
  const { user, isAuthenticated } = useAuth()
  const activityChannelRef = useRef<RealtimeChannel | null>(null)

  const setDiscoveredIds = useFogStore(s => s.setDiscoveredIds)
  const setUserFactionId = useFogStore(s => s.setUserFactionId)
  const setUserId = useFogStore(s => s.setUserId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const setRegenInfo = useFogStore(s => s.setRegenInfo)
  const setLoading = useFogStore(s => s.setLoading)
  const setUserAvatarUrl = useFogStore(s => s.setUserAvatarUrl)
  const setUserFactionColor = useFogStore(s => s.setUserFactionColor)
  const setUserFactionPattern = useFogStore(s => s.setUserFactionPattern)
  const setUserName = useFogStore(s => s.setUserName)
  const setIsAdmin = useFogStore(s => s.setIsAdmin)

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
      setUserFactionId(null)
      setUserFactionColor(null)
      setUserFactionPattern(null)
      setUserId(null)
      setUserName(null)
      setUserAvatarUrl(null)
      setIsAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      setLoading(true)

      const { data: userData } = await supabase
        .from('users')
        .select('id, faction_id, first_name, email_address')
        .eq('email_address', user!.email)
        .single()

      if (cancelled || !userData) {
        setLoading(false)
        return
      }

      setUserId(userData.id)
      setUserFactionId(userData.faction_id)
      setUserName(userData.first_name || userData.email_address || 'Anonyme')

      // Récupérer la couleur de la faction
      if (userData.faction_id) {
        supabase
          .from('factions')
          .select('color, pattern')
          .eq('id', userData.faction_id)
          .single()
          .then(({ data: factionData }) => {
            if (!cancelled && factionData) {
              if (factionData.color) setUserFactionColor(factionData.color)
              if (factionData.pattern) setUserFactionPattern(factionData.pattern)
            }
          })
      }

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
        const ed = energyRes.data as {
          energy: number
          regenRate: number
          claimedCount: number
          nextPointIn: number
        }
        setEnergy(ed.energy)
        setRegenInfo({
          regenRate: ed.regenRate ?? 1,
          claimedCount: ed.claimedCount ?? 0,
          nextPointIn: ed.nextPointIn ?? 0,
        })
      }
      if (profileRes.data) {
        const profile = profileRes.data as { role?: string; profileImage?: { url: string } | null }
        setUserAvatarUrl(profile.profileImage?.url ?? null)
        setIsAdmin(profile.role === 'admin')
      }

      setLoading(false)

      // Charger l'activite recente et afficher en toasts
      loadRecentActivity(userData.id)

      // Souscrire aux events temps réel (découvertes, claims, nouveaux joueurs)
      if (!cancelled) {
        subscribeToActivity(userData.id)
      }
    }

    function subscribeToActivity(currentUserId: string) {
      const addToast = useToastStore.getState().addToast
      const ch = supabase.channel('activity-realtime')

      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const e = payload.new as {
            type: string
            actor_id: string
            data: { placeTitle?: string; factionTitle?: string; actorName?: string }
          }

          // Ignorer ses propres actions (déjà notifié localement)
          if (e.actor_id === currentUserId) return

          const name = e.data?.actorName ?? 'Quelqu\'un'
          const place = e.data?.placeTitle ?? 'un lieu'
          let message = ''
          let type: GameToast['type'] = 'discover'

          if (e.type === 'claim') {
            const faction = e.data?.factionTitle ?? 'une faction'
            message = `${name} a revendiqué ${place} pour ${faction}`
            type = 'claim'
          } else if (e.type === 'discover') {
            message = `${name} a découvert ${place}`
            type = 'discover'
          } else if (e.type === 'new_user') {
            message = `${name} a rejoint la carte`
            type = 'new_user'
          } else {
            return
          }

          addToast({ type, message, timestamp: Date.now() })
        },
      )

      ch.subscribe((status) => {
        console.log('[Activity] realtime status:', status)
      })
      activityChannelRef.current = ch
    }

    init()
    return () => {
      cancelled = true
      if (activityChannelRef.current) {
        supabase.removeChannel(activityChannelRef.current)
        activityChannelRef.current = null
      }
    }
  }, [isAuthenticated, user?.email])
}

/** Charge les events recents et les affiche en toasts (7 jours max) */
async function loadRecentActivity(currentUserId: string) {
  const { data } = await supabase.rpc('get_recent_activity', { p_limit: 50 })
  if (!data || !Array.isArray(data)) return

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const addToast = useToastStore.getState().addToast

  const recent = (data as Array<{
    type: string
    actor_id: string
    faction_id: string | null
    data: { placeTitle?: string; factionTitle?: string; actorName?: string }
    created_at: string
  }>)
    .filter(e => new Date(e.created_at).getTime() > cutoff)

  for (const e of recent) {
    const isSelf = e.actor_id === currentUserId
    const name = isSelf ? 'Vous' : (e.data?.actorName ?? 'Quelqu\'un')
    const place = e.data?.placeTitle ?? 'un lieu'

    let message = ''
    let type: 'claim' | 'discover' | 'new_place' | 'new_user' | 'like' = 'discover'

    if (e.type === 'claim') {
      const faction = e.data?.factionTitle ?? 'une faction'
      message = isSelf
        ? `Vous avez revendiqué ${place} pour ${faction}`
        : `${name} a revendiqué ${place} pour ${faction}`
      type = 'claim'
    } else if (e.type === 'discover') {
      message = isSelf
        ? `Vous avez découvert ${place}`
        : `${name} a découvert ${place}`
      type = 'discover'
    } else if (e.type === 'new_user') {
      if (isSelf) continue
      message = `${name} a rejoint la carte`
      type = 'new_user'
    } else {
      continue
    }

    addToast({ type, message, timestamp: new Date(e.created_at).getTime() })
  }
}

/**
 * Découvrir un lieu — fonction standalone, pas besoin de hook.
 * Lit le store directement via getState().
 */
export async function discoverPlace(
  placeId: string,
  placeLat: number,
  placeLng: number,
): Promise<{ success: boolean; error?: string }> {
  const { userId, userPosition, addDiscoveredId, setEnergy, setRegenInfo } = useFogStore.getState()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Déterminer la méthode (GPS ou remote) basé sur la distance
  let method = 'remote'
  if (userPosition) {
    const dist = haversineM(userPosition.lat, userPosition.lng, placeLat, placeLng)
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
  if (data?.regenRate !== undefined) {
    setRegenInfo({
      regenRate: data.regenRate,
      claimedCount: data.claimedCount ?? 0,
      nextPointIn: data.nextPointIn ?? 0,
    })
  }

  useToastStore.getState().addToast({
    type: 'discover',
    message: 'Nouveau lieu découvert !',
    timestamp: Date.now(),
  })

  return { success: true }
}
