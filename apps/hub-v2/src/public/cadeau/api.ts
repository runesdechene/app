/**
 * QUOI     — la demande du code cadeau, et l'inscription à la newsletter de /flyer, à la fonction
 *            Netlify `flyer-create-account`.
 * POURQUOI — le visiteur n'a pas de session : pas d'`appelerFonction`, qui joint un jeton. Il vient
 *            d'un QR imprimé : il ne lit que trois phrases écrites pour lui — réseau coupé, trop
 *            d'essais (le frein de 15 par heure et par IP), ou le cadeau pas prêt. Jamais le texte
 *            du serveur ni celui de `lireReponse`, qui parlent à l'équipe.
 */
import { lireReponse } from '@/shared/lib/fonctions'

export const TROP_D_ESSAIS = 'Trop d’essais depuis cet appareil, réessaie dans une heure.'
export const HORS_LIGNE = 'Connexion impossible, réessaie.'
export const PAS_PRET = 'Le cadeau n’a pas pu être préparé, réessaie dans un instant.'

export const PAS_INSCRIT = 'L’inscription n’a pas abouti, réessaie dans un instant.'

// L'appel commun : `echec` est la phrase du visiteur quand le serveur ne répond pas comme prévu.
async function envoyerEmail(email: string, newsletter: boolean, echec: string): Promise<{ promoCode?: unknown }> {
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
  try {
    return await lireReponse<{ promoCode?: unknown }>(r)
  } catch {
    throw new Error(echec)
  }
}

export async function demanderCadeau(email: string, newsletter: boolean): Promise<{ code: string }> {
  const corps = await envoyerEmail(email, newsletter, PAS_PRET)
  if (typeof corps.promoCode !== 'string' || corps.promoCode === '') throw new Error(PAS_PRET)
  return { code: corps.promoCode }
}

// L'inscription de /flyer : la même fiche que le cadeau, la newsletter acceptée, et pas de code.
export async function inscrireALaNewsletter(email: string): Promise<void> {
  await envoyerEmail(email, true, PAS_INSCRIT)
}
