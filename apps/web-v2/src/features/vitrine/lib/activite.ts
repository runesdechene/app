/**
 * QUOI     — la phrase d'une activité récente, pour un visiteur : « Un Compagnon vient de
 *            découvrir Fort des Têtes ».
 * POURQUOI — anonyme : la vitrine ne dit jamais qui ; elle prouve que la carte vit. « Compagnon »
 *            plutôt qu'« Explorateur » (Uriel, 30/09) : pour le visiteur, un futur pote de route.
 */
import type { Activite } from '../api/lireVitrine'

const VERBES: Record<Activite['sorte'], string> = {
  decouverte: 'vient de découvrir',
  visite: 'vient de visiter',
  ajout: 'vient d’ajouter',
}

export function phraseActivite(a: Activite) {
  return { debut: `Un Compagnon ${VERBES[a.sorte]} `, lieu: a.lieu }
}
