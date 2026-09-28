/**
 * QUOI     — le bouton de visite et ses six états (maquette 230:128).
 * POURQUOI — il porte son état avant qu'on le touche : le refus est écrit dessus, jamais
 *            découvert par l'échec (spec fiche §4). Le serveur juge quand même la portée ; son
 *            refus s'écrit sous le bouton.
 * ATTENTION — « Revendiquer » (déjà visité, de retour sur place) refait d'abord la visite : le
 *            serveur exige une visite de moins de 30 minutes pour revendiquer.
 */
import type { FicheLieu } from '../api/lireLieu'
import { usePosition } from '../hooks/usePosition'
import { useVisite } from '../hooks/useVisite'
import { etatVisite, type EtatVisite } from '../lib/etatVisite'
import styles from './BoutonVisite.module.css'

function libelle(etat: EtatVisite) {
  switch (etat.kind) {
    case 'localiser':
      return 'Me localiser pour visiter'
    case 'refusee':
      return 'Position refusée'
    case 'visiter':
      return 'Marquer ma visite (GPS)'
    case 'tropLoin':
      return `Marquer ma visite · ${etat.distance} trop loin`
    case 'revendiquer':
      return 'Revendiquer'
    case 'visite':
      return `✓ Visité le ${etat.le} · ${etat.distance}`
  }
}

const STYLE: Record<EtatVisite['kind'], string | undefined> = {
  localiser: styles.rouge,
  visiter: styles.rouge,
  revendiquer: styles.rouge,
  tropLoin: styles.gris,
  refusee: styles.gris,
  visite: styles.visite,
}

export function BoutonVisite({
  fiche,
  onVisite,
}: {
  fiche: Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'>
  onVisite: () => void
}) {
  const { position, demander } = usePosition()
  const { visiter, enCours, erreur } = useVisite(fiche.id)
  const etat = etatVisite(position, fiche, fiche.moi.visiteLe)
  const actif = etat.kind === 'localiser' || etat.kind === 'visiter' || etat.kind === 'revendiquer'

  function toucher() {
    if (etat.kind === 'localiser') {
      demander()
      return
    }
    if (typeof position === 'string') return
    visiter(position).then(onVisite, () => undefined) // l'échec est déjà écrit par `erreur`
  }

  return (
    <div className={styles.conteneur}>
      <button
        key={etat.kind}
        type="button"
        className={[styles.bouton, STYLE[etat.kind]].filter(Boolean).join(' ')}
        disabled={!actif || enCours}
        onClick={toucher}
      >
        {libelle(etat)}
      </button>
      {etat.kind === 'refusee' && (
        <p className={styles.aide}>
          Autorise la localisation dans les réglages du navigateur pour visiter.
        </p>
      )}
      {erreur && (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      )}
    </div>
  )
}
