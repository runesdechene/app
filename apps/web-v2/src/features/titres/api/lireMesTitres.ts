/**
 * QUOI     — mes titres, lus depuis `get_mes_titres` (migrations 430, 433) : le compte et les
 *            chemins vivants (chaque titre, son seuil, obtenu ou non, porté ou non).
 * POURQUOI — la base décide ce qui est obtenu (la même règle que get_user_titles) : le front ne
 *            recalcule jamais un seuil.
 */
import { booleen, chaine, liste, nombre, objet } from '@/shared/lib/lire'

export type TitreDuChemin = {
  id: number
  nom: string
  min: number
  obtenu: boolean
  porte: boolean
}
export type Chemin = { stat: string; compteur: number; titres: TitreDuChemin[] }
// Une culture des énigmes : ses titres de connaissance, comptés en points (migration 442).
export type CultureDeTitres = { id: string; nom: string; chemin: Chemin }
export type MesTitres = {
  obtenus: number
  total: number
  chemins: Chemin[]
  cultures: CultureDeTitres[]
  polymathe: Chemin | null
}

function titreDuChemin(v: unknown): TitreDuChemin {
  const o = objet(v)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    min: nombre(o.min),
    obtenu: booleen(o.obtenu),
    porte: booleen(o.porte),
  }
}

function chemin(v: unknown): Chemin {
  const o = objet(v)
  return {
    stat: chaine(o.stat),
    compteur: nombre(o.compteur),
    titres: liste(titreDuChemin)(o.titres),
  }
}

function cultureDeTitres(v: unknown): CultureDeTitres {
  const o = objet(v)
  return {
    id: chaine(o.id),
    nom: chaine(o.nom),
    chemin: { stat: 'connaissance', compteur: nombre(o.points), titres: liste(titreDuChemin)(o.titres) },
  }
}

// Polymathe : un seul titre, gagné en étant Sage dans trois cultures.
function polymathe(v: unknown): Chemin {
  const o = objet(v)
  return {
    stat: 'polymathe',
    compteur: nombre(o.compteur),
    titres: [
      { id: nombre(o.id), nom: chaine(o.nom), min: 3, obtenu: booleen(o.obtenu), porte: booleen(o.porte) },
    ],
  }
}

export function lireMesTitres(v: unknown): MesTitres {
  const o = objet(v)
  return {
    obtenus: nombre(o.obtenus),
    total: nombre(o.total),
    chemins: liste(chemin)(o.chemins),
    // Le front déployé avant la migration 442 doit lire l'ancienne forme : d'où `undefined`.
    cultures: o.cultures === undefined ? [] : liste(cultureDeTitres)(o.cultures),
    polymathe: o.polymathe === undefined || o.polymathe === null ? null : polymathe(o.polymathe),
  }
}
