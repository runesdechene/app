/**
 * QUOI     — les pins posés et pas encore envoyés au serveur.
 * POURQUOI — Uriel, 06/10 : le pin se pose sans réseau, « c'est tout l'intérêt ». Il naît ici
 *            (IndexedDB, comme le brouillon de lieu) avec son id, sa date et son compte, puis part
 *            au serveur (`envoyer.ts`) ; le serveur l'accepte une seule fois par id.
 * ATTENTION — garder, retirer et marquer passent par `update` (une transaction), jamais lire puis
 *            écrire. Si le navigateur efface ses données avant l'envoi, le pin est perdu (accepté,
 *            spec). Un pin retient le compte qui l'a posé : sur un téléphone partagé, il ne part
 *            jamais sous un autre compte et ne se montre qu'au sien (`estAMoi`).
 */
import { get, update } from 'idb-keyval'

export type PinEnAttente = {
  id: string
  latitude: number
  longitude: number
  precision: number // mètres
  poseLe: string // ISO 8601, l'heure du téléphone
  userId?: string // le compte qui l'a posé ; absent : inconnu à la pose, il suit la session
  refuse?: true // refusé par le serveur (position ou précision impossibles) : ne repart plus
}

const CLE = 'runes-de-chene/pins-en-attente'

export async function lirePinsEnAttente(): Promise<PinEnAttente[]> {
  try {
    return (await get<PinEnAttente[]>(CLE)) ?? []
  } catch {
    return [] // navigation privée, stockage refusé
  }
}

// Un pin sans compte (inconnu à la pose) appartient à la session en cours.
export function estAMoi(p: PinEnAttente, moi: string | null | undefined): boolean {
  return p.userId === undefined || p.userId === moi
}

// `update` lit et écrit dans une seule transaction : un pin posé pendant qu'un envoi se termine
// ne peut pas être écrasé par une liste lue plus tôt.
export async function garderPinEnAttente(p: PinEnAttente): Promise<void> {
  await update<PinEnAttente[]>(CLE, (pins) => [...(pins ?? []).filter((x) => x.id !== p.id), p])
}

// Dit si le pin était encore là : supprimé pendant son envoi, il ne l'est plus.
export async function retirerPinEnAttente(id: string): Promise<boolean> {
  let etaitLa = false
  await update<PinEnAttente[]>(CLE, (pins) => {
    etaitLa = (pins ?? []).some((x) => x.id === id)
    return (pins ?? []).filter((x) => x.id !== id)
  })
  return etaitLa
}

// Refusé par le serveur : marqué seulement s'il est encore là (jamais ressuscité).
export async function marquerRefuse(id: string): Promise<boolean> {
  let etaitLa = false
  await update<PinEnAttente[]>(CLE, (pins) => {
    etaitLa = (pins ?? []).some((x) => x.id === id)
    return (pins ?? []).map((x) => (x.id === id ? { ...x, refuse: true as const } : x))
  })
  return etaitLa
}
