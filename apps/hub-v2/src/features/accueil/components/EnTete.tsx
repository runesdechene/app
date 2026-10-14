/**
 * QUOI     — l'en-tête de l'ouverture : la date, « Bonjour », une phrase de la période, le
 *            choix de la période.
 */
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import type { Ouverture, Periode } from '../api/ouverture'
import styles from './Ouverture.module.css'

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: '1', libelle: 'Aujourd’hui' },
  { valeur: '7', libelle: '7 jours' },
  { valeur: '30', libelle: '30 jours' },
  { valeur: '90', libelle: '90 jours' },
]

const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export function EnTete({ periode, onPeriode, pouls, maintenant }: {
  periode: Periode; onPeriode: (p: Periode) => void; pouls: Ouverture['pouls'] | undefined; maintenant: Date
}) {
  return (
    <header className={styles.entete}>
      <div className={styles.salut}>
        <p className={styles.date}>{date.format(maintenant)}</p>
        <h1 className={styles.bonjour}>Bonjour Uriel</h1>
        {pouls && (
          <p className={styles.phrase}>
            {pouls.nouveaux} nouveaux Explorateurs, {pouls.visites} visites sur place.
          </p>
        )}
      </div>
      <ChoixSegmente nom="Période" options={PERIODES} choisi={periode} onChoix={onPeriode} />
    </header>
  )
}
