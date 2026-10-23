// L'accord aux nouvelles, entre le Hub et Shopify : la dernière action gagne (spec mailing, « Fiche unique »).
// Une fonction pure, partagée par les portes (stand, flyer, synchro et webhook Shopify, désabonnement).

export type Porte = 'stand' | 'flyer' | 'site' | 'appli' | 'shopify' | 'hub' | 'desabonnement' | 'rebond' | 'import'

export type Accord = { accord: boolean; le: string | null }
export type ChoixRecu = { accord: boolean; le: string | null; porte: Porte }

/** Ce qu'il faut écrire sur la fiche, ou `null` quand le choix reçu ne change rien. */
export function appliquerAccord(actuel: Accord, recu: ChoixRecu): { accord: boolean; le: string; porte: Porte } | null {
  // Un refus daté remplace un « non » sans date : c'est lui qui écarte des suites clients (mig 550).
  const refusADater = !recu.accord && actuel.le === null
  if (recu.le === null || (recu.accord === actuel.accord && !refusADater)) return null
  if (actuel.le !== null && Date.parse(recu.le) <= Date.parse(actuel.le)) return null
  return { accord: recu.accord, le: recu.le, porte: recu.porte }
}

/**
 * Le choix que porte un client Shopify. `unsubscribed` est un refus et se date ; `not_subscribed` (jamais abonné)
 * n'est pas un choix. Sans date de consentement, `repli` (création ou mise à jour du client) la tient.
 */
export function choixDeShopify(
  consentement: { state?: string; consent_updated_at?: string | null } | null | undefined,
  repli: string | null,
): Accord {
  const etat = consentement?.state
  if (etat !== 'subscribed' && etat !== 'unsubscribed') return { accord: false, le: null }
  return { accord: etat === 'subscribed', le: consentement?.consent_updated_at ?? repli }
}

/** Les colonnes de `users` qui portent un choix. */
export function colonnesAccord(choix: { accord: boolean; le: string; porte: Porte }) {
  return { accord_nouvelles: choix.accord, accord_nouvelles_le: choix.le, accord_nouvelles_porte: choix.porte }
}
