/**
 * QUOI     — la forme d'une Compagnie, de la liste et de la fiche, lues depuis le JSON des
 *            migrations 421 et 422.
 * POURQUOI — rien n'est supposé : un rôle inconnu est refusé ; une fiche introuvable vaut null.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import { lireLieuDeCarte } from '@/shared/lib/lieuDeCarte'
import type { LieuDeCarte } from '@/shared/ui/LieuCarte'

export type Role = 'chef' | 'officier' | 'membre'
export type CarteCompagnie = {
  id: string
  nom: string
  devise: string | null
  couleur: string
  avatar: string | null
  privee: boolean
  membres: number
  role: Role | null // ma place ; null : je n'en suis pas
  demandee: boolean // j'ai demandé à rejoindre (Compagnie privée)
}
export type ListeCompagnies = {
  porteur: boolean // je peux fonder
  miennes: CarteCompagnie[]
  autres: CarteCompagnie[]
}
export type Roles = { chefM: string; chefF: string; officierM: string; officierF: string }
// Ce qu'on écrit en fondant ou en gérant : la fiche d'une Compagnie.
export type ChampsFiche = {
  nom: string
  devise: string
  mission: string
  couleur: string
  avatar: string | null
  privee: boolean
}
export type Membre = {
  id: string
  nom: string
  avatar: string | null
  role: Role
  genre: 'm' | 'f'
  niveau: number
  titre: string | null // le premier titre qu'il porte (migration 435)
}
export type FicheCompagnie = {
  id: string
  nom: string
  devise: string | null
  mission: string | null
  couleur: string
  avatar: string | null
  privee: boolean
  fondeeLe: string
  roles: Roles
  monRole: Role | null
  demandee: boolean
  nbMembres: number
  // Vide pour qui n'est pas d'une Compagnie privée (migration 434) : seul le nombre se voit.
  membres: Membre[]
  lieux: (LieuDeCarte & { quand: string })[] // en cartes ; l'auteur est qui l'a revendiqué (mig 438)
  demandes: { id: string; nom: string; avatar: string | null; mot: string | null; quand: string }[]
}

const ROLES: readonly Role[] = ['chef', 'officier', 'membre']

function role(v: unknown): Role {
  const r = ROLES.find((x) => x === v)
  if (r === undefined) throw new Error('rôle inconnu')
  return r
}

function lireCarte(v: unknown): CarteCompagnie {
  const c = objet(v)
  return {
    id: chaine(c.id),
    nom: chaine(c.nom),
    devise: ouNull(chaine)(c.devise),
    couleur: chaine(c.couleur),
    avatar: ouNull(chaine)(c.avatar),
    privee: booleen(c.privee),
    membres: nombre(c.membres),
    role: ouNull(role)(c.role),
    demandee: booleen(c.demandee),
  }
}

export function lireListe(json: unknown): ListeCompagnies {
  const l = objet(json)
  return {
    porteur: booleen(l.porteur),
    miennes: liste(lireCarte)(l.miennes),
    autres: liste(lireCarte)(l.autres),
  }
}

export function lireFicheCompagnie(json: unknown): FicheCompagnie | null {
  if (json === null) return null
  const f = objet(json)
  const r = objet(f.roles)
  return {
    id: chaine(f.id),
    nom: chaine(f.nom),
    devise: ouNull(chaine)(f.devise),
    mission: ouNull(chaine)(f.mission),
    couleur: chaine(f.couleur),
    avatar: ouNull(chaine)(f.avatar),
    privee: booleen(f.privee),
    fondeeLe: chaine(f.fondeeLe),
    roles: {
      chefM: chaine(r.chefM),
      chefF: chaine(r.chefF),
      officierM: chaine(r.officierM),
      officierF: chaine(r.officierF),
    },
    monRole: ouNull(role)(f.monRole),
    demandee: booleen(f.demandee),
    nbMembres: nombre(f.nbMembres),
    membres: liste((v): Membre => {
      const m = objet(v)
      return {
        id: chaine(m.id),
        nom: chaine(m.nom),
        avatar: ouNull(chaine)(m.avatar),
        role: role(m.role),
        genre: m.genre === 'f' ? 'f' : 'm',
        niveau: nombre(m.niveau),
        titre: ouNull(chaine)(m.titre),
      }
    })(f.membres),
    lieux: liste((v) => ({ ...lireLieuDeCarte(v), quand: chaine(objet(v).quand) }))(f.lieux),
    demandes: liste((v) => {
      const d = objet(v)
      return {
        id: chaine(d.id),
        nom: chaine(d.nom),
        avatar: ouNull(chaine)(d.avatar),
        mot: ouNull(chaine)(d.mot),
        quand: chaine(d.quand),
      }
    })(f.demandes),
  }
}
