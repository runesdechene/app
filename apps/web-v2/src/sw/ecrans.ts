/**
 * QUOI     — ce que le service worker sert lui-même (les écrans d'Explore) et où il pose le lien
 *            d'un push (sous la base de l'appli : /v2/ avant la bascule, / après).
 * POURQUOI — après la bascule, le service worker prend la portée / : il ne doit jamais avaler un
 *            autre usage du domaine (les pages /lieu de seo-pages, /mouvement ; spec
 *            2026-10-07-v2-bascule, « préfixes réservés »). Une liste blanche ne s'oublie pas
 *            quand un nouveau sous-dossier arrive. Le scan est un écran d'Explore (spec
 *            2026-10-09-v2-scan) ; la zone Campement s'y ajoutera ('campement').
 */
const ECRANS = ['accueil', 'carte', 'messages', 'compagnies', 'compte', 'bienvenue', 'da', 'scan']

// « <base>accueil », « <base>accueil/… », ou la base seule ; « <base>accueillir » n'en est pas.
export function ecransExplore(base: string): RegExp {
  return new RegExp(`^${base}(?:(?:${ECRANS.join('|')})(?:/|$)|$)`)
}

// Un push porte un chemin d'appli (« /accueil/lieu/1 ») : on le pose sous la base.
export function cheminDansLAppli(url: string, base: string): string {
  return base + url.replace(/^\//, '')
}
