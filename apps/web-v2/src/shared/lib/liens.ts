/**
 * QUOI     — découpe un texte écrit par un Explorateur en morceaux : texte, liens https, mentions
 *            @instagram. La présentation d'un profil et le récit d'un lieu s'en servent.
 * POURQUOI — les liens deviennent cliquables en React, sans jamais injecter de HTML. Seul
 *            `https://` devient un lien : un `javascript:` ou un `http://` restent du texte.
 */
export type Morceau =
  { type: 'texte'; valeur: string } | { type: 'lien'; valeur: string; href: string }

// Un lien s'arrête avant la ponctuation qui finit la phrase (« … sur https://x.fr. »).
// Une mention commence un mot (« @runesdechene ») ; « uriel@runesdechene.com » est une adresse.
const LIEN_OU_MENTION = /(https:\/\/\S*[^\s.,;:!?)»]|(?<![\w.])@[\w.]*\w)/g

export function decouperLiens(texte: string): Morceau[] {
  // `split` avec une capture alterne texte et trouvaille : les indices impairs sont les liens.
  return texte
    .split(LIEN_OU_MENTION)
    .map((valeur, i): Morceau => {
      if (i % 2 === 0) return { type: 'texte', valeur }
      const href = valeur.startsWith('@') ? `https://www.instagram.com/${valeur.slice(1)}/` : valeur
      return { type: 'lien', valeur, href }
    })
    .filter((morceau) => morceau.valeur !== '')
}
