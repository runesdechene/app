/**
 * QUOI     — le compte du Codex : « 6 / 10 Fragments portés », « 2 scannés · 2 inconnus », et une
 *            fine barre continue en trois parts (portés, scannés, le reste).
 * POURQUOI — maquette F (02/11) : discret, sans encadré ni rouge ; jamais de crans, il y aura plus
 *            de 50 Fragments.
 */
import type { Codex } from '../api/lireCodex'
import styles from './CompteTotal.module.css'

export function CompteTotal({ totaux }: { totaux: Codex['totaux'] }) {
  const part = (n: number) => (totaux.total > 0 ? `${String((n / totaux.total) * 100)}%` : '0%')
  return (
    <div className={styles.compte}>
      <p className={styles.ligne}>
        <span className={styles.nombre}>{totaux.portes}</span>
        <span className={styles.sur}>/ {totaux.total}</span>{' '}
        <span className={styles.libelle}>Fragments portés</span>
        <span className={styles.reste}>
          {totaux.scannes} {totaux.scannes > 1 ? 'scannés' : 'scanné'} · {totaux.inconnus}{' '}
          {totaux.inconnus > 1 ? 'inconnus' : 'inconnu'}
        </span>
      </p>
      <div className={styles.barre} aria-hidden="true">
        <span className={styles.portes} style={{ '--part': part(totaux.portes) }} />
        <span className={styles.scannes} style={{ '--part': part(totaux.scannes) }} />
      </div>
    </div>
  )
}
