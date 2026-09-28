/**
 * QUOI     — le nom du territoire au centre de la carte, en italique de copiste, entre deux
 *            fleurons (maquette 162:107, calques 200:191).
 * POURQUOI — de près le territoire (« Comté de Nice »), de loin le pays, rien au-dessus de la
 *            mer : le nom change en fondu, comme une encre qui sèche, et s'efface de même.
 * ATTENTION — le dernier nom est gardé pour s'effacer : sans lui, il n'y aurait rien à estomper.
 */
import { useState } from 'react'
import fleuron from '@/assets/ui/fleuron.svg'
import styles from './Inscription.module.css'

export function Inscription({ nom }: { nom: string | null }) {
  const [dernier, setDernier] = useState(nom)
  if (nom !== null && nom !== dernier) setDernier(nom)
  if (dernier === null) return null
  const efface = nom === null
  return (
    <p
      key={dernier}
      className={[styles.inscription, efface && styles.efface].filter(Boolean).join(' ')}
      aria-hidden={efface}
    >
      <img className={styles.fleuron} src={fleuron} alt="" />
      <span className={styles.nom}>{dernier}</span>
      <img className={[styles.fleuron, styles.retourne].join(' ')} src={fleuron} alt="" />
    </p>
  )
}
