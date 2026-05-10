import { useEffect } from 'react'
import { usePlayerStore } from '../stores/playerStore'

/**
 * V0.7.7 (10/05) — au mount, lance navigator.geolocation.watchPosition pour
 * déclencher le prompt de permission dès l'ouverture de l'app (et pas
 * seulement quand l'utilisateur arrive sur la carte). Alimente
 * playerStore.userPosition au fil des fixes GPS.
 *
 * Appelé dans MobileLayout (couvre /accueil, /chat, /activite). MapPage
 * a son propre watcher dans ExploreMap (pour le flyTo initial sur la
 * carte) — léger doublon de watcher accepté tant qu'on n'a pas extrait
 * la logique flyTo dans une couche dédiée.
 */
export function useGeolocationWatch() {
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        usePlayerStore.getState().setUserPosition({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        })
      },
      () => {
        /* L'utilisateur a refusé ou erreur — silencieux, on ne spam pas. */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])
}
