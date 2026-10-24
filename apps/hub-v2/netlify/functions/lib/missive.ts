// Une Missive prête pour Resend, pour une personne : rendue avec @runes/missives, avec son lien de
// désabonnement signé et le désabonnement en un clic (RFC 8058). Partagé par l'envoi et l'essai.

import { rendre, type Envoi } from '@runes/missives'
import { signer } from './jeton'
import type { MessageResend } from './resend'

export const EXPEDITEUR = 'Uriel · Runes de Chêne <uriel@missives.runesdechene.com>'
export const REPONSES = 'uriel@missives.runesdechene.com'
export const HUB = 'https://hub.runesdechene.com'

export type Missive = Envoi & { id: number; objet: string }

export async function message(
  missive: Missive,
  d: { user_id: string; email: string; prenom: string | null },
  objet = missive.objet,
): Promise<MessageResend> {
  const jeton = signer(d.user_id)
  const { html, texte } = await rendre(missive, {
    prenom: d.prenom,
    lienDesabonnement: `${HUB}/desabonnement?j=${jeton}`,
    // Le questionnaire a son propre jeton : un lien de la lettre ne désabonne jamais, et l'inverse (lib/jeton.ts).
    // Un essai porte aussi le lien personnel : il montre exactement ce que reçoivent les gens (Uriel, 24/10).
    lienQuestionnaire: `${HUB}/qui-es-tu?j=${encodeURIComponent(signer(d.user_id, 'questionnaire'))}`,
  })
  return {
    from: EXPEDITEUR,
    to: [d.email],
    reply_to: REPONSES,
    subject: objet,
    html,
    text: texte,
    headers: {
      // La boîte de réception poste directement à la fonction, sans passer par la page.
      'List-Unsubscribe': `<${HUB}/.netlify/functions/missives-desabonnement?j=${jeton}>, <mailto:${REPONSES}?subject=desabonnement>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
