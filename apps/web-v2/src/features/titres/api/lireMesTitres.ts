/**
 * QUOI     — mes titres, lus depuis `get_mes_titres` (migration 430) : le compte, les chemins
 *            vivants (chaque titre, son seuil, obtenu ou non, porté ou non), et les titres gagnés
 *            sur un chemin refermé (« D'une autre époque »).
 * POURQUOI — la base décide ce qui est obtenu (la même règle que get_user_titles) : le front ne
 *            recalcule jamais un seuil.
 */
import { lireCondition, type ConditionTitre } from '@/shared/lib/conditionTitre'
import { booleen, chaine, liste, nombre, objet } from '@/shared/lib/lire'

export type TitreDuChemin = {
  id: number
  nom: string
  min: number
  obtenu: boolean
  porte: boolean
}
export type Chemin = { stat: string; compteur: number; titres: TitreDuChemin[] }
export type TitreAncien = {
  id: number
  nom: string
  condition: ConditionTitre | null
  porte: boolean
}
export type MesTitres = {
  obtenus: number
  total: number
  chemins: Chemin[]
  autreEpoque: TitreAncien[]
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

function titreAncien(v: unknown): TitreAncien {
  const o = objet(v)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    condition: lireCondition(o.condition),
    porte: booleen(o.porte),
  }
}

export function lireMesTitres(v: unknown): MesTitres {
  const o = objet(v)
  return {
    obtenus: nombre(o.obtenus),
    total: nombre(o.total),
    chemins: liste(chemin)(o.chemins),
    autreEpoque: liste(titreAncien)(o.autreEpoque),
  }
}
