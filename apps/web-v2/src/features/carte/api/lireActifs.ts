/**
 * QUOI     — un Actif de la carte, lu depuis `actifs_carte` (migration 402) : un Explorateur vu
 *            depuis moins d'une heure, sa position (déjà brouillée par la base s'il le veut) et ce
 *            que sa carte affiche.
 * POURQUOI — `brouille` dit que la position est approchée : la carte dessine une zone, la
 *            distance s'écrit « ~ ». `enLigne` : vu depuis moins de dix minutes.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

// Ce que la carte d'un Explorateur affiche : un Actif (ici), ou qui tient un territoire (lireCarte).
export type Explorateur = {
  id: string
  nom: string
  avatar: string | null
  niveau: number
  titre: string | null
  // Un Fragment sans illustration garde son nom (« sous le signe de… »), sans filigrane.
  signe: { nom: string; imageUrl: string | null } | null
}

export type Actif = Explorateur & {
  lat: number
  lng: number
  brouille: boolean
  vuA: string
  enLigne: boolean
}

function lireSigne(v: unknown) {
  const s = objet(v)
  return { nom: chaine(s.nom), imageUrl: ouNull(chaine)(s.imageUrl) }
}

export function lireExplorateur(v: unknown): Explorateur {
  const e = objet(v)
  return {
    id: chaine(e.id),
    nom: chaine(e.nom),
    avatar: ouNull(chaine)(e.avatar),
    niveau: nombre(e.niveau),
    titre: ouNull(chaine)(e.titre),
    signe: ouNull(lireSigne)(e.signe),
  }
}

export const lireActifs = liste((v): Actif => {
  const a = objet(v)
  return {
    ...lireExplorateur(a),
    lat: nombre(a.lat),
    lng: nombre(a.lng),
    brouille: booleen(a.brouille),
    vuA: chaine(a.vuA),
    enLigne: booleen(a.enLigne),
  }
})
