/**
 * QUOI     — la position de l'Explorateur qui regarde, SI le navigateur l'a déjà autorisée.
 * POURQUOI — la distance des lieux ne s'affiche qu'avec la position du compte qui regarde
 *            (Uriel, 27/09). Le profil ne DEMANDE jamais la permission : il la lit seulement
 *            si elle a déjà été donnée (en V1, sur la même origine). Sinon : null.
 */
import type { Point } from './distance'

// Où en est l'autorisation de position de ce navigateur. « impossible » : pas de géolocalisation,
// ou pas de moyen de lire l'autorisation (la présence ne s'envoie alors jamais).
export type Autorisation = 'accordee' | 'a-demander' | 'refusee' | 'impossible'

const SELON_LE_NAVIGATEUR: Record<PermissionState, Autorisation> = {
  granted: 'accordee',
  prompt: 'a-demander',
  denied: 'refusee',
}

export function autorisationDe(statut: PermissionStatus): Autorisation {
  return SELON_LE_NAVIGATEUR[statut.state]
}

export async function statutDeLaPosition(): Promise<PermissionStatus | null> {
  if (!('geolocation' in navigator) || !('permissions' in navigator)) return null
  try {
    return await navigator.permissions.query({ name: 'geolocation' })
  } catch {
    return null
  }
}

export async function lireAutorisation(): Promise<Autorisation> {
  const statut = await statutDeLaPosition()
  return statut ? autorisationDe(statut) : 'impossible'
}

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

// Demande la position, quitte à faire apparaître la question du navigateur : seulement sur un
// geste de l'Explorateur (« Utiliser ma position »).
export function demanderPosition(): Promise<Point | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null)
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
