/**
 * QUOI     — le nom du territoire au centre de la carte, en italique de copiste, entre deux
 *            fleurons (maquette 162:107, calques 200:191).
 * POURQUOI — de près le territoire (« Comté de Nice »), de loin le pays, rien au-dessus de la
 *            mer : le nom change en fondu, comme une encre qui sèche.
 */
import fleuron from '@/assets/ui/fleuron.svg'
import styles from './Inscription.module.css'

export function Inscription({ nom }: { nom: string | null }) {
  if (nom === null) return null
  return (
    <p key={nom} className={styles.inscription}>
      <img className={styles.fleuron} src={fleuron} alt="" />
      <span className={styles.nom}>{nom}</span>
      <img className={[styles.fleuron, styles.retourne].join(' ')} src={fleuron} alt="" />
    </p>
  )
}
