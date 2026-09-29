/**
 * QUOI     — la forme des Notifications lues depuis la migration 386.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Notification = {
  id: number
  type: string
  quand: string
  lu: boolean
  qui: Personne | null
  lieu: { id: string; nom: string } | null
  nombre: number | null
  extrait: string | null
  evenement: string | null
}

function lirePersonne(v: unknown): Personne {
  const p = objet(v)
  return { id: chaine(p.id), nom: chaine(p.nom), avatar: ouNull(chaine)(p.avatar) }
}

function lireLieu(v: unknown) {
  const l = objet(v)
  return { id: chaine(l.id), nom: chaine(l.nom) }
}

export const lireNotifications = liste((v): Notification => {
  const n = objet(v)
  return {
    id: nombre(n.id),
    type: chaine(n.type),
    quand: chaine(n.quand),
    lu: booleen(n.lu),
    qui: ouNull(lirePersonne)(n.qui),
    lieu: ouNull(lireLieu)(n.lieu),
    nombre: ouNull(nombre)(n.nombre),
    extrait: ouNull(chaine)(n.extrait),
    evenement: ouNull(chaine)(n.evenement),
  }
})
