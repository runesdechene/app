/**
 * QUOI     — la photo du flyer et sa lisière ondulée, pour la place `photo` de PagePublique.
 * POURQUOI — /flyer et /flyercadeau montrent la même photo, qui fond dans le parchemin par le
 *            même bord (Figma 605:1497 et 606:1591) : une seule brique. /flyercadeau ne la montre
 *            que sur PC (`telephone={false}`), ses cadres de téléphone n'ont pas de photo.
 */
import styles from './PhotoFlyer.module.css'

export function PhotoFlyer({ telephone = true }: { telephone?: boolean }) {
  return <img src="/flyer-photo.webp" alt="" className={styles.photo} data-telephone={telephone} />
}
