import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import type { GameToast } from '../stores/toastStore'
import { useAuth } from './useAuth'
import { useMapStore } from '../stores/mapStore'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { refreshLevelStateGlobal } from './useLevel'
import { useGloryRulesStore } from '../stores/gloryRulesStore'

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

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
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
        .select('id, faction_id, first_name, email_address, avatar_url, tutorial_completed_at, brouiller_pistes')
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
      // V0.7+ Brouillage GPS — privacy-by-default true (cohérent avec le DEFAULT SQL)
      usePlayerStore.getState().setBrouillerPistes(userData.brouiller_pistes ?? true)
      setUserFactionId(userData.faction_id)
      // Garder '' pour les nouveaux joueurs (déclenche l'onboarding)
      setUserName(userData.first_name ?? '')
      // Mettre a jour last_login_at pour le Hub (badge "Reactive") — via RPC
      // car RLS de public.users n'a pas de policy UPDATE (silent deny sinon).
      supabase.rpc('touch_last_login', { p_user_id: userData.id }).then(({ error }) => {
        if (error) console.warn('[usePlayer] touch_last_login failed', error)
      })
      // Debloquer les fragments pending (achats avant inscription)
      supabase.rpc('unlock_pending_fragments', { p_user_id: userData.id, p_email: user!.email }).then(({ error }) => {
        if (error) console.warn('[usePlayer] unlock_pending_fragments failed', error)
      })
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
        })
          .then(res => { if (!res.ok) console.warn('[usePlayer] shopify-create-customer HTTP', res.status) })
          .catch(err => console.warn('[usePlayer] shopify-create-customer failed', err))
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
          .then(({ data: factionData, error: factionErr }) => {
            if (cancelled) return
            if (factionErr) {
              console.warn('[usePlayer] load faction failed', factionErr)
              return
            }
            if (factionData) {
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
        }
        setEnergy(ed.energy)
        setNextPointIn(ed.nextPointIn ?? 0)
        usePlayerStore.setState({
          maxEnergy: ed.maxEnergy ?? 5,
          energyCycle: ed.energyCycle ?? 7200,
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
      // displayedTitles = tous les titres affichés (max 3) formatés pour la carte
      const { data: playerProfile, error: profileErr } = await supabase.rpc('get_player_profile', { p_user_id: userData.id })
      if (profileErr) console.warn('[usePlayer] get_player_profile failed', profileErr)
      if (playerProfile) {
        const pp = playerProfile as { displayedGeneralTitles?: Array<{ icon: string; name: string; icon_url?: string | null }> }
        const titles = (pp.displayedGeneralTitles ?? []).map(t => {
          const prefix = t.icon_url ? '' : (t.icon ?? '')
          return `${prefix} ${t.name}`.trim()
        })
        usePlayerStore.setState({ displayedTitles: titles })
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

          // V067 — toasts tirés du barème centralisé (app_settings).
          // Helper local : formate "+G Gloire / +C Coupe" en omettant les 0.
          const r = useGloryRulesStore.getState().rules
          const fmt = (g: number, c: number) => {
            const parts: string[] = []
            if (g > 0) parts.push(`+${g} Gloire`)
            if (c > 0) parts.push(`+${c} Coupe`)
            return parts.join(' / ')
          }

          if (e.type === 'claim' || e.type === 'fortify' || e.type === 'place_influence') {
            return
          } else if (e.type === 'plant_flag') {
            message = isSelf
              ? `🏴 Tu as planté ta bannière à ${place} ${fmt(r['glory.plant_flag'], r['coupe.plant_flag'])}`
              : `${name} a planté son étendard sur ${place} 🚩`
            highlights.push(place)
            type = 'plant_flag'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
            if (e.place_id && e.faction_id) {
              useMapStore.getState().setPlaceOverride(e.place_id, {
                claimed: true,
                factionId: e.faction_id,
                tagColor: color,
                factionPattern: iconUrl,
              })
            }
          } else if (e.type === 'harvest_crown') {
            const gain = (e.data as { gain?: number })?.gain ?? 1
            if (isSelf) {
              message = `Vous avez récolté ${gain} Couronne${gain > 1 ? 's' : ''} sur ${place} 🪙`
              highlights.push(place)
            } else {
              return
            }
            type = 'harvest_crown'
          } else if (e.type === 'discover') {
            if (isSelf) {
              // V067 — découverte = mêmes points peu importe la méthode
              // (le bouton "Poser ma marque" sur place fait la visite GPS séparée).
              message = `Le brouillard se lève sur ${place} 🔍 ${fmt(r['glory.discover_remote'], r['coupe.discover_remote'])}`
            } else {
              message = `${name} a levé le brouillard sur ${place}`
            }
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
            // V067 — pour soi-même, AddPlaceFlow émet déjà un toast local
            // détaillé qui connait isGps (lieu + visite + plantage si sur
            // place). Skip ici pour éviter doublon.
            if (isSelf) return
            message = `${name} a ajouté ${place} 🏛️`
            highlights.push(name, place)
            type = 'new_place'
          } else if (e.type === 'new_user') {
            message = `${name} a rejoint la carte`
            type = 'new_user'
          } else if (e.type === 'contribute') {
            const isPhoto = e.data?.contributionType === 'photo'
            const g = isPhoto ? r['glory.photo'] : r['glory.carnet']
            const c = isPhoto ? r['coupe.photo'] : r['coupe.carnet']
            message = isSelf
              ? isPhoto
                ? `📷 Tu as ajouté une photo de ${place} ${fmt(g, c)}`
                : `✍️ Tu as écrit un récit sur ${place} ${fmt(g, c)}`
              : `${name} a ${isPhoto ? 'ajouté une photo de' : 'écrit un récit sur'} ${place} 📜`
            highlights.push(place)
            type = 'contribute'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'revisit_gps') {
            // V0.6 — pas de gain pour la revisite (formule V0.7 = DISTINCT place_id)
            message = isSelf
              ? `De retour sur ${place}`
              : `${name} est de retour sur ${place}`
            highlights.push(place)
            type = 'revisit'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'enigma_success') {
            // V067 — barème centralisé app_settings : Gloire pondérée
            // (1/2/3/5), Coupe fixe (+1 quelle que soit la difficulté
            // pour l'équité du classement / anti-triche).
            const diff = e.data?.difficulty ?? 'easy'
            const keyG = diff === 'very_easy' ? 'glory.enigma_very_easy'
                       : diff === 'medium'    ? 'glory.enigma_medium'
                       : diff === 'hard'      ? 'glory.enigma_hard'
                       : 'glory.enigma_easy'
            const keyC = diff === 'very_easy' ? 'coupe.enigma_very_easy'
                       : diff === 'medium'    ? 'coupe.enigma_medium'
                       : diff === 'hard'      ? 'coupe.enigma_hard'
                       : 'coupe.enigma_easy'
            const gainG = r[keyG] ?? 1
            const gainC = r[keyC] ?? 1
            if (isSelf) {
              message = `Énigme résolue 🦉 ${fmt(gainG, gainC)}`
            } else {
              message = `${name} a résolu une énigme 📖`
            }
            type = 'enigma'
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

    // V0.6 — toasts d'historique (7 derniers jours) épurés.
    // Skip V0.5 (claim, fortify, place_influence, harvest_crown autres users).
    if (e.type === 'claim' || e.type === 'fortify' || e.type === 'place_influence' || e.type === 'harvest_crown') {
      continue
    } else if (e.type === 'plant_flag') {
      message = `${name} a planté son étendard sur ${place} 🚩`
      highlights.push(name, place)
      type = 'plant_flag'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'discover' || e.type === 'explore') {
      message = `${name} a levé le brouillard sur ${place}`
      highlights.push(name, place)
      type = 'discover'
    } else if (e.type === 'like') {
      message = `${name} a aimé ${place}`
      highlights.push(name, place)
      type = 'like'
    } else if (e.type === 'new_place') {
      message = `${name} a ajouté ${place} 🏛️`
      highlights.push(name, place)
      type = 'new_place'
    } else if (e.type === 'new_user') {
      message = `${name} a rejoint la carte`
      highlights.push(name)
      type = 'new_user'
    } else if (e.type === 'contribute') {
      const contribType = e.data?.contributionType === 'photo' ? 'une photo' : 'un récit'
      message = `${name} a ajouté ${contribType} sur ${place} 📜`
      highlights.push(name, place)
      type = 'contribute'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'revisit_gps') {
      message = `${name} est de retour sur ${place}`
      highlights.push(name, place)
      type = 'revisit'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'enigma_success') {
      message = `${name} a résolu une énigme 📖`
      highlights.push(name)
      type = 'enigma'
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

  // V0.7 — mise à jour des exploration_points (rétrocompat, plus affiché)
  const explorationGain = data?.explorationGain ?? 5
  const currentExploration = usePlayerStore.getState().explorationPoints
  usePlayerStore.getState().setExplorationPoints(currentExploration + explorationGain)

  // V067 — barème centralisé app_settings via gloryRulesStore.
  // Découverte = +discover_remote G / +discover_remote C (par défaut 1G / 0C).
  // (La visite GPS est désormais une action SÉPARÉE — elle se déclenche
  // depuis le bouton "Poser ma marque" sur PlacePanel, plus lors de la
  // découverte. Donc plus de différenciation gps/remote ici.)
  const rules = useGloryRulesStore.getState().rules
  const gloryGain = rules['glory.discover_remote'] ?? 1
  const coupeGain = rules['coupe.discover_remote'] ?? 0
  const gainParts: string[] = []
  if (gloryGain > 0) gainParts.push(`+${gloryGain} Gloire`)
  if (coupeGain > 0) gainParts.push(`+${coupeGain} Coupe`)
  const toastMessage = `Le brouillard se lève sur ce lieu 🔍 ${gainParts.join(' / ')}`

  useToastStore.getState().addToast({
    type: 'discover',
    message: toastMessage,
    timestamp: Date.now(),
  })

  // Rafraîchir l'état de niveau pour que useLevelUp détecte le changement
  await refreshLevelStateGlobal(userId)

  return { success: true }
}
