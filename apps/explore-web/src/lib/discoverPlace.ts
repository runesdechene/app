// Action standalone : découvrir un lieu (pas un hook, lit le store via getState).
// Extraite de usePlayer.ts dans le sprint Purification (B14, mai 2026).

import { supabase } from './supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import { useGloryRulesStore } from '../stores/gloryRulesStore'
import { useCrownsStore } from '../stores/crownsStore'
import { useDefisStore } from '../stores/defisStore'
import { refreshLevelStateGlobal } from '../hooks/useLevel'

const GPS_PROXIMITY_M = 500

/** Distance haversine en mètres entre 2 coordonnées (lat, lng). */
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
 * Découvrir un lieu — fonction standalone, pas besoin de hook.
 * Lit le store directement via getState().
 *
 * Méthode déterminée par la distance GPS au lieu (proximité < 500m = 'gps',
 * sinon 'remote'). V067+ : la visite GPS est désormais une action SÉPARÉE
 * (bouton "Poser ma marque" sur PlacePanel), donc plus de différenciation
 * de gain ici, c'est uniformément 'discover_remote'.
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

  // V067 — barème centralisé app_settings via gloryRulesStore.
  // Découverte = +discover_remote G / +discover_remote C (par défaut 1G / 0C).
  const rules = useGloryRulesStore.getState().rules
  const gloryGain = rules['glory.discover_remote'] ?? 1
  const coupeGain = rules['coupe.discover_remote'] ?? 0
  const crownsGain = (data?.crownsGain ?? 0) + (data?.questBonus ?? 0)

  const gainParts: string[] = []
  if (gloryGain > 0) gainParts.push(`+${gloryGain} Gloire`)
  if (coupeGain > 0) gainParts.push(`+${coupeGain} Coupe`)
  if (crownsGain > 0) {
    const questSuffix = (data?.questBonus ?? 0) > 0 ? ' (Mini-quête !)' : ''
    gainParts.push(`+${crownsGain} 🪙${questSuffix}`)
  }
  const toastMessage = `Le brouillard se lève sur ce lieu 🔍 ${gainParts.join(' / ')}`

  useToastStore.getState().addToast({
    type: 'discover',
    message: toastMessage,
    timestamp: Date.now(),
  })

  // V0.7+ — refresh balance Couronnes après découverte (gain potentiel + bonus quête)
  if (crownsGain > 0 && typeof data?.newCrownsBalance === 'number') {
    useCrownsStore.getState().setBalance(data.newCrownsBalance)
  }

  // Refresh défis après découverte (remote = révéler, gps = visiter — les deux font avancer les défis)
  useDefisStore.getState().refresh(userId)

  // Rafraîchir l'état de niveau pour que useLevelUp détecte le changement
  await refreshLevelStateGlobal(userId)

  return { success: true }
}
