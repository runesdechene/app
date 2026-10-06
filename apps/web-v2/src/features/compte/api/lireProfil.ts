/**
 * QUOI     — la forme d'un profil d'Explorateur, et sa lecture depuis le JSON de la base.
 * POURQUOI — `get_profil_explorateur` renvoie du JSON (type `Json` : n'importe quoi pour le
 *            compilateur). On vérifie chaque champ au lieu de le « caster » : un profil mal formé
 *            devient `null` (« introuvable ») plutôt qu'un écran à trous.
 * ATTENTION — la forme suit les migrations 354-362. Un champ ajouté là-bas s'ajoute ici.
 */
import { lireCondition, type ConditionTitre } from '@/shared/lib/conditionTitre'
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Categorie = { icone: string; couleur: string }
export type Auteur = { id: string; nom: string; avatarUrl: string | null }
export type Lieu = {
  id: string
  nom: string
  imageUrl: string | null
  latitude: number | null
  longitude: number | null
  categorie: Categorie | null
  auteur: Auteur | null
}
export type Titre = { id: number; nom: string }
export type TitrePorte = Titre & { condition: ConditionTitre | null }
export type Signe = { id: number; nom: string; imageUrl: string | null }
export type Fragment = { id: number; nom: string; imageUrl: string | null }
// La forme du département (ou du pays), prête pour un <path> SVG (migration 362).
export type Silhouette = { d: string; viewBox: string }
export type Attache = { texte: string; silhouette: Silhouette | null }

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
  attache: Attache | null
  fragments: Fragment[]
  ajoutes: Lieu[]
  visites: Lieu[]
  envies: Lieu[] | null
  signe: Signe | null
  fragmentsADecouvrir: number | null // sur son propre profil seulement (migration 360)
  compagnies: { id: string; nom: string; couleur: string }[] // ses Compagnies (migration 422)
  estMoi: boolean
}

// Chaque lecteur (lire.ts) rend la valeur ou lève une erreur, que lireProfil change en `null`.
function lieu(v: unknown): Lieu {
  const o = objet(v)
  return {
    id: chaine(o.id),
    nom: chaine(o.nom),
    imageUrl: ouNull(chaine)(o.imageUrl),
    latitude: facultatif(nombre, o.latitude),
    longitude: facultatif(nombre, o.longitude),
    categorie: facultatif(categorie, o.categorie),
    auteur: facultatif(auteur, o.auteur),
  }
}

// Les détails d'une carte sont facultatifs : absents ou illisibles, la carte s'affiche sans.
function facultatif<T>(lire: (v: unknown) => T, v: unknown): T | null {
  try {
    return v === null || v === undefined ? null : lire(v)
  } catch {
    return null
  }
}

function categorie(v: unknown): Categorie {
  const o = objet(v)
  return { icone: chaine(o.icone), couleur: chaine(o.couleur) }
}

function auteur(v: unknown): Auteur {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), avatarUrl: ouNull(chaine)(o.avatarUrl) }
}

function titre(v: unknown): TitrePorte {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), condition: lireCondition(o.condition) }
}

function signe(v: unknown): Signe {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), imageUrl: ouNull(chaine)(o.imageUrl) }
}

function fragment(v: unknown): Fragment {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), imageUrl: ouNull(chaine)(o.imageUrl) }
}

function attache(v: unknown): Attache {
  const o = objet(v)
  return { texte: chaine(o.texte), silhouette: ouNull(silhouette)(o.silhouette) }
}

function silhouette(v: unknown): Silhouette {
  const o = objet(v)
  return { d: chaine(o.d), viewBox: chaine(o.viewBox) }
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
      attache: ouNull(attache)(o.attache),
      fragments: liste(fragment)(o.fragments),
      ajoutes: liste(lieu)(o.ajoutes),
      visites: liste(lieu)(o.visites),
      envies: ouNull(liste(lieu))(o.envies),
      signe: ouNull(signe)(o.signe),
      fragmentsADecouvrir: facultatif(nombre, o.fragmentsADecouvrir),
      compagnies:
        o.compagnies === undefined
          ? []
          : liste((v) => {
              const c = objet(v)
              return { id: chaine(c.id), nom: chaine(c.nom), couleur: chaine(c.couleur) }
            })(o.compagnies),
      estMoi: booleen(o.estMoi),
    }
  } catch {
    return null
  }
}
