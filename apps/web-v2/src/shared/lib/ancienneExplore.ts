/**
 * QUOI     — choisir l'ancienne Explore (la V1, à la racine du site), et y revenir.
 * POURQUOI — la V1 renvoie vers la V2 ceux qui l'ont choisie (cookie `explore_version`, écrit
 *            par son pop-up « La nouvelle Explore est là »). Toute sortie vers la V1 doit défaire
 *            ce choix, sinon la V1 renvoie aussitôt ici. Code de transition : supprimé avec la V1.
 */
const UN_AN = 365 * 24 * 60 * 60

export function choisirLaV1() {
  document.cookie = `explore_version=v1; path=/; max-age=${String(UN_AN)}; samesite=lax`
}

export function revenirALaV1() {
  choisirLaV1()
  window.location.assign('/')
}
