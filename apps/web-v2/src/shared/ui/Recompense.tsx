/**
 * QUOI     — la récompense, posée sur la photo du lieu (maquette 250:140) : 🎉 et confettis, le
 *            nom, la phrase du rang, l'expérience gagnée et la jauge du niveau ; un bouton pour
 *            aller au lieu, un autre pour revenir.
 * POURQUOI — la même fête pour découvrir un lieu (Uriel, 28/09) et pour en ajouter un (29/09).
 *            Toucher la photo ou le bouton ouvre le lieu ; la croix et le lien du bas ramènent.
 *            Le bouton est crème : le rouge se voyait mal sur le fond sombre.
 * ATTENTION — la photo est celle du parent : la récompense se pose par-dessus, en absolu.
 */
import croix from '@/assets/ui/croix.svg'
import styles from './Recompense.module.css'

const CONFETTIS = 16

export type Gain = { gain: number; niveau: number; avant: number; apres: number }

export function Recompense({
  nom,
  type,
  phrase,
  gain: { gain, niveau, avant, apres },
  libelleAcceder,
  libelleRevenir,
  onAcceder,
  onFermer,
}: {
  nom: string
  type: string | null
  phrase: string
  gain: Gain
  libelleAcceder: string
  libelleRevenir: string
  onAcceder: () => void
  onFermer: () => void
}) {
  return (
    <div className={styles.recompense}>
      <button
        type="button"
        className={styles.versLeLieu}
        aria-label={`Ouvrir ${nom}`}
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
        <h2 className={styles.nom}>{nom}</h2>
        {type && <p className={styles.type}>{type}</p>}
        <p className={styles.rang}>{phrase}</p>
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
          {libelleAcceder}
        </button>
        <button type="button" className={styles.revenir} onClick={onFermer}>
          {libelleRevenir}
        </button>
      </div>
    </div>
  )
}
