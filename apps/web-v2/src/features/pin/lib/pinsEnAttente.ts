/**
 * QUOI     — les pins posés et pas encore envoyés au serveur.
 * POURQUOI — Uriel, 06/10 : le pin se pose sans réseau, « c'est tout l'intérêt ». Il naît ici
 *            (IndexedDB, comme le brouillon de lieu) avec son id et sa date, puis part au serveur
 *            (`envoyer.ts`) ; le serveur l'accepte une seule fois par id.
 * ATTENTION — si le navigateur efface ses données avant l'envoi, le pin est perdu (accepté, spec).
 */
import { get, set } from 'idb-keyval'

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

export async function garderPinEnAttente(p: PinEnAttente): Promise<void> {
  const pins = await lirePinsEnAttente()
  await set(CLE, [...pins.filter((x) => x.id !== p.id), p])
}

export async function retirerPinEnAttente(id: string): Promise<void> {
  const pins = await lirePinsEnAttente()
  await set(CLE, pins.filter((x) => x.id !== id))
}
