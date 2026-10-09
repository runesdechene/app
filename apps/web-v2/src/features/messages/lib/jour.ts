/**
 * QUOI     — le jour d'un message dans le Registre : « Aujourd'hui », « Hier », « Lundi 26
 *            septembre » ; et quand deux messages ne sont pas du même jour.
 * POURQUOI — sans séparateur, « 13:40 » puis « 13:34 » se suivent sans qu'on comprenne qu'il y a
 *            une nuit entre les deux (Uriel, 28/09).
 */
const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit' })

// L'heure d'une ligne du Registre, à droite : « 13:40 ».
export function heureDe(quand: string): string {
  return HEURE.format(new Date(quand))
}

function minuit(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function jourDe(quand: string, maintenant = new Date()): string {
  const ecart = Math.round((minuit(maintenant) - minuit(new Date(quand))) / (24 * 3600 * 1000))
  if (ecart === 0) return 'Aujourd’hui'
  if (ecart === 1) return 'Hier'
  const texte = DATE.format(new Date(quand))
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export function autreJour(precedent: string | undefined, quand: string): boolean {
  if (!precedent) return true
  return minuit(new Date(precedent)) !== minuit(new Date(quand))
}
