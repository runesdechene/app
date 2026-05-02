import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

/**
 * V0.7+ Brouillage GPS
 *
 * Calcule la position publique (visible des autres voyageurs) une seule fois
 * dès qu'on a un userPosition + un toggle brouillerPistes activé.
 * Cohérence visuelle (cf. spec §3.2) : si on randomisait à chaque update GPS,
 * l'avatar deviendrait un "fantôme qui clignote" pour les autres. On fige donc
 * la position floutée pour la session, et on la recalcule uniquement si le toggle
 * est ré-activé en cours de session.
 *
 * Soi voit TOUJOURS sa vraie position (userPosition) — le brouillage n'est que
 * pour les autres (consommé dans usePresence.buildPayload).
 */
export function useBrouillagePistes() {
  const userId = usePlayerStore(s => s.userId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const brouillerPistes = usePlayerStore(s => s.brouillerPistes)
  const publicPosition = usePlayerStore(s => s.publicPosition)

  // Suit la valeur précédente pour détecter une transition off→on et forcer un recalcul
  const prevToggleRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (!userId) return
    if (!userPosition) return

    const prev = prevToggleRef.current
    prevToggleRef.current = brouillerPistes

    // Toggle off → on : recalcul forcé pour ne pas garder une vieille position périmée
    const toggledOn = prev === false && brouillerPistes === true

    if (!brouillerPistes) {
      // Toggle off : on libère la position publique floutée
      if (publicPosition !== null) {
        usePlayerStore.getState().setPublicPosition(null)
      }
      return
    }

    // Toggle on et déjà calculé — on ne refait rien (stable durant la session)
    if (publicPosition && !toggledOn) return

    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.rpc('randomize_position_on_land', {
        p_lat: userPosition.lat,
        p_lng: userPosition.lng,
      })
      if (cancelled) return
      if (error || !data) {
        console.warn('[useBrouillagePistes] RPC failed', error)
        return
      }
      const point = data as { lat: number; lng: number }
      usePlayerStore.getState().setPublicPosition({ lat: point.lat, lng: point.lng })
    })()

    return () => { cancelled = true }
  }, [userId, userPosition, brouillerPistes, publicPosition])
}
