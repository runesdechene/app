/**
 * QUOI     — les pins posés et pas encore envoyés au serveur.
 * POURQUOI — Uriel, 06/10 : le pin se pose sans réseau, « c'est tout l'intérêt ». Il naît ici
 *            (IndexedDB, comme le brouillon de lieu) avec son id et sa date, puis part au serveur
 *            (`envoyer.ts`) ; le serveur l'accepte une seule fois par id.
 * ATTENTION — garder et retirer passent par `update` (une transaction), jamais lire puis écrire.
 *            Si le navigateur efface ses données avant l'envoi, le pin est perdu (accepté, spec).
 */
import { get, update } from 'idb-keyval'

export type PinEnAttente = {
  id: string
  latitude: number
  longitude: number
  precision: number // mètres
  poseLe: string // ISO 8601, l'heure du téléphone
  refuse?: true // refusé par le serveur (heure ou précision impossibles) : ne repart plus
}

const CLE = 'runes-de-chene/pins-en-attente'

export async function lirePinsEnAttente(): Promise<PinEnAttente[]> {
  try {
    return (await get<PinEnAttente[]>(CLE)) ?? []
  } catch {
    return [] // navigation privée, stockage refusé
  }
}

// `update` lit et écrit dans une seule transaction : un pin posé pendant qu'un envoi se termine
// ne peut pas être écrasé par une liste lue plus tôt.
export async function garderPinEnAttente(p: PinEnAttente): Promise<void> {
  await update<PinEnAttente[]>(CLE, (pins) => [...(pins ?? []).filter((x) => x.id !== p.id), p])
}

export async function retirerPinEnAttente(id: string): Promise<void> {
  await update<PinEnAttente[]>(CLE, (pins) => (pins ?? []).filter((x) => x.id !== id))
}
