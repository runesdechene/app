/**
 * QUOI     — un cœur de plus sur un mot du Carnet, dans le carnet déjà lu (réponses comprises).
 * POURQUOI — le cœur compte tout de suite (mise à jour optimiste), comme sur les chemins et sur un
 *            lieu ; la base fait foi au retour du dernier envoi de la rafale.
 */
import type { Carnet, Mot } from '../api/lireLieu'

function plusUn(mot: Mot, id: number): Mot {
  if (mot.id === id) return { ...mot, coeurs: mot.coeurs + 1, miens: mot.miens + 1 }
  return { ...mot, reponses: mot.reponses.map((r) => plusUn(r, id)) }
}

export function coeurDePlus(carnet: Carnet, id: number): Carnet {
  return { ...carnet, mots: carnet.mots.map((m) => plusUn(m, id)) }
}
