/**
 * QUOI     — allumer ou éteindre mon cœur sur un mot du Carnet, dans le carnet déjà lu (réponses
 *            comprises).
 * POURQUOI — un cœur par personne sur un mot (Uriel, 30/09 : « mono like ») ; il bascule tout de
 *            suite à l'écran (mise à jour optimiste), la base fait foi au retour.
 */
import type { Carnet, Mot } from '../api/lireLieu'

function basculer(mot: Mot, id: number): Mot {
  if (mot.id === id) {
    const aime = mot.miens > 0
    return { ...mot, coeurs: mot.coeurs + (aime ? -1 : 1), miens: aime ? 0 : 1 }
  }
  return { ...mot, reponses: mot.reponses.map((r) => basculer(r, id)) }
}

export function basculerCoeur(carnet: Carnet, id: number): Carnet {
  return { ...carnet, mots: carnet.mots.map((m) => basculer(m, id)) }
}
