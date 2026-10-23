// L'accord aux nouvelles, entre le Hub et Shopify : la dernière action gagne (spec mailing, « Fiche unique »).
// Une fonction pure, partagée par les portes (stand, flyer, synchro et webhook Shopify, désabonnement).

export type Porte = 'stand' | 'flyer' | 'site' | 'appli' | 'shopify' | 'hub' | 'desabonnement' | 'rebond'

export type Accord = { accord: boolean; le: string | null }
export type ChoixRecu = { accord: boolean; le: string | null; porte: Porte }

/** Ce qu'il faut écrire sur la fiche, ou `null` quand le choix reçu ne change rien. */
export function appliquerAccord(actuel: Accord, recu: ChoixRecu): { accord: boolean; le: string; porte: Porte } | null {
  if (recu.le === null || recu.accord === actuel.accord) return null
  if (actuel.le !== null && Date.parse(recu.le) <= Date.parse(actuel.le)) return null
  return { accord: recu.accord, le: recu.le, porte: recu.porte }
}

/** Les colonnes de `users` qui portent un choix. */
export function colonnesAccord(choix: { accord: boolean; le: string; porte: Porte }) {
  return { accord_nouvelles: choix.accord, accord_nouvelles_le: choix.le, accord_nouvelles_porte: choix.porte }
}
