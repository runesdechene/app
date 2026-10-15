/**
 * QUOI     — la demande du code cadeau à la fonction Netlify `flyer-create-account`.
 * POURQUOI — le visiteur n'a pas de session : pas d'`appelerFonction`, qui joint un jeton. Chaque
 *            échec devient une phrase pour lui : réseau coupé, trop d'essais (le frein de 15 par
 *            heure et par IP), ou ce que `lireReponse` tire d'une réponse illisible.
 */
import { lireReponse } from '@/shared/lib/fonctions'

export const TROP_D_ESSAIS = 'Trop d’essais depuis cet appareil, réessaie dans une heure.'
export const HORS_LIGNE = 'Connexion impossible, réessaie.'

export async function demanderCadeau(email: string, newsletter: boolean): Promise<{ code: string }> {
  let r: Response
  try {
    r = await fetch('/.netlify/functions/flyer-create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newsletter }),
    })
  } catch {
    throw new Error(HORS_LIGNE)
  }
  if (r.status === 429) throw new Error(TROP_D_ESSAIS)
  const { promoCode } = await lireReponse<{ promoCode: string }>(r)
  return { code: promoCode }
}
