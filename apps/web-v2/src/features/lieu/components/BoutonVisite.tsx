/**
 * QUOI     — le bouton de visite et ses états (maquettes 230:128 et 649:1776), et le lien discret
 *            « J'y suis allé » dessous quand on ne peut pas visiter d'ici.
 * POURQUOI — il porte son état avant qu'on le touche : le refus est écrit dessus, jamais
 *            découvert par l'échec (spec fiche §4). Le serveur juge quand même la portée ; son
 *            refus s'écrit sous le bouton.
 * ATTENTION — « Revendiquer » (déjà visité, de retour sur place) refait d'abord la visite : le
 *            serveur exige une visite de moins de 30 minutes pour revendiquer. Un souvenir
 *            (mig 531) ne se revendique pas : sur place, on le visite d'abord.
 */
import type { FicheLieu, Recompense } from '../api/lireLieu'
import { usePosition } from '@/shared/hooks/usePosition'
import { useVisite } from '../hooks/useVisite'
import { etatVisite, type EtatVisite } from '../lib/etatVisite'
import { jySuisAlle } from '../lib/souvenir'
import styles from './BoutonVisite.module.css'

function libelle(etat: EtatVisite, genre: 'm' | 'f') {
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
    case 'souvenir':
      return `✓ ${jySuisAlle(genre)} en ${etat.mois} · ${etat.distance}`
  }
}

const STYLE: Record<EtatVisite['kind'], string | undefined> = {
  localiser: styles.rouge,
  visiter: styles.rouge,
  revendiquer: styles.rouge,
  tropLoin: styles.gris,
  refusee: styles.gris,
  visite: styles.visite,
  souvenir: styles.visite,
}

export function BoutonVisite({
  fiche,
  onVisite,
  onSouvenir,
}: {
  fiche: Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'>
  onVisite: (recompense: Recompense) => void // la fête de la visite, puis la revendication
  onSouvenir: () => void
}) {
  const { position, demander } = usePosition()
  const { visiter, enCours, erreur } = useVisite(fiche.id)
  const etat = etatVisite(position, fiche, fiche.moi.visiteLe, fiche.moi.souvenirLe)
  const actif = etat.kind === 'localiser' || etat.kind === 'visiter' || etat.kind === 'revendiquer'
  // Jamais visité, et pas de visite possible d'ici (trop loin, ou sans position) : on peut dire
  // qu'on y est déjà allé. Sans position, l'état ne dit pas si le lieu est visité : on le vérifie.
  const souvenirPossible =
    fiche.moi.visiteLe === null &&
    (etat.kind === 'tropLoin' || etat.kind === 'refusee' || etat.kind === 'localiser')

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
        {libelle(etat, fiche.moi.genre)}
      </button>
      {etat.kind === 'refusee' && (
        <p className={styles.aide}>
          Autorise la localisation dans les réglages du navigateur pour visiter.
        </p>
      )}
      {souvenirPossible && (
        <button type="button" className={styles.lien} onClick={onSouvenir}>
          {jySuisAlle(fiche.moi.genre)}
        </button>
      )}
      {erreur && (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      )}
    </div>
  )
}
