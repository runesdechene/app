/**
 * QUOI     — l'adresse courte d'un lieu : la rue et la commune.
 * POURQUOI — les adresses viennent d'un géocodeur qui empile tout (département, région, « France
 *            métropolitaine », code postal, pays) : trois lignes pour ne rien dire de plus. Le GPS
 *            du téléphone, lui, reçoit les coordonnées exactes.
 */
const SANS_SENS = new Set(['unnamed road', 'france', 'france métropolitaine', 'italy', 'italia'])

export function adresseCourte(adresse: string): string {
  const morceaux = adresse
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m !== '' && !SANS_SENS.has(m.toLowerCase()) && !/^\d{4,5}$/.test(m))
  // Un numéro seul (« 167 ») se colle à sa rue.
  const [premier, deuxieme, ...reste] = morceaux
  const lignes =
    premier !== undefined && deuxieme !== undefined && /^\d+\s?\w?$/.test(premier)
      ? [`${premier} ${deuxieme}`, ...reste]
      : morceaux
  return lignes.slice(0, 2).join(', ')
}
