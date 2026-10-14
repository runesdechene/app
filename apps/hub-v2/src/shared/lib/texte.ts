/**
 * QUOI     — le texte d'une énigme en clair : les accolades qui marquent une date disparaissent.
 * POURQUOI — l'appli fait le rendu complet des dates ; le Hub n'en montre que le texte lisible.
 */
export function texteEnClair(texte: string): string {
  return texte.replace(/[{}]/g, '')
}
