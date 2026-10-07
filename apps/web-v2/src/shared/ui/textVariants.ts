/**
 * QUOI     — la liste fermée des douze styles de texte de la V2.
 * POURQUOI — partagée par la brique Text et par la page /da, qui les montre tous. Ajouter un
 *            style ici sans le styler dans Text.module.css fait échouer le test de Text.
 */
export const TEXT_VARIANTS = [
  'titre-ecran',
  'titre-section',
  'titre-carte',
  'rubrique',
  'surtitre',
  'corps',
  'sous-titre',
  'flux',
  'legende',
  'micro',
  'libelle',
  'meta',
] as const

export type TextVariant = (typeof TEXT_VARIANTS)[number]
