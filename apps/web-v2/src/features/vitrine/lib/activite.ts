/**
 * QUOI     — la phrase d'une activité récente, pour un visiteur : « Un Explorateur vient de
 *            découvrir Fort des Têtes ».
 * POURQUOI — anonyme : la vitrine ne dit jamais qui ; elle prouve que la carte vit.
 */
import type { Activite } from '../api/lireVitrine'

const VERBES: Record<Activite['sorte'], string> = {
  decouverte: 'vient de découvrir',
  visite: 'vient de visiter',
  ajout: 'vient d’ajouter',
}

export function phraseActivite(a: Activite) {
  return { debut: `Un Explorateur ${VERBES[a.sorte]} `, lieu: a.lieu }
}
