/**
 * QUOI     — une Compagnie correspond-elle à ce qu'on tape ? Son nom ou sa devise, sans accents ni
 *            majuscules.
 * POURQUOI — « helvetia » trouve « Helvétia » : on cherche comme on parle.
 */
function plat(texte: string) {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function correspond(c: { nom: string; devise: string | null }, recherche: string): boolean {
  const voulu = plat(recherche.trim())
  if (voulu === '') return true
  return plat(c.nom).includes(voulu) || plat(c.devise ?? '').includes(voulu)
}
