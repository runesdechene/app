// Le jeton du lien de désabonnement : la personne, signée avec MISSIVES_SECRET. Sans compte ni session,
// il prouve que le lien vient bien d'une Missive envoyée à cette personne.

import crypto from 'crypto'

function signature(userId: string): string {
  return crypto.createHmac('sha256', process.env.MISSIVES_SECRET ?? '').update(userId).digest('base64url')
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
