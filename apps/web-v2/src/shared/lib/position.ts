/**
 * QUOI     — l'autorisation de position du navigateur, et une demande de position ponctuelle.
 * POURQUOI — le suivi continu vit dans `useSuivrePosition` ; ici, ce que l'invitation, les
 *            Préférences et les gestes « Utiliser ma position » demandent une fois.
 */
import type { Point } from './distance'

// Où en est l'autorisation de position de ce navigateur. « impossible » : pas de géolocalisation,
// ou pas de moyen de lire l'autorisation (le suivi essaie quand même).
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

// Demande la position, quitte à faire apparaître la question du navigateur.
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
