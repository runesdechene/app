/**
 * QUOI     — un Actif de la carte, lu depuis `actifs_carte` (migration 402) : un Explorateur vu
 *            depuis moins d'une heure, sa position (déjà brouillée par la base s'il le veut) et ce
 *            que sa carte affiche.
 * POURQUOI — `brouille` dit que la position est approchée : la carte dessine une zone, la
 *            distance s'écrit « ~ ». `enLigne` : vu depuis moins de dix minutes.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Actif = {
  id: string
  nom: string
  avatar: string | null
  niveau: number
  titre: string | null
  signe: { nom: string; imageUrl: string } | null
  lat: number
  lng: number
  brouille: boolean
  vuA: string
  enLigne: boolean
}

function lireSigne(v: unknown) {
  const s = objet(v)
  return { nom: chaine(s.nom), imageUrl: chaine(s.imageUrl) }
}

export const lireActifs = liste((v): Actif => {
  const a = objet(v)
  return {
    id: chaine(a.id),
    nom: chaine(a.nom),
    avatar: ouNull(chaine)(a.avatar),
    niveau: nombre(a.niveau),
    titre: ouNull(chaine)(a.titre),
    signe: ouNull(lireSigne)(a.signe),
    lat: nombre(a.lat),
    lng: nombre(a.lng),
    brouille: booleen(a.brouille),
    vuA: chaine(a.vuA),
    enLigne: booleen(a.enLigne),
  }
})
