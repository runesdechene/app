/**
 * QUOI     — la forme d'un lieu sur la carte et du territoire sous son centre, lues depuis le
 *            JSON de `carte_lieux` et `territoire_en` (migration 363).
 * POURQUOI — l'état et la nature se lisent par liste blanche : une valeur que la base ajoutera
 *            demain s'affiche comme « inconnu » ou « lieu », jamais comme une carte vide.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type EtatLieu = 'inconnu' | 'connu' | 'visite'

export type LieuCarte = {
  id: string
  nom: string
  lat: number
  lng: number
  nature: 'lieu' | 'curiosite'
  icone: string | null
  couleur: string | null
  etat: EtatLieu
  revendication: { nom: string; moi: boolean } | null
}

export type Territoire = { territoire: string | null; pays: string | null }

// Un Explorateur trouvé par la recherche de la carte (chercher_explorateurs, migration 373).
export type ExplorateurTrouve = { id: string; nom: string; avatar: string | null }

function lireEtat(v: unknown): EtatLieu {
  return v === 'connu' || v === 'visite' ? v : 'inconnu'
}

function lireRevendication(v: unknown) {
  const r = objet(v)
  return { nom: chaine(r.nom), moi: booleen(r.moi) }
}

function lireLieu(v: unknown): LieuCarte {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    lat: nombre(l.lat),
    lng: nombre(l.lng),
    nature: l.nature === 'curiosite' ? 'curiosite' : 'lieu',
    icone: ouNull(chaine)(l.icone),
    couleur: ouNull(chaine)(l.couleur),
    etat: lireEtat(l.etat),
    revendication: ouNull(lireRevendication)(l.revendication),
  }
}

export function lireLieux(json: unknown): LieuCarte[] {
  return liste(lireLieu)(json)
}

export function lireTerritoire(json: unknown): Territoire {
  const t = objet(json)
  return { territoire: ouNull(chaine)(t.territoire), pays: ouNull(chaine)(t.pays) }
}

export const lireExplorateurs = liste((v): ExplorateurTrouve => {
  const e = objet(v)
  return { id: chaine(e.id), nom: chaine(e.nom), avatar: ouNull(chaine)(e.avatar) }
})
