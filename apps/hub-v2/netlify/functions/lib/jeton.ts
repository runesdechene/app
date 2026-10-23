// Le jeton du lien de désabonnement : la personne, signée avec MISSIVES_JETON_SECRET. Sans compte ni session,
// il prouve que le lien vient bien d'une Missive envoyée à cette personne. Sa clé ne vit que dans Netlify,
// à part du secret du réveil (qui, lui, est aussi rangé dans la base).

import crypto from 'crypto'

/** Un jeton ne sert qu'à son usage : un lien de désabonnement n'ouvre pas le questionnaire, ni l'inverse. */
export type Usage = 'desabonnement' | 'questionnaire'

function signature(userId: string, usage: Usage): string {
  const cle = process.env.MISSIVES_JETON_SECRET
  // Une clé vide signerait des jetons que n'importe qui pourrait fabriquer.
  if (!cle) throw new Error('MISSIVES_JETON_SECRET manquant')
  // Le désabonnement signe la personne seule : les liens déjà envoyés restent valables.
  return crypto.createHmac('sha256', cle).update(usage === 'desabonnement' ? userId : `${usage}:${userId}`).digest('base64url')
}

export function signer(userId: string, usage: Usage = 'desabonnement'): string {
  return `${userId}.${signature(userId, usage)}`
}

/** La personne du jeton, ou `null` s'il a été retouché. */
export function verifier(jeton: string, usage: Usage = 'desabonnement'): string | null {
  const point = jeton.lastIndexOf('.')
  if (point <= 0) return null
  const userId = jeton.slice(0, point)
  const attendu = Buffer.from(signature(userId, usage))
  const recu = Buffer.from(jeton.slice(point + 1))
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu) ? userId : null
}
