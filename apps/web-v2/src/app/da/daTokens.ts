/**
 * QUOI     — ce que la page /v2/da doit montrer : les couleurs des jetons et les briques.
 * POURQUOI — deux tests comparent ces listes à la réalité (tokens.css, dossier shared/ui) :
 *            rien ne peut exister sans apparaître sur la page.
 */
export const COLOR_TOKENS = [
  '--color-fond',
  '--color-surface',
  '--color-barre',
  '--color-sable',
  '--color-bord',
  '--color-encre',
  '--color-texte',
  '--color-texte-doux',
  '--color-texte-pale',
  '--color-sur-accent',
  '--color-accent',
  '--color-accent-clair',
  '--color-rose',
  '--color-ocre',
  '--color-kaki',
  '--color-vert',
  '--color-lien',
  '--color-succes',
  '--color-succes-fond',
  '--color-pastille',
  '--color-brun',
  '--color-doux-fond',
  '--color-feuille',
  '--color-desactive-fond',
  '--color-desactive-bord',
  '--color-desactive-texte',
] as const

export const DA_SHOWCASED = [
  'Avatar',
  'Button',
  'Champ',
  'EmptyState',
  'Feuille',
  'IconButton',
  'Interrupteur',
  'Pastille',
  'PastilleChoix',
  'Text',
] as const

export const SPACE_TOKENS = [
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
] as const

export const RADIUS_TOKENS = [
  '--radius-vignette',
  '--radius-petit',
  '--radius',
  '--radius-carte',
  '--radius-feuille',
  '--radius-rond',
] as const
