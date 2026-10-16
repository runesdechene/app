/**
 * QUOI     — l'aperçu du texte de partage : la phrase coupée autour de {name}, pour poser le nom du lieu en gras.
 * POURQUOI — Explore et les pages /lieu suivent une seule règle (apps/web-v2 features/lieu/lib/phraseDePartage.ts,
 *            apps/seo-pages templates/photo.ts) : un texte vide, blanc ou sans {name} donne la phrase d'origine.
 *            L'aperçu montre ce que l'Explorateur verra vraiment, pas ce qui a été tapé.
 */
export const NOM_D_EXEMPLE = 'Abbaye de Fontenay'
export const REPLI = 'J’ai trouvé {name} sur Runes de Chêne EXPLORE - tu connais ?'

export function morceauxDApercu(modele: string): string[] {
  return (modele.includes('{name}') && modele.trim() !== '' ? modele : REPLI).split('{name}')
}
