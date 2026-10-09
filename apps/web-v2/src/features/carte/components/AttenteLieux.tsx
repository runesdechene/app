/**
 * QUOI     — « Les lieux arrivent… » : au centre de la carte, la rose des vents qui tourne
 *            doucement, le temps que les lieux se posent.
 * POURQUOI — Uriel, 02/10 : un signe, la toute première fois, que la carte charge. Ensuite, les
 *            lieux sont gardés sur l'appareil et la carte s'ouvre sans attendre.
 * ATTENTION — l'attente finie ne disparaît pas d'un coup : elle s'efface (`data-fini`).
 */
import roseDesVents from '@/assets/ui/rose-des-vents.svg'
import styles from './AttenteLieux.module.css'

const TEXTE = 'Les lieux arrivent…'

export function AttenteLieux({ finie }: { finie: boolean }) {
  return (
    <div
      role="status"
      aria-label={TEXTE}
      aria-hidden={finie || undefined}
      data-fini={finie || undefined}
      className={styles.attente}
    >
      <img className={styles.rose} src={roseDesVents} alt="" />
      <span>{TEXTE}</span>
    </div>
  )
}
