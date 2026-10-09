/**
 * QUOI     — la forme des Murmures lus depuis la migration 372 : la liste des correspondants,
 *            une conversation, l'en-tête d'un correspondant.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Fil = {
  avec: Personne
  dernier: { texte: string; quand: string; deMoi: boolean }
  nonLus: number
}
export type Murmure = {
  id: number
  texte: string
  quand: string
  deMoi: boolean
  luLe: string | null
}
export type Correspondant = Personne & { derniereConnexion: string | null; region: string | null }

function lirePersonne(v: unknown): Personne {
  const p = objet(v)
  return { id: chaine(p.id), nom: chaine(p.nom), avatar: ouNull(chaine)(p.avatar) }
}

export const lireFils = liste((v): Fil => {
  const f = objet(v)
  const d = objet(f.dernier)
  return {
    avec: lirePersonne(f.avec),
    dernier: { texte: chaine(d.texte), quand: chaine(d.quand), deMoi: booleen(d.deMoi) },
    nonLus: nombre(f.nonLus),
  }
})

export const lireConversation = liste((v): Murmure => {
  const m = objet(v)
  return {
    id: nombre(m.id),
    texte: chaine(m.texte),
    quand: chaine(m.quand),
    deMoi: booleen(m.deMoi),
    luLe: ouNull(chaine)(m.luLe),
  }
})

export function lireCorrespondant(json: unknown): Correspondant | null {
  if (json === null) return null
  const c = objet(json)
  return {
    ...lirePersonne(c),
    derniereConnexion: ouNull(chaine)(c.derniereConnexion),
    region: ouNull(chaine)(c.region),
  }
}
