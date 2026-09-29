/**
 * QUOI     — les notifications rangées par moment : « Aujourd’hui », « Cette semaine », « Plus tôt ».
 * POURQUOI — la maquette les groupe ainsi : on retrouve d'un coup d'œil ce qui est frais.
 *            Une rubrique vide ne s'affiche pas.
 */
import type { Notification } from '../api/lireNotifications'

const JOUR = 24 * 60 * 60 * 1000

export function parMoment(notifications: Notification[], maintenant = new Date()) {
  const minuit = new Date(maintenant)
  minuit.setHours(0, 0, 0, 0)
  const semaine = minuit.getTime() - 6 * JOUR
  const rubriques = [
    { titre: 'Aujourd’hui', liste: [] as Notification[] },
    { titre: 'Cette semaine', liste: [] as Notification[] },
    { titre: 'Plus tôt', liste: [] as Notification[] },
  ]
  for (const n of notifications) {
    const quand = new Date(n.quand).getTime()
    const rang = quand >= minuit.getTime() ? 0 : quand >= semaine ? 1 : 2
    rubriques[rang]?.liste.push(n)
  }
  return rubriques.filter((r) => r.liste.length > 0)
}
