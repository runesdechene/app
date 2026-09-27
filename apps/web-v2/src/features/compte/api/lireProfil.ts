/**
 * QUOI     — la forme d'un profil d'Explorateur, et sa lecture depuis le JSON de la base.
 * POURQUOI — `get_profil_explorateur` renvoie du JSON (type `Json` : n'importe quoi pour le
 *            compilateur). On vérifie chaque champ au lieu de le « caster » : un profil mal formé
 *            devient `null` (« introuvable ») plutôt qu'un écran à trous.
 * ATTENTION — la forme suit les migrations 354-356. Un champ ajouté là-bas s'ajoute ici.
 */
import type { ConditionTitre } from '../lib/conditionTitre'
import { booleen, chaine, liste, nombre, objet, ouNull } from './lire'

export type Lieu = { id: string; nom: string; imageUrl: string | null }
export type Titre = { id: number; nom: string }
export type TitrePorte = Titre & { condition: ConditionTitre | null }
export type Signe = { id: number; nom: string; imageUrl: string | null }
export type Fragment = { id: number; nom: string; imageUrl: string | null }

export type ExplorateurProfile = {
  id: string
  nom: string
  avatarUrl: string | null
  niveau: number
  titres: TitrePorte[]
  bio: string | null
  instagram: string | null
  inscritLe: string
  porteurVerifie: boolean
  role: 'admin' | 'moderator' | null
  attache: string | null
  fragments: Fragment[]
  ajoutes: Lieu[]
  visites: Lieu[]
  envies: Lieu[] | null
  signe: Signe | null
  estMoi: boolean
}

// Chaque lecteur (lire.ts) rend la valeur ou lève une erreur, que lireProfil change en `null`.
function lieu(v: unknown): Lieu {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), imageUrl: ouNull(chaine)(o.imageUrl) }
}

function titre(v: unknown): TitrePorte {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), condition: condition(o.condition) }
}

// Une condition illisible ne fait pas tomber le profil : le titre s'affiche, son origine se
// dit alors « Gagné en jouant ».
function condition(v: unknown): ConditionTitre | null {
  try {
    const o = objet(v)
    return { stat: chaine(o.stat), min: nombre(o.min) }
  } catch {
    return null
  }
}

function signe(v: unknown): Signe {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), imageUrl: ouNull(chaine)(o.imageUrl) }
}

function fragment(v: unknown): Fragment {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), imageUrl: ouNull(chaine)(o.imageUrl) }
}

function role(v: unknown): 'admin' | 'moderator' | null {
  return v === 'admin' || v === 'moderator' ? v : null
}

export function lireProfil(json: unknown): ExplorateurProfile | null {
  if (json === null) return null
  try {
    const o = objet(json)
    return {
      id: chaine(o.id),
      nom: chaine(o.nom),
      avatarUrl: ouNull(chaine)(o.avatarUrl),
      niveau: nombre(o.niveau),
      titres: liste(titre)(o.titres),
      bio: ouNull(chaine)(o.bio),
      instagram: ouNull(chaine)(o.instagram),
      inscritLe: chaine(o.inscritLe),
      porteurVerifie: booleen(o.porteurVerifie),
      role: role(o.role),
      attache: ouNull(chaine)(o.attache),
      fragments: liste(fragment)(o.fragments),
      ajoutes: liste(lieu)(o.ajoutes),
      visites: liste(lieu)(o.visites),
      envies: ouNull(liste(lieu))(o.envies),
      signe: ouNull(signe)(o.signe),
      estMoi: booleen(o.estMoi),
    }
  } catch {
    return null
  }
}
