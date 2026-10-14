/**
 * QUOI     — crée le compte d'un client rencontré au stand, par la fonction Netlify stand-create-account.
 * POURQUOI — la fonction crée d'abord le client Shopify, puis le compte : le jeton Shopify reste côté serveur.
 *            Elle rend l'id du compte, y compris quand l'e-mail en avait déjà un (« already_exists »).
 */
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'

export type CompteDuStand = { email: string; prenom: string; newsletter: boolean }

export async function creerCompteDuStand(c: CompteDuStand): Promise<string> {
  const reponse = await appelerFonction('stand-create-account', {
    methode: 'POST',
    corps: { email: c.email, firstName: c.prenom === '' ? null : c.prenom, newsletter: c.newsletter },
  })
  const corps = await lireReponse<{ user: { id: string } }>(reponse)
  return corps.user.id
}
