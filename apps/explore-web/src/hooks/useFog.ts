import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'
import { useToastStore } from '../stores/toastStore'
import type { GameToast } from '../stores/toastStore'
import { useAuth } from './useAuth'
import { useMapStore } from '../stores/mapStore'
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
  const setNextPointIn = useFogStore(s => s.setNextPointIn)
  const setLoading = useFogStore(s => s.setLoading)
  const setUserAvatarUrl = useFogStore(s => s.setUserAvatarUrl)
  const setUserFactionColor = useFogStore(s => s.setUserFactionColor)
  const setUserFactionTitle = useFogStore(s => s.setUserFactionTitle)
  const setUserFactionPattern = useFogStore(s => s.setUserFactionPattern)
  const setUserName = useFogStore(s => s.setUserName)
  const setIsAdmin = useFogStore(s => s.setIsAdmin)
  const setConquestPoints = useFogStore(s => s.setConquestPoints)
  const setConquestNextPointIn = useFogStore(s => s.setConquestNextPointIn)
  const setConstructionPoints = useFogStore(s => s.setConstructionPoints)
  const setConstructionNextPointIn = useFogStore(s => s.setConstructionNextPointIn)
  const setNotorietyPoints = useFogStore(s => s.setNotorietyPoints)

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
      setConquestPoints(0)
      setConquestNextPointIn(0)
      setConstructionPoints(0)
      setConstructionNextPointIn(0)
      setNotorietyPoints(0)
      setUserFactionId(null)
      setUserFactionColor(null)
      setUserFactionTitle(null)
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
          .select('title, color, pattern')
          .eq('id', userData.faction_id)
          .single()
          .then(({ data: factionData }) => {
            if (!cancelled && factionData) {
              if (factionData.title) setUserFactionTitle(factionData.title)
              if (factionData.color) setUserFactionColor(factionData.color)
              if (factionData.pattern) setUserFactionPattern(factionData.pattern)
            }
          })
      }

      const [discRes, energyRes, profileRes, titlesRes] = await Promise.all([
        supabase.rpc('get_user_discoveries', { p_user_id: userData.id }),
        supabase.rpc('get_user_energy', { p_user_id: userData.id }),
        supabase.rpc('get_my_informations', { p_user_id: userData.id }),
        supabase.rpc('get_user_titles', { p_user_id: userData.id }),
      ])

      if (cancelled) return

      if (discRes.data) {
        setDiscoveredIds(discRes.data as string[])
      }
      if (energyRes.data) {
        const ed = energyRes.data as {
          energy: number
          maxEnergy: number
          nextPointIn: number
          energyCycle: number
          conquestPoints: number
          maxConquest: number
          conquestNextPointIn: number
          conquestCycle: number
          constructionPoints: number
          maxConstruction: number
          constructionNextPointIn: number
          constructionCycle: number
          notorietyPoints: number
          bonusEnergy: number
          bonusConquest: number
          bonusConstruction: number
        }
        setEnergy(ed.energy)
        setNextPointIn(ed.nextPointIn ?? 0)
        setConquestPoints(ed.conquestPoints ?? 0)
        setConquestNextPointIn(ed.conquestNextPointIn ?? 0)
        setConstructionPoints(ed.constructionPoints ?? 0)
        setConstructionNextPointIn(ed.constructionNextPointIn ?? 0)
        setNotorietyPoints(ed.notorietyPoints ?? 0)
        useFogStore.setState({
          maxEnergy: ed.maxEnergy ?? 5,
          maxConquest: ed.maxConquest ?? 5,
          maxConstruction: ed.maxConstruction ?? 5,
          energyCycle: ed.energyCycle ?? 7200,
          conquestCycle: ed.conquestCycle ?? 14400,
          constructionCycle: ed.constructionCycle ?? 14400,
          bonusEnergy: ed.bonusEnergy ?? 0,
          bonusConquest: ed.bonusConquest ?? 0,
          bonusConstruction: ed.bonusConstruction ?? 0,
        })
      }
      if (profileRes.data) {
        const profile = profileRes.data as { role?: string; profileImage?: { url: string } | null }
        setUserAvatarUrl(profile.profileImage?.url ?? null)
        setIsAdmin(profile.role === 'admin')
      }
      if (titlesRes.data) {
        const td = titlesRes.data as {
          unlockedGeneralTitles: Array<{ id: number; name: string; icon: string; unlocks: string[]; order: number }>
          factionTitle: { id: number; name: string; icon: string; unlocks: string[] } | null
          displayedGeneralTitleIds: number[]
        }
        useFogStore.setState({
          unlockedGeneralTitles: td.unlockedGeneralTitles ?? [],
          displayedGeneralTitleIds: td.displayedGeneralTitleIds ?? [],
          factionTitle2: td.factionTitle ?? null,
        })
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
            place_id: string | null
            faction_id: string | null
            data: {
              placeTitle?: string
              placeLatitude?: number
              placeLongitude?: number
              factionTitle?: string
              factionColor?: string
              factionPattern?: string
              actorName?: string
            }
          }

          // Ignorer ses propres actions (sauf likes)
          const isSelf = e.actor_id === currentUserId
          if (isSelf && e.type !== 'like') return

          const name = isSelf ? 'Vous' : (e.data?.actorName ?? 'Quelqu\'un')
          const place = e.data?.placeTitle ?? 'un lieu'
          let message = ''
          let type: GameToast['type'] = 'discover'
          const highlights: string[] = [name]

          if (e.type === 'claim') {
            const faction = e.data?.factionTitle ?? 'une faction'
            message = `${name} a revendiqué ${place} pour ${faction}`
            highlights.push(place)
            type = 'claim'
            // Mettre à jour la carte en temps réel
            if (e.place_id && e.faction_id) {
              useMapStore.getState().setPlaceOverride(e.place_id, {
                claimed: true,
                factionId: e.faction_id,
                tagColor: e.data?.factionColor ?? undefined,
                factionPattern: e.data?.factionPattern ?? undefined,
              })
            }
          } else if (e.type === 'discover') {
            message = `${name} a découvert ${place}`
            highlights.push(place)
            type = 'discover'
          } else if (e.type === 'like') {
            message = isSelf ? `Vous avez aimé ${place}` : `${name} a aimé ${place}`
            highlights.push(place)
            type = 'like'
          } else if (e.type === 'new_place') {
            message = isSelf ? `Vous avez ajouté ${place}` : `${name} a ajouté ${place}`
            highlights.push(name, place)
            type = 'new_place'
          } else if (e.type === 'new_user') {
            message = `${name} a rejoint la carte`
            type = 'new_user'
          } else {
            return
          }

          const hasLocation = e.data?.placeLatitude != null && e.data?.placeLongitude != null
          addToast({
            type,
            message,
            highlights,
            placeId: e.place_id ?? undefined,
            placeLocation: hasLocation
              ? { latitude: e.data!.placeLatitude!, longitude: e.data!.placeLongitude! }
              : undefined,
            timestamp: Date.now(),
          })
        },
      )

      ch.subscribe()
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
    place_id: string | null
    faction_id: string | null
    data: {
      placeTitle?: string
      placeLatitude?: number
      placeLongitude?: number
      factionTitle?: string
      actorName?: string
    }
    created_at: string
  }>)
    .filter(e => new Date(e.created_at).getTime() > cutoff)

  for (const e of recent) {
    const isSelf = e.actor_id === currentUserId
    const name = isSelf ? 'Vous' : (e.data?.actorName ?? 'Quelqu\'un')
    const place = e.data?.placeTitle ?? 'un lieu'

    let message = ''
    let type: 'claim' | 'discover' | 'new_place' | 'new_user' | 'like' | 'explore' = 'discover'
    const highlights: string[] = []

    if (e.type === 'claim') {
      const faction = e.data?.factionTitle ?? 'une faction'
      message = isSelf
        ? `Vous avez revendiqué ${place} pour ${faction}`
        : `${name} a revendiqué ${place} pour ${faction}`
      highlights.push(name, place)
      type = 'claim'
    } else if (e.type === 'discover') {
      message = isSelf
        ? `Vous avez découvert ${place}`
        : `${name} a découvert ${place}`
      highlights.push(name, place)
      type = 'discover'
    } else if (e.type === 'explore') {
      message = isSelf
        ? `Vous avez exploré ${place}`
        : `${name} a exploré ${place}`
      highlights.push(name, place)
      type = 'explore'
    } else if (e.type === 'like') {
      message = isSelf
        ? `Vous avez aimé ${place}`
        : `${name} a aimé ${place}`
      highlights.push(name, place)
      type = 'like'
    } else if (e.type === 'new_place') {
      message = isSelf
        ? `Vous avez ajouté ${place}`
        : `${name} a ajouté ${place}`
      highlights.push(name, place)
      type = 'new_place'
    } else if (e.type === 'new_user') {
      if (isSelf) continue
      message = `${name} a rejoint la carte`
      highlights.push(name)
      type = 'new_user'
    } else {
      continue
    }

    const hasLocation = e.data?.placeLatitude != null && e.data?.placeLongitude != null
    addToast({
      type,
      message,
      highlights,
      placeId: e.place_id ?? undefined,
      placeLocation: hasLocation
        ? { latitude: e.data!.placeLatitude!, longitude: e.data!.placeLongitude! }
        : undefined,
      timestamp: new Date(e.created_at).getTime(),
    })
  }
}

/**
 * Sauvegarder la selection de titres generaux affiches (max 2).
 */
export async function setDisplayedTitles(
  titleIds: number[],
): Promise<{ success: boolean; error?: string }> {
  const { userId } = useFogStore.getState()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data } = await supabase.rpc('set_displayed_titles', {
    p_user_id: userId,
    p_title_ids: titleIds,
  })

  if (data?.error) return { success: false, error: data.error }

  useFogStore.setState({ displayedGeneralTitleIds: titleIds })
  return { success: true }
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
  const { userId, userPosition, addDiscoveredId, setEnergy, setNextPointIn, setConquestPoints, setConquestNextPointIn, setConstructionPoints, setConstructionNextPointIn } = useFogStore.getState()
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
  if (data?.nextPointIn !== undefined) {
    setNextPointIn(data.nextPointIn)
  }
  if (data?.conquestPoints !== undefined) {
    setConquestPoints(data.conquestPoints)
    if (data?.conquestNextPointIn !== undefined) {
      setConquestNextPointIn(data.conquestNextPointIn)
    }
  }
  if (data?.constructionPoints !== undefined) {
    setConstructionPoints(data.constructionPoints)
    if (data?.constructionNextPointIn !== undefined) {
      setConstructionNextPointIn(data.constructionNextPointIn)
    }
  }

  // Toast avec récompenses
  const rewards = data?.rewards as { energy?: number; conquest?: number; construction?: number } | undefined
  const parts: string[] = []
  if (rewards?.conquest) parts.push(`+${rewards.conquest} ⚔️`)
  if (rewards?.construction) parts.push(`+${rewards.construction} 🔨`)
  if (rewards?.energy) parts.push(`+${rewards.energy} ⚡`)

  useToastStore.getState().addToast({
    type: 'discover',
    message: parts.length > 0
      ? `Nouveau lieu découvert ! ${parts.join(' ')}`
      : 'Nouveau lieu découvert !',
    timestamp: Date.now(),
  })

  return { success: true }
}
