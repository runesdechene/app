/**
 * QUOI     — le bouton « Ma position » : la carte vole jusqu'à moi, ou dit qu'elle ne me trouve pas.
 * POURQUOI — un geste ponctuel, sans suivi : la position suivie (`useMaPosition`) sert les Actifs ;
 *            ici, une seule lecture, gardée une minute par le navigateur.
 */
import type { Map as Carte } from 'maplibre-gl'

export function allerAMaPosition(carte: Carte | null, sansPosition: () => void) {
  if (!('geolocation' in navigator)) {
    sansPosition()
    return
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => carte?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 }),
    sansPosition,
    { timeout: 10_000, maximumAge: 60_000 },
  )
}
