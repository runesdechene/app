/**
 * QUOI     — la phrase « sous le signe de … » pour le Fragment choisi par un Porteur.
 * POURQUOI — les noms de Fragments portent parfois leur article (« Le Varègue ») et parfois
 *            non (« Hoplite ») : on contracte (du, des, de la, de l’) et on élide devant une
 *            voyelle ou un h.
 * ATTENTION — l'élision devant « h » suppose un h muet (« l’Hoplite ») ; un h aspiré ou un nom
 *            propre sans article (« Avalon ») donnerait une tournure imparfaite. Le jour où la
 *            base portera l'article de chaque Fragment (comme `de_nom` pour les départements),
 *            cette règle disparaît.
 */
const ARTICLES: [RegExp, string][] = [
  [/^Le\s+/, 'du '],
  [/^La\s+/, 'de la '],
  [/^Les\s+/, 'des '],
  [/^L['’]/, 'de l’'],
]

export function sousLeSigne(nom: string): string {
  for (const [article, contraction] of ARTICLES) {
    if (article.test(nom)) return `sous le signe ${contraction}${nom.replace(article, '')}`
  }
  const elision = /^[aeiouyhàâéèêîôû]/i.test(nom)
  return `sous le signe ${elision ? 'de l’' : 'de '}${nom}`
}
