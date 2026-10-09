/**
 * QUOI     — découpe une présentation en morceaux : texte, liens https, mentions @instagram.
 * POURQUOI — les liens deviennent cliquables en React, sans jamais injecter de HTML
 *            (`dangerouslySetInnerHTML` est proscrit). Seul `https://` devient un lien : un
 *            `javascript:` ou un `http://` restent du texte.
 */
export type MorceauBio =
  { type: 'texte'; valeur: string } | { type: 'lien'; valeur: string; href: string }

// Une mention commence un mot (« @runesdechene ») ; « uriel@runesdechene.com » est une adresse.
const LIEN_OU_MENTION = /(https:\/\/\S+|(?<![\w.])@[\w.]+)/g

export function decouperBio(texte: string): MorceauBio[] {
  return texte
    .split(LIEN_OU_MENTION)
    .filter((morceau) => morceau !== '')
    .map((morceau) => {
      if (morceau.startsWith('https://')) return { type: 'lien', valeur: morceau, href: morceau }
      if (morceau.startsWith('@')) {
        return {
          type: 'lien',
          valeur: morceau,
          href: `https://www.instagram.com/${morceau.slice(1)}/`,
        }
      }
      return { type: 'texte', valeur: morceau }
    })
}
