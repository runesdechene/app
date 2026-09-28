/**
 * QUOI     — la récompense d'une découverte, posée sur la photo enfin nette (maquette 250:140) :
 *            🎉 et confettis, le nom, le rang, l'expérience gagnée et la jauge du niveau.
 * POURQUOI — Uriel, 28/09 : toucher la photo ou « Accéder au lieu » ouvre la fiche ; la croix et
 *            « Revenir à la carte » y ramènent. Le bouton est crème : le rouge se voyait mal sur
 *            le fond sombre.
 */
import croix from '@/assets/ui/croix.svg'
import type { FicheLieu, Recompense } from '../api/lireLieu'
import styles from './DecouverteLieu.module.css'

const CONFETTIS = 16

function phraseRang(rang: number) {
  return rang === 1 ? 'Ton 1ᵉʳ lieu découvert !' : `Ton ${String(rang)}ᵉ lieu découvert !`
}

export function RecompenseDecouverte({
  fiche,
  recompense,
  onAcceder,
  onFermer,
}: {
  fiche: Pick<FicheLieu, 'nom' | 'type'>
  recompense: Recompense
  onAcceder: () => void
  onFermer: () => void
}) {
  const { rang, gain, niveau, avant, apres } = recompense
  return (
    <div className={styles.recompense}>
      <button
        type="button"
        className={styles.versLeLieu}
        aria-label={`Ouvrir ${fiche.nom}`}
        onClick={onAcceder}
      />
      <button type="button" className={styles.fermer} aria-label="Fermer" onClick={onFermer}>
        <img src={croix} alt="" width={24} height={24} />
      </button>

      <div className={styles.confettis} aria-hidden="true">
        {Array.from({ length: CONFETTIS }, (_, i) => (
          <span key={i} style={{ '--rang': String(i) }} />
        ))}
      </div>

      <div className={styles.bas}>
        <span className={styles.fete} aria-hidden="true">
          🎉
        </span>
        <h2 className={styles.nom}>{fiche.nom}</h2>
        {fiche.type && <p className={styles.type}>{fiche.type.nom}</p>}
        <p className={styles.rang}>{phraseRang(rang)}</p>
        {gain > 0 && <p className={styles.gain}>+{gain} d’expérience</p>}
        <p className={styles.niveau}>Niveau {niveau}</p>
        <span
          className={styles.jauge}
          role="progressbar"
          aria-label={`Niveau ${String(niveau)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(apres * 100)}
        >
          <span
            className={styles.rempli}
            style={{ '--avant': String(avant), '--mesure': String(apres) }}
          />
        </span>
        <button type="button" className={styles.acceder} onClick={onAcceder}>
          Accéder au lieu
        </button>
        <button type="button" className={styles.revenir} onClick={onFermer}>
          Revenir à la carte
        </button>
      </div>
    </div>
  )
}
