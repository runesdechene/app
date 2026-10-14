/**
 * QUOI     — une ligne de « Ce qui t'attend » : le nombre, ce qui attend, un détail, le lien.
 */
import { Link } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import styles from './LigneATraiter.module.css'

export function LigneATraiter({ nombre, titre, detail, vers }: { nombre: number; titre: string; detail: string; vers: string }) {
  return (
    <Link className={styles.ligne} to={vers}>
      <span className={styles.nombre}>{nombre}</span>
      <span className={styles.texte}>
        <span className={styles.titre}>{titre}</span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <img className={styles.chevron} src={chevron} alt="" />
    </Link>
  )
}
