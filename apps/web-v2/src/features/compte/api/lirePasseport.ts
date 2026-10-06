/**
 * QUOI     — la forme du passeport d'un Explorateur, et sa lecture depuis le JSON de la base.
 * POURQUOI — `get_passeport` (migration 431) renvoie toutes les natures et un tampon par lieu
 *            visité. Un tampon illisible est écarté plutôt que de faire tomber le passeport.
 * ATTENTION — `quand` est « AAAA-MM-JJ » ; pour le profil d'un autre, c'est le 1er du mois
 *            (`auJour` faux) : le jour exact ne quitte jamais la base.
 */
import { booleen, chaine, liste, objet, ouNull } from '@/shared/lib/lire'

export type Nature = { id: string; nom: string; icone: string; couleur: string }
export type Tampon = {
  id: string
  nom: string
  imageUrl: string | null
  nature: string | null
  departement: string | null
  pays: string | null
  quand: string
}
export type Passeport = { auJour: boolean; natures: Nature[]; tampons: Tampon[] }

const DATE = /^\d{4}-\d{2}-\d{2}$/

function nature(v: unknown): Nature {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), icone: chaine(o.icone), couleur: chaine(o.couleur) }
}

function tampon(v: unknown): Tampon | null {
  try {
    const o = objet(v)
    const quand = chaine(o.quand)
    if (!DATE.test(quand)) return null
    return {
      id: chaine(o.id),
      nom: chaine(o.nom),
      imageUrl: ouNull(chaine)(o.imageUrl),
      nature: ouNull(chaine)(o.nature),
      departement: ouNull(chaine)(o.departement),
      pays: ouNull(chaine)(o.pays),
      quand,
    }
  } catch {
    return null
  }
}

export function lirePasseport(json: unknown): Passeport | null {
  if (json === null) return null
  try {
    const o = objet(json)
    return {
      auJour: booleen(o.auJour),
      natures: liste(nature)(o.natures),
      tampons: liste(tampon)(o.tampons).filter((t): t is Tampon => t !== null),
    }
  } catch {
    return null
  }
}
