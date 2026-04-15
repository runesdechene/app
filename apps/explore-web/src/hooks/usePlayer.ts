import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
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
export function usePlayer() {
  const { user, isAuthenticated } = useAuth()
  const activityChannelRef = useRef<RealtimeChannel | null>(null)

  const setDiscoveredIds = usePlayerStore(s => s.setDiscoveredIds)
  const setUserFactionId = usePlayerStore(s => s.setUserFactionId)
  const setUserId = usePlayerStore(s => s.setUserId)
  const setEnergy = usePlayerStore(s => s.setEnergy)
  const setNextPointIn = usePlayerStore(s => s.setNextPointIn)
  const setLoading = usePlayerStore(s => s.setLoading)
  const setUserAvatarUrl = usePlayerStore(s => s.setUserAvatarUrl)
  const setUserFactionColor = usePlayerStore(s => s.setUserFactionColor)
  const setUserFactionTitle = usePlayerStore(s => s.setUserFactionTitle)
  const setUserFactionPattern = usePlayerStore(s => s.setUserFactionPattern)
  const setUserName = usePlayerStore(s => s.setUserName)
  const setIsAdmin = usePlayerStore(s => s.setIsAdmin)
  const setConquestPoints = usePlayerStore(s => s.setConquestPoints)
  const setConquestNextPointIn = usePlayerStore(s => s.setConquestNextPointIn)
  const setConstructionPoints = usePlayerStore(s => s.setConstructionPoints)
  const setConstructionNextPointIn = usePlayerStore(s => s.setConstructionNextPointIn)

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
      setConquestPoints(0)
      setConquestNextPointIn(0)
      setConstructionPoints(0)
      setConstructionNextPointIn(0)
      setUserFactionId(null)
      setUserFactionColor(null)
      setUserFactionTitle(null)
      setUserFactionPattern(null)
      setUserId(null)
      setUserName(null)
      setUserAvatarUrl(null)
      setIsAdmin(false)
      usePlayerStore.getState().setTutorialCompletedAt(null)
      setLoading(false)
      useToastStore.getState().clearAll()
      return
    }

    let cancelled = false

    async function init() {
      setLoading(true)

      const { data: userData } = await supabase
        .from('users')
        .select('id, faction_id, first_name, email_address, avatar_url, tutorial_completed_at')
        .eq('email_address', user!.email)
        .single()

      if (cancelled || !userData) {
        setLoading(false)
        return
      }

      // Auto-migration : si l'ID en base (Firebase) ne matche pas auth.uid() (Supabase),
      // migrer l'ancien compte vers le nouvel UUID pour que la RLS fonctionne
      const authId = user!.id
      if (userData.id !== authId) {
        console.warn(`[usePlayer] ID mismatch detected: db=${userData.id}, auth=${authId}. Migrating...`)
        const { data: migResult } = await supabase.rpc('migrate_user_to_auth_id', {
          p_old_id: userData.id,
          p_new_id: authId,
        })
        if (migResult?.error) {
          console.error('[usePlayer] Migration failed:', migResult.error)
        } else {
          console.log('[usePlayer] Migration successful:', migResult)
          // Utiliser le nouvel ID
          userData.id = authId
        }
      }

      setUserId(userData.id)
      usePlayerStore.getState().setTutorialCompletedAt(userData.tutorial_completed_at)
      setUserFactionId(userData.faction_id)
      // Garder '' pour les nouveaux joueurs (déclenche l'onboarding)
      setUserName(userData.first_name ?? '')
      // Mettre a jour last_login_at pour le Hub (badge "Reactive")
      supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', userData.id).then(() => {})
      // Debloquer les fragments pending (achats avant inscription)
      supabase.rpc('unlock_pending_fragments', { p_user_id: userData.id, p_email: user!.email }).then(() => {})
      // Créer/lier le client Shopify (fire-and-forget, pas bloquant)
      if (user?.email) {
        fetch('https://hub.runesdechene.com/.netlify/functions/shopify-create-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firstName: userData.first_name || null,
            factionTitle: null, // sera mis à jour au choix de faction
          }),
        }).catch(() => {})
      }
      // Avatar direct si disponible
      if (userData.avatar_url) {
        setUserAvatarUrl(userData.avatar_url)
      }

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
          vitalitePoints: number
          maxVitalite: number
          vitaliteNextPointIn: number
          vitaliteCycle: number
        }
        setEnergy(ed.energy)
        setNextPointIn(ed.nextPointIn ?? 0)
        setConquestPoints(ed.conquestPoints ?? 0)
        setConquestNextPointIn(ed.conquestNextPointIn ?? 0)
        setConstructionPoints(ed.constructionPoints ?? 0)
        setConstructionNextPointIn(ed.constructionNextPointIn ?? 0)
        usePlayerStore.setState({
          maxEnergy: ed.maxEnergy ?? 5,
          maxConquest: ed.maxConquest ?? 5,
          maxConstruction: ed.maxConstruction ?? 5,
          energyCycle: ed.energyCycle ?? 7200,
          conquestCycle: ed.conquestCycle ?? 14400,
          constructionCycle: ed.constructionCycle ?? 14400,
          vitalitePoints: ed.vitalitePoints ?? 0,
          maxVitalite: ed.maxVitalite ?? 5,
          vitaliteNextPointIn: ed.vitaliteNextPointIn ?? 0,
          vitaliteCycle: ed.vitaliteCycle ?? 14400,
        })
      }
      if (profileRes.data) {
        const profile = profileRes.data as {
          role?: string
          profileImage?: { url: string } | null
          explorationPoints?: number
          eruditionPoints?: number
          influenceStock?: number
          glory?: number
        }
        setUserAvatarUrl(profile.profileImage?.url ?? null)
        setIsAdmin(profile.role === 'admin')
        // V0.5 fields
        if (profile.explorationPoints != null) {
          usePlayerStore.getState().setExplorationPoints(profile.explorationPoints)
        }
        if (profile.eruditionPoints != null) {
          usePlayerStore.getState().setEruditionPoints(profile.eruditionPoints)
        }
        if (profile.influenceStock != null) {
          usePlayerStore.getState().setInfluenceStock(profile.influenceStock)
        }
      }
      if (titlesRes.data) {
        const td = titlesRes.data as {
          unlockedGeneralTitles: Array<{ id: number; name: string; icon: string; unlocks: string[]; order: number }>
          factionTitle: { id: number; name: string; icon: string; unlocks: string[] } | null
          displayedGeneralTitleIds: number[]
        }
        usePlayerStore.setState({
          unlockedGeneralTitles: td.unlockedGeneralTitles ?? [],
          displayedGeneralTitleIds: td.displayedGeneralTitleIds ?? [],
          factionTitle2: td.factionTitle ?? null,
        })
      }
      // PrimaryTitle = premier titre affiché (v3)
      const { data: playerProfile } = await supabase.rpc('get_player_profile', { p_user_id: userData.id })
      if (playerProfile) {
        const pp = playerProfile as { displayedGeneralTitles?: Array<{ icon: string; name: string }> }
        const firstTitle = pp.displayedGeneralTitles?.[0]
        if (firstTitle) {
          usePlayerStore.setState({ primaryTitle: `${firstTitle.icon ?? ''} ${firstTitle.name}`.trim() })
        }
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
              previousClaimedBy?: string
              previousFactionId?: string
              previousFactionTitle?: string
              previousClaimerName?: string
              previousActorId?: string
              previousActorName?: string
              gloryGain?: number
              contributionType?: string
              points?: number
              influenceGain?: number
              eruditionGain?: number
              enigmaType?: string
              difficulty?: string
              actorAvatarUrl?: string
              authorName?: string
              authorId?: string
              contributionId?: number
            }
          }

          // Ignorer ses propres actions (sauf likes et enigma_success)
          const isSelf = e.actor_id === currentUserId
          if (isSelf && e.type !== 'like' && e.type !== 'enigma_success') return
          // Ignorer le tracking interne fragment_enigma (pas un toast)
          if (e.type === 'fragment_enigma') return

          const name = isSelf ? 'Vous' : (e.data?.actorName || 'Quelqu\'un')
          const place = e.data?.placeTitle || 'un lieu'
          const actorAvatarUrl = e.data?.actorAvatarUrl ?? undefined
          let message = ''
          let type: GameToast['type'] = 'discover'
          const highlights: string[] = [name]
          let color: string | undefined = e.data?.factionColor ?? undefined
          let iconUrl: string | undefined
          let contested = false

          if (e.type === 'claim') {
            type = 'claim'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
            const prevName = e.data?.previousClaimerName ?? e.data?.previousActorName
            if (e.data?.previousClaimedBy === currentUserId || e.data?.previousActorId === currentUserId) {
              message = `${name} a pris le flambeau sur ${place}`
              contested = true
            } else if (prevName) {
              message = `${name} a pris le flambeau sur ${place}, succédant à ${prevName}`
              contested = true
            } else {
              message = `${name} veille à présent sur ${place}`
            }
            highlights.push(place)
            if (prevName && e.data?.previousClaimedBy !== currentUserId) {
              highlights.push(prevName)
            }
            if (e.place_id && e.faction_id) {
              useMapStore.getState().setPlaceOverride(e.place_id, {
                claimed: true,
                factionId: e.faction_id,
                tagColor: color,
                factionPattern: iconUrl,
              })
            }
          } else if (e.type === 'fortify') {
            message = isSelf ? `Vous avez fortifié ${place}` : `${name} a fortifié ${place}`
            highlights.push(place)
            type = 'fortify'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'discover') {
            message = `${name} a découvert ${place}`
            highlights.push(place)
            type = 'discover'
          } else if (e.type === 'like') {
            message = isSelf ? `Vous avez aimé ${place}` : `${name} a aimé ${place}`
            highlights.push(place)
            type = 'like'
          } else if (e.type === 'like_carnet') {
            const author = e.data?.authorName || 'un explorateur'
            message = isSelf
              ? `Vous avez aimé le récit de ${author} sur ${place}`
              : `${name} a aimé un récit sur ${place}`
            highlights.push(name, place)
            type = 'like'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'new_place') {
            message = isSelf ? `Vous avez ajouté ${place}` : `${name} a ajouté ${place}`
            highlights.push(name, place)
            type = 'new_place'
          } else if (e.type === 'new_user') {
            message = `${name} a rejoint la carte`
            type = 'new_user'
          } else if (e.type === 'contribute') {
            const contribType = e.data?.contributionType === 'photo' ? 'une photo' : 'un récit'
            message = `${name} a ajouté ${contribType} sur ${place}`
            highlights.push(place)
            type = 'contribute'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'revisit_gps') {
            const gain = e.data?.influenceGain ?? 0
            message = `${name} est de retour sur ${place} (+${gain} influence)`
            highlights.push(place)
            type = 'revisit'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'enigma_success') {
            const erudGain = e.data?.eruditionGain ?? 0
            const infGain = e.data?.influenceGain ?? 0
            if (isSelf) {
              message = `Enigme réussie ! +${erudGain} érudition, +${infGain} influence`
            } else {
              message = `${name} a résolu une énigme (+${erudGain} érudition)`
            }
            type = 'enigma'
          } else if (e.type === 'place_influence') {
            const pts = e.data?.points ?? 1
            message = `${name} a placé ${pts} influence sur ${place}`
            highlights.push(place)
            type = 'influence'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else {
            return
          }

          const hasLocation = e.data?.placeLatitude != null && e.data?.placeLongitude != null
          addToast({
            type,
            message,
            highlights,
            color,
            iconUrl,
            contested,
            actorId: e.actor_id ?? undefined,
            actorAvatarUrl,
            previousActorId: e.data?.previousClaimedBy ?? undefined,
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
      factionColor?: string
      factionPattern?: string
      actorName?: string
      previousClaimedBy?: string
      previousFactionId?: string
      previousFactionTitle?: string
      previousClaimerName?: string
      previousActorId?: string
      previousActorName?: string
      gloryGain?: number
      contributionType?: string
      points?: number
      influenceGain?: number
      eruditionGain?: number
      enigmaType?: string
      difficulty?: string
      actorAvatarUrl?: string
    }
    created_at: string
  }>)
    .filter(e => new Date(e.created_at).getTime() > cutoff)

  for (const e of recent) {
    // Ne montrer que les actions des AUTRES joueurs au chargement.
    if (e.actor_id === currentUserId) continue
    // Ignorer le tracking interne fragment_enigma
    if (e.type === 'fragment_enigma') continue

    const name = e.data?.actorName || 'Quelqu\'un'
    const place = e.data?.placeTitle || 'un lieu'
    const actorAvatarUrl = e.data?.actorAvatarUrl ?? undefined

    let message = ''
    let type: GameToast['type'] = 'discover'
    const highlights: string[] = []
    let color: string | undefined = e.data?.factionColor ?? undefined
    let iconUrl: string | undefined
    let contested = false

    if (e.type === 'claim') {
      type = 'claim'
      iconUrl = e.data?.factionPattern ?? undefined
      const prevName = e.data?.previousClaimerName ?? e.data?.previousActorName
      if (e.data?.previousClaimedBy === currentUserId || e.data?.previousActorId === currentUserId) {
        message = `${name} a pris le flambeau sur ${place}`
        contested = true
      } else if (prevName) {
        message = `${name} a pris le flambeau sur ${place}, succédant à ${prevName}`
        contested = true
      } else {
        message = `${name} veille à présent sur ${place}`
      }
      highlights.push(name, place)
      if (prevName && e.data?.previousClaimedBy !== currentUserId && e.data?.previousActorId !== currentUserId) {
        highlights.push(prevName)
      }
    } else if (e.type === 'fortify') {
      message = `${name} a fortifié ${place}`
      highlights.push(name, place)
      type = 'fortify'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'discover') {
      message = `${name} a découvert ${place}`
      highlights.push(name, place)
      type = 'discover'
    } else if (e.type === 'explore') {
      message = `${name} a exploré ${place}`
      highlights.push(name, place)
      type = 'explore'
    } else if (e.type === 'like') {
      message = `${name} a aimé ${place}`
      highlights.push(name, place)
      type = 'like'
    } else if (e.type === 'new_place') {
      message = `${name} a ajouté ${place}`
      highlights.push(name, place)
      type = 'new_place'
    } else if (e.type === 'new_user') {
      message = `${name} a rejoint la carte`
      highlights.push(name)
      type = 'new_user'
    } else if (e.type === 'contribute') {
      const contribType = e.data?.contributionType === 'photo' ? 'une photo' : 'un récit'
      message = `${name} a ajouté ${contribType} sur ${place}`
      highlights.push(name, place)
      type = 'contribute'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'revisit_gps') {
      const gain = e.data?.influenceGain ?? 0
      message = `${name} est de retour sur ${place} (+${gain} influence)`
      highlights.push(name, place)
      type = 'revisit'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'enigma_success') {
      const erudGain = e.data?.eruditionGain ?? 0
      message = `${name} a résolu une énigme (+${erudGain} érudition)`
      highlights.push(name)
      type = 'enigma'
    } else if (e.type === 'place_influence') {
      const pts = e.data?.points ?? 1
      message = `${name} a placé ${pts} influence sur ${place}`
      highlights.push(name, place)
      type = 'influence'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else {
      continue
    }

    const hasLocation = e.data?.placeLatitude != null && e.data?.placeLongitude != null
    addToast({
      type,
      message,
      highlights,
      color,
      iconUrl,
      contested,
      actorId: e.actor_id ?? undefined,
      actorAvatarUrl,
      previousActorId: e.data?.previousClaimedBy ?? undefined,
      placeId: e.place_id ?? undefined,
      placeLocation: hasLocation
        ? { latitude: e.data!.placeLatitude!, longitude: e.data!.placeLongitude! }
        : undefined,
      timestamp: new Date(e.created_at).getTime(),
    })
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
  const { userId, userPosition, addDiscoveredId } = usePlayerStore.getState()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Déterminer la méthode (GPS ou remote) basé sur la distance
  let method = 'remote'
  if (userPosition) {
    const dist = haversineM(userPosition.lat, userPosition.lng, placeLat, placeLng)
    if (dist <= GPS_PROXIMITY_M) {
      method = 'gps'
    }
  }

  // Forcer la regen côté serveur avant l'action
  await supabase.rpc('get_user_energy', { p_user_id: userId })

  const userPos = usePlayerStore.getState().userPosition
  const { data } = await supabase.rpc('discover_place', {
    p_user_id: userId,
    p_place_id: placeId,
    p_method: method,
    p_user_lat: userPos?.lat ?? null,
    p_user_lng: userPos?.lng ?? null,
    p_free: false,
    p_glory_mult: 1,
  })

  if (data?.error) {
    return { success: false, error: data.error }
  }

  // Rafraîchir l'énergie depuis le serveur (plus fiable que le calcul local)
  addDiscoveredId(placeId)
  const { data: refreshed } = await supabase.rpc('get_user_energy', { p_user_id: userId })
  if (refreshed) {
    usePlayerStore.setState({
      energy: refreshed.energy,
      maxEnergy: refreshed.maxEnergy,
      nextPointIn: refreshed.nextPointIn,
      energyCycle: refreshed.energyCycle,
    })
  }

  const explorationGain = data?.explorationGain ?? 5
  const currentExploration = usePlayerStore.getState().explorationPoints
  usePlayerStore.getState().setExplorationPoints(currentExploration + explorationGain)

  useToastStore.getState().addToast({
    type: 'discover',
    message: `Nouveau lieu découvert ! 🧭 +${explorationGain} Exploration`,
    timestamp: Date.now(),
  })

  return { success: true }
}
