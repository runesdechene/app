/**
 * QUOI     — la forme des blocs de l'Accueil, lus depuis le JSON de la migration 368 : les lieux
 *            ajoutés récemment, le fil « Sur les chemins ».
 * POURQUOI — rien n'est supposé : chaque champ est prouvé. Les lieux prennent la forme des
 *            cartes de lieu partagées (`LieuDeCarte`).
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import type { LieuDeCarte } from '@/shared/ui/LieuCarte'

export type TypeDeChemin = 'visite' | 'ajout' | 'arrivee'
export type Chemin = {
  id: string // la ligne, telle que la base la connaît pour les saluts
  type: TypeDeChemin
  quand: string
  qui: { id: string; nom: string; avatar: string | null }
  lieu: { id: string; nom: string; region: string | null } | null
  moi: boolean // ma propre ligne : pas de salut possible
  saluts: number
  salue: boolean
}

const TYPES: readonly TypeDeChemin[] = ['visite', 'ajout', 'arrivee']

function typeDeChemin(v: unknown): TypeDeChemin {
  const t = TYPES.find((type) => type === v)
  if (!t) throw new Error('type de chemin inconnu')
  return t
}

function lireLieuDeCarte(v: unknown): LieuDeCarte {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    imageUrl: ouNull(chaine)(l.imageUrl),
    latitude: ouNull(nombre)(l.latitude),
    longitude: ouNull(nombre)(l.longitude),
    categorie: ouNull((c) => ({ icone: chaine(objet(c).icone) }))(l.categorie),
    auteur: ouNull((a) => ({
      nom: chaine(objet(a).nom),
      avatarUrl: ouNull(chaine)(objet(a).avatarUrl),
    }))(l.auteur),
  }
}

export const lireAjoutes = liste(lireLieuDeCarte)

function lireChemin(v: unknown): Chemin {
  const c = objet(v)
  const qui = objet(c.qui)
  return {
    id: chaine(c.id),
    type: typeDeChemin(c.type),
    quand: chaine(c.quand),
    qui: { id: chaine(qui.id), nom: chaine(qui.nom), avatar: ouNull(chaine)(qui.avatar) },
    lieu: ouNull((l) => {
      const lieu = objet(l)
      return { id: chaine(lieu.id), nom: chaine(lieu.nom), region: ouNull(chaine)(lieu.region) }
    })(c.lieu),
    moi: booleen(c.moi),
    saluts: nombre(c.saluts),
    salue: booleen(c.salue),
  }
}

export const lireChemins = liste(lireChemin)

export function lireSalut(json: unknown) {
  const s = objet(json)
  return { saluts: nombre(s.saluts), salue: booleen(s.salue) }
}
