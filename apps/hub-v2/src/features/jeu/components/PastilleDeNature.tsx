/**
 * QUOI     — l'icône d'une nature sur sa couleur, dans un carré de la couleur du fond.
 */
import type { CSSProperties } from 'react'
import { COULEUR } from '../lib/nature'
import { IconeDeCulture } from './IconeDeCulture'
import natures from './Natures.module.css'

export function PastilleDeNature({ icone, couleur, fond }: { icone: string | null; couleur: string; fond: string }) {
  return (
    <span className={natures.pastille} style={{ '--fond': COULEUR.test(fond) ? fond : 'transparent' } as CSSProperties}>
      <IconeDeCulture icone={icone} couleur={COULEUR.test(couleur) ? couleur : null} />
    </span>
  )
}
