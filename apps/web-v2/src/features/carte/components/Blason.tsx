/**
 * QUOI     — le blason d'un territoire sur la carte (Figma 878:2627) : un écu au portrait du joueur
 *            qui le tient (« +N » s'ils l'ont revendiqué à plusieurs), et une banderole à son nom. Le
 *            mien au vert chêne, les autres à l'encre.
 * POURQUOI — un territoire, c'est de la fierté (Uriel, 01/11) : on voit qui le tient, et un toucher
 *            ouvre sa carte. Un écu, pas un rond : les Actifs, eux, sont des portraits ronds.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { TerritoireRevendique } from '../api/lireCarte'
import styles from './Blason.module.css'

export function Blason({
  territoire: t,
  onToucher,
}: {
  territoire: TerritoireRevendique
  onToucher: () => void
}) {
  return (
    <button
      type="button"
      className={styles.blason}
      style={{ '--couleur': t.moi ? 'var(--color-carte-chene)' : 'var(--color-carte-encre)' }}
      aria-label={`${t.nom}, territoire de ${t.joueur.nom}`}
      onClick={onToucher}
    >
      <span className={styles.ecu}>
        <span className={styles.portrait}>
          {t.joueur.avatar ? (
            <img src={aLaTaille(t.joueur.avatar, 40)} alt="" />
          ) : (
            t.joueur.nom.charAt(0).toUpperCase()
          )}
        </span>
      </span>
      {t.compagnons > 0 && <span className={styles.plus}>+{t.compagnons}</span>}
      <span className={styles.banderole}>{t.nom}</span>
    </button>
  )
}
