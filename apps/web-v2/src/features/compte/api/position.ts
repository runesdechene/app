/**
 * QUOI     — la position de l'Explorateur qui regarde, SI le navigateur l'a déjà autorisée.
 * POURQUOI — la distance des lieux ne s'affiche qu'avec la position du compte qui regarde
 *            (Uriel, 27/09). Le profil ne DEMANDE jamais la permission : il la lit seulement
 *            si elle a déjà été donnée (en V1, sur la même origine). Sinon : null.
 */
import type { Point } from '../lib/distance'

export async function positionSiAutorisee(): Promise<Point | null> {
  if (!('geolocation' in navigator) || !('permissions' in navigator)) return null
  const permission = await navigator.permissions.query({ name: 'geolocation' })
  if (permission.state !== 'granted') return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude })
      },
      () => {
        resolve(null)
      },
      { maximumAge: 10 * 60 * 1000, timeout: 8000 },
    )
  })
}
