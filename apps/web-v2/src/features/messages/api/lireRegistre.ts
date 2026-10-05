/**
 * QUOI     — la forme d'un message du Registre, lue depuis le JSON de la migration 371 ; et celle
 *            d'une arrivée (quelqu'un a rejoint EXPLORE), migrations 408 et 411.
 * POURQUOI — rien n'est supposé : un canal ou un passage inconnu est refusé, pas deviné.
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
  mentions: Mention[] // les Explorateurs mentionnés (@Nom), migration 373
  mentionneMoi: boolean
  coeurs: Personne[] // qui l'a aimé, un cœur par personne (migration 410)
  aime: boolean // j'en suis
}
export type Mention = { id: string; nom: string }
export type Personne = Mention & { avatar: string | null }
export type Passage = {
  id: string
  type: 'arrivee'
  quand: string
  qui: Personne
  moi: boolean
}

export const CANAUX: readonly Canal[] = ['general', 'bugs']

function canal(v: unknown): Canal {
  const c = CANAUX.find((x) => x === v)
  if (!c) throw new Error('canal inconnu')
  return c
}

function lireMention(v: unknown): Mention {
  const m = objet(v)
  return { id: chaine(m.id), nom: chaine(m.nom) }
}

function lirePersonne(v: unknown): Personne {
  return { ...lireMention(v), avatar: ouNull(chaine)(objet(v).avatar) }
}

export const lirePersonnes = liste(lirePersonne)

// Les arrivées seulement (Uriel, 05/10 : les connexions n'apportaient rien). Celles que la base
// rend encore avant la migration 411 sont laissées de côté, sans erreur.
export function lirePassages(v: unknown): Passage[] {
  return liste(objet)(v)
    .filter((p) => p.type === 'arrivee')
    .map((p) => ({
      id: chaine(p.id),
      type: 'arrivee' as const,
      quand: chaine(p.quand),
      qui: lirePersonne(p.qui),
      moi: booleen(p.moi),
    }))
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
    // Absents tant que la migration 373 n'est pas passée : aucune mention.
    mentions: Array.isArray(m.mentions) ? liste(lireMention)(m.mentions) : [],
    mentionneMoi: m.mentionneMoi === true,
    // Absents tant que la migration 410 n'est pas passée : aucun cœur.
    coeurs: Array.isArray(m.coeurs) ? lirePersonnes(m.coeurs) : [],
    aime: m.aime === true,
  }
}

export const lireRegistre = liste(lireMessage)
