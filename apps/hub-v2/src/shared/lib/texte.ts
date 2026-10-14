/**
 * QUOI     — le texte d'une énigme en clair : les accolades qui marquent une date disparaissent.
 * POURQUOI — l'appli fait le rendu complet des dates ; le Hub n'en montre que le texte lisible.
 *            Et l'accord au pluriel des compteurs (« 1 point », « 2 points »).
 */
export function texteEnClair(texte: string): string {
  return texte.replace(/[{}]/g, '')
}

// « 1 lieu », « 2 lieux » : le singulier jusqu'à 1, le pluriel au-delà (par défaut, le singulier + « s »).
export function pluriel(n: number, singulier: string, formePlurielle = `${singulier}s`): string {
  return n > 1 ? formePlurielle : singulier
}
