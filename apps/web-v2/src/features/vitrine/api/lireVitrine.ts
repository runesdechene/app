/**
 * QUOI     — la forme de ce que la vitrine lit, sans compte (migration 391, get_landing_stats) :
 *            les deux chiffres, les natures, une recherche, l'activité récente, l'aperçu d'un lieu.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Chiffres = { lieux: number; explorateurs: number }
export type Nature = { id: string; nom: string; icone: string | null; couleur: string | null }
export type NatureComptee = Nature & { nombre: number }
export type LieuTrouve = {
  id: string
  nom: string
  region: string | null
  nature: Nature | null
  vignette: string | null
}
export type Resultats = { total: number; lieux: LieuTrouve[] }
export type Activite = {
  sorte: 'decouverte' | 'visite' | 'ajout'
  quand: string
  lieu: { id: string; nom: string }
}
export type Apercu = {
  id: string
  nom: string
  region: string | null
  nature: Nature | null
  epoque: string | null
  photo: string | null
  photos: number
  explorateurs: number
  extrait: string | null
  suite: boolean
}

export function lireChiffres(json: unknown): Chiffres {
  const [ligne] = liste(objet)(json)
  if (!ligne) throw new Error('chiffres absents')
  return { lieux: nombre(ligne.total_places), explorateurs: nombre(ligne.total_users) }
}

function lireNature(v: unknown): Nature {
  const n = objet(v)
  return {
    id: chaine(n.id),
    nom: chaine(n.nom),
    icone: ouNull(chaine)(n.icone),
    couleur: ouNull(chaine)(n.couleur),
  }
}

export const lireNatures = liste((v): NatureComptee => ({
  ...lireNature(v),
  nombre: nombre(objet(v).nombre),
}))

export function lireResultats(json: unknown): Resultats {
  const r = objet(json)
  return {
    total: nombre(r.total),
    lieux: liste((v): LieuTrouve => {
      const l = objet(v)
      return {
        id: chaine(l.id),
        nom: chaine(l.nom),
        region: ouNull(chaine)(l.region),
        nature: ouNull(lireNature)(l.nature),
        vignette: ouNull(chaine)(l.vignette),
      }
    })(r.lieux),
  }
}

const SORTES = ['decouverte', 'visite', 'ajout'] as const
function sorte(v: unknown): Activite['sorte'] {
  const s = chaine(v)
  const connue = SORTES.find((x) => x === s)
  if (!connue) throw new Error(`sorte inconnue : ${s}`)
  return connue
}

export const lireActivite = liste((v): Activite => {
  const a = objet(v)
  const lieu = objet(a.lieu)
  return {
    sorte: sorte(a.sorte),
    quand: chaine(a.quand),
    lieu: { id: chaine(lieu.id), nom: chaine(lieu.nom) },
  }
})

export function lireApercu(json: unknown): Apercu | null {
  if (json === null) return null
  const a = objet(json)
  return {
    id: chaine(a.id),
    nom: chaine(a.nom),
    region: ouNull(chaine)(a.region),
    nature: ouNull(lireNature)(a.nature),
    epoque: ouNull(chaine)(a.epoque),
    photo: ouNull(chaine)(a.photo),
    photos: nombre(a.photos),
    explorateurs: nombre(a.explorateurs),
    extrait: ouNull(chaine)(a.extrait),
    suite: booleen(a.suite),
  }
}
