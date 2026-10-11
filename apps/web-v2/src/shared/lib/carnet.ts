/**
 * QUOI     — un carnet (des mots, leurs réponses) et des cœurs, lus depuis le JSON de la base, et
 *            le cœur d'un mot qui bascule dans un carnet déjà lu.
 * POURQUOI — le Carnet de passage d'un lieu (migs 389-390) et celui d'une mise à jour (mig 478)
 *            rendent le même JSON : une seule lecture, un seul composant (`shared/ui/Carnet`).
 *            Un cœur par personne sur un mot (Uriel, 30/09 : « mono like ») : il bascule tout de
 *            suite à l'écran, la base fait foi au retour.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from './lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Mot = {
  id: number
  quand: string
  texte: string
  qui: Personne
  venu: boolean
  photos: string[]
  coeurs: number
  miens: number
  aMoi: boolean
  peutEffacer: boolean // son auteur, ou l'équipe sous une mise à jour (mig 479)
  reponses: Mot[]
}
export type Carnet = { total: number; mots: Mot[] }
export type Coeurs = { total: number; miens: number; gens: (Personne & { nombre: number })[] }

export function lirePersonne(v: unknown): Personne {
  const p = objet(v)
  return { id: chaine(p.id), nom: chaine(p.nom), avatar: ouNull(chaine)(p.avatar) }
}

function lireMot(v: unknown): Mot {
  const m = objet(v)
  return {
    id: nombre(m.id),
    quand: chaine(m.quand),
    texte: chaine(m.texte),
    qui: lirePersonne(m.qui),
    venu: booleen(m.venu),
    photos: liste(chaine)(m.photos),
    coeurs: nombre(m.coeurs),
    miens: nombre(m.miens),
    aMoi: booleen(m.aMoi),
    // Le carnet d'un lieu ne le dit pas : seul son auteur efface un mot.
    peutEffacer: booleen(m.peutEffacer ?? m.aMoi),
    reponses: m.reponses === undefined ? [] : liste(lireMot)(m.reponses),
  }
}

// null : ce qui porte le carnet (le lieu, la note) n'est pas visible.
export function lireCarnet(json: unknown): Carnet | null {
  if (json === null) return null
  const c = objet(json)
  return { total: nombre(c.total), mots: liste(lireMot)(c.mots) }
}

export function lireCoeurs(json: unknown): Coeurs | null {
  if (json === null) return null
  const c = objet(json)
  return {
    total: nombre(c.total),
    miens: nombre(c.miens),
    gens: liste((v) => ({ ...lirePersonne(v), nombre: nombre(objet(v).nombre) }))(c.gens),
  }
}

function basculer(mot: Mot, id: number): Mot {
  if (mot.id === id) {
    const aime = mot.miens > 0
    return { ...mot, coeurs: mot.coeurs + (aime ? -1 : 1), miens: aime ? 0 : 1 }
  }
  return { ...mot, reponses: mot.reponses.map((r) => basculer(r, id)) }
}

export function basculerCoeur(carnet: Carnet, id: number): Carnet {
  return { ...carnet, mots: carnet.mots.map((m) => basculer(m, id)) }
}
