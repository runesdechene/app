/**
 * QUOI     — le pseudo Instagram d'un profil, propre : sans « @ », sans l'adresse si on l'a collée
 *            (instagram.com/pseudo), ou null si ce qui est écrit n'est pas un pseudo.
 * POURQUOI — Uriel, 08/10 : le lien du profil gardait le « @ » tapé par erreur et menait à une page
 *            introuvable. Un pseudo Instagram ne contient que lettres, chiffres, points et tirets bas.
 */
const PSEUDO = /^[A-Za-z0-9._]{1,30}$/

export function pseudoInstagram(saisie: string | null): string | null {
  if (!saisie) return null
  const sansAdresse = saisie.trim().replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '')
  const pseudo = sansAdresse.replace(/^@+/, '')
  return PSEUDO.test(pseudo) ? pseudo : null
}
