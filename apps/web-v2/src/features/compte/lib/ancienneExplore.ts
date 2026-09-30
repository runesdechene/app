/**
 * QUOI     — revenir à l'ancienne Explore (la V1, à la racine du site).
 * POURQUOI — la V1 renvoie vers la V2 ceux qui l'ont choisie (cookie `explore_version`, écrit
 *            par son pop-up « La nouvelle Explore est là ») ; ce choix se défait ici, sinon on
 *            ne pourrait plus en sortir. Code de transition : supprimé avec la V1.
 */
const UN_AN = 365 * 24 * 60 * 60

export function revenirALAncienneExplore() {
  document.cookie = `explore_version=v1; path=/; max-age=${String(UN_AN)}; samesite=lax`
  window.location.assign('/')
}
