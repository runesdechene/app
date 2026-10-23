// Le jeton du lien de désabonnement : la personne, signée avec MISSIVES_JETON_SECRET. Sans compte ni session,
// il prouve que le lien vient bien d'une Missive envoyée à cette personne. Sa clé ne vit que dans Netlify,
// à part du secret du réveil (qui, lui, est aussi rangé dans la base).

import crypto from 'crypto'

function signature(userId: string): string {
  const cle = process.env.MISSIVES_JETON_SECRET
  // Une clé vide signerait des jetons que n'importe qui pourrait fabriquer.
  if (!cle) throw new Error('MISSIVES_JETON_SECRET manquant')
  return crypto.createHmac('sha256', cle).update(userId).digest('base64url')
}

export function signer(userId: string): string {
  return `${userId}.${signature(userId)}`
}

/** La personne du jeton, ou `null` s'il a été retouché. */
export function verifier(jeton: string): string | null {
  const point = jeton.lastIndexOf('.')
  if (point <= 0) return null
  const userId = jeton.slice(0, point)
  const attendu = Buffer.from(signature(userId))
  const recu = Buffer.from(jeton.slice(point + 1))
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu) ? userId : null
}
