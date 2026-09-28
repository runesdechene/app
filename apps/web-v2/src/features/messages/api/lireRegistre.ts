/**
 * QUOI     — la forme d'un message du Registre, lue depuis le JSON de la migration 371.
 * POURQUOI — rien n'est supposé : un canal inconnu est refusé, pas deviné.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Canal = 'general' | 'bugs'
export type Message = {
  id: number
  canal: Canal
  texte: string
  quand: string
  auteur: { id: string; nom: string; avatar: string | null }
  moi: boolean
}

export const CANAUX: readonly Canal[] = ['general', 'bugs']

function canal(v: unknown): Canal {
  const c = CANAUX.find((x) => x === v)
  if (!c) throw new Error('canal inconnu')
  return c
}

function lireMessage(v: unknown): Message {
  const m = objet(v)
  const a = objet(m.auteur)
  return {
    id: nombre(m.id),
    canal: canal(m.canal),
    texte: chaine(m.texte),
    quand: chaine(m.quand),
    auteur: { id: chaine(a.id), nom: chaine(a.nom), avatar: ouNull(chaine)(a.avatar) },
    moi: booleen(m.moi),
  }
}

export const lireRegistre = liste(lireMessage)
