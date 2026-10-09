/**
 * QUOI     — revenir dans l'app compte comme l'ouvrir : on prévient `noter` à chaque retour.
 * POURQUOI — Uriel, 01/10 : « vient de se connecter » veut dire « vient d'ouvrir l'application ».
 *            Une app restée en arrière-plan (le téléphone, un onglet ouvert toute la journée) ne se
 *            recharge pas : seul un démarrage à froid comptait. Un aller-retour de moins de dix
 *            minutes ne compte pas — un coup d'œil ailleurs n'est pas une visite.
 * ATTENTION — rend de quoi arrêter d'écouter.
 */
const DIX_MINUTES = 10 * 60 * 1000

export function compterLesRetours(noter: () => void, maintenant = () => Date.now()): () => void {
  let partiA: number | null = null
  const changer = () => {
    if (document.visibilityState === 'hidden') {
      partiA = maintenant()
      return
    }
    if (partiA !== null && maintenant() - partiA >= DIX_MINUTES) noter()
    partiA = null
  }
  document.addEventListener('visibilitychange', changer)
  return () => {
    document.removeEventListener('visibilitychange', changer)
  }
}
