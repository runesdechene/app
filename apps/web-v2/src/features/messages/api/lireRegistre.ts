/**
 * QUOI     — la forme d'un message du Registre, lue depuis le JSON de la migration 371 (son canal :
 *            le général, les bugs, ou une Compagnie, migration 422) ; et celle
 *            d'une arrivée (quelqu'un a rejoint EXPLORE), migrations 408 et 411.
 * POURQUOI — rien n'est supposé : un canal ou un passage inconnu est refusé, pas deviné.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Canal = string // 'general', 'bugs', ou l'id d'une Compagnie (mig 422)
export type Message = {
  id: number
  canal: Canal
  canalNom: string | null // une Compagnie : son nom et sa couleur
  canalCouleur: string | null
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

export const CANAUX_FIXES: readonly Canal[] = ['general', 'bugs']

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
    canal: chaine(m.canal),
    // Absents avant la migration 422 : le général et les bugs n'en ont pas.
    canalNom: ouNull(chaine)(m.canalNom ?? null),
    canalCouleur: ouNull(chaine)(m.canalCouleur ?? null),
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
