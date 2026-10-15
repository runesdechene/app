/**
 * QUOI     — l'aperçu du texte de partage : la phrase coupée autour de {name}, pour poser le nom du lieu en gras.
 * POURQUOI — Explore garde sa propre phrase quand le texte est vide ou sans {name} (apps/web-v2, phraseDePartage) :
 *            l'aperçu montre ce que l'Explorateur verra vraiment, pas ce qui a été tapé.
 */
export const NOM_D_EXEMPLE = 'Abbaye de Fontenay'
export const REPLI = 'J’ai trouvé {name} sur Runes de Chêne EXPLORE - tu connais ?'

export function morceauxDApercu(modele: string): string[] {
  return (modele.includes('{name}') && modele.trim() !== '' ? modele : REPLI).split('{name}')
}
