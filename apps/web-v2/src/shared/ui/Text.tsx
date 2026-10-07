/**
 * QUOI     — le seul moyen d'écrire du texte stylé dans la V2.
 * POURQUOI — un écran choisit un style nommé, jamais une taille (décision 007). Les douze
 *            styles sont ceux relevés dans la maquette Figma et montrés sur /da.
 */
import type { ReactNode } from 'react'
import type { TextVariant } from './textVariants'
import styles from './Text.module.css'

export type { TextVariant } from './textVariants'

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

const DEFAULTS: Record<TextVariant, { tag: Tag; className: string | undefined }> = {
  'titre-ecran': { tag: 'h1', className: styles.titreEcran },
  'titre-section': { tag: 'h2', className: styles.titreSection },
  'titre-carte': { tag: 'h3', className: styles.titreCarte },
  rubrique: { tag: 'h2', className: styles.rubrique },
  surtitre: { tag: 'p', className: styles.surtitre },
  corps: { tag: 'p', className: styles.corps },
  'sous-titre': { tag: 'p', className: styles.sousTitre },
  flux: { tag: 'p', className: styles.flux },
  legende: { tag: 'p', className: styles.legende },
  micro: { tag: 'span', className: styles.micro },
  libelle: { tag: 'span', className: styles.libelle },
  meta: { tag: 'span', className: styles.meta },
}

export function Text({
  variant,
  as,
  children,
}: {
  variant: TextVariant
  as?: Tag
  children: ReactNode
}) {
  const { tag, className } = DEFAULTS[variant]
  const Tag = as ?? tag
  return <Tag className={className}>{children}</Tag>
}
