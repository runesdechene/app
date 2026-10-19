/**
 * QUOI     — les mots et les dates de « J'y suis allé » (mig 531) : le geste accordé au genre, le
 *            mois d'un souvenir (« août 2019 »), les mois et les années qu'on peut choisir.
 * POURQUOI — un souvenir se déclare au mois près, jamais dans le futur, pas avant 1900 (la même règle
 *            que `declarer_souvenir`) : la feuille ne propose que ce que la base acceptera.
 */
export const PREMIERE_ANNEE = 1900

export const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

export function jySuisAlle(genre: 'm' | 'f'): string {
  return genre === 'f' ? 'J’y suis allée' : 'J’y suis allé'
}

// « 2019-08-01 » → « août 2019 » : la date ne passe jamais par un fuseau horaire.
export function moisDuSouvenir(date: string): string {
  const [annee, mois] = date.split('-').map(Number)
  return `${MOIS[(mois ?? 1) - 1] ?? ''} ${String(annee)}`
}

// De l'année en cours à 1900, la plus récente d'abord.
export function anneesPossibles(maintenant: Date): number[] {
  const annees: number[] = []
  for (let a = maintenant.getFullYear(); a >= PREMIERE_ANNEE; a--) annees.push(a)
  return annees
}

// Un mois à venir ne se déclare pas (mois de 1 à 12).
export function moisPasse(annee: number, mois: number, maintenant: Date): boolean {
  return annee < maintenant.getFullYear() || mois <= maintenant.getMonth() + 1
}
