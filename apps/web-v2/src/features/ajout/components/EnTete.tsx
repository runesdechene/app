/**
 * QUOI     — l'en-tête du parcours (maquettes 288:147 à 291:209) : la croix pour quitter,
 *            « Nouveau lieu », « ✓ Brouillon enregistré » à chaque enregistrement, et les quatre
 *            étapes — un trait qui se remplit, un nom dessous.
 * POURQUOI — toucher une étape déjà faite y ramène : c'est le retour en arrière du parcours (le
 *            retour du navigateur, lui, quitte en gardant le brouillon). `clair` : sur une photo.
 */
import { ETAPES, type Etape } from '../lib/brouillon'
import styles from './EnTete.module.css'

const NOMS: Record<Exclude<Etape, 'apercu'>, string> = {
  photo: 'Photo',
  lieu: 'Lieu',
  nom: 'Nom',
  recit: 'Récit',
}

export function EnTete({
  etape,
  possible,
  enregistre,
  clair,
  onQuitter,
  onAller,
}: {
  etape: Etape
  possible: Etape
  enregistre: number
  clair: boolean
  onQuitter: () => void
  onAller: (etape: Etape) => void
}) {
  const ici = ETAPES.indexOf(etape)
  return (
    <header className={styles.entete} data-clair={clair || undefined}>
      <div className={styles.ligne}>
        <button type="button" className={styles.quitter} aria-label="Quitter" onClick={onQuitter}>
          <span className={styles.croix} aria-hidden="true" />
        </button>
        <p className={styles.titre}>Nouveau lieu</p>
        {/* La clé rejoue l'apparition à chaque enregistrement. */}
        {enregistre > 0 && (
          <span key={enregistre} className={styles.enregistre} role="status">
            ✓ Brouillon enregistré
          </span>
        )}
      </div>
      <nav className={styles.etapes} aria-label="Étapes">
        {ETAPES.filter((e): e is Exclude<Etape, 'apercu'> => e !== 'apercu').map((e, i) => (
          <button
            key={e}
            type="button"
            className={styles.etape}
            data-faite={i <= ici || undefined}
            aria-current={e === etape ? 'step' : undefined}
            disabled={i > ETAPES.indexOf(possible) || e === etape}
            onClick={() => {
              onAller(e)
            }}
          >
            <span className={styles.trait} aria-hidden="true" />
            {NOMS[e]}
          </button>
        ))}
      </nav>
    </header>
  )
}
