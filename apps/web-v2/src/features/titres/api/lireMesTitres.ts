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
export type MesTitres = {
  obtenus: number
  total: number
  chemins: Chemin[]
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

export function lireMesTitres(v: unknown): MesTitres {
  const o = objet(v)
  return {
    obtenus: nombre(o.obtenus),
    total: nombre(o.total),
    // Les connaissances (cultures, Polymathe) ne sont pas des titres : des gélules du profil (452).
    chemins: liste(chemin)(o.chemins),
  }
}
