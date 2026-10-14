/**
 * QUOI     — l'en-tête de l'ouverture : la date, « Bonjour », une phrase de la période, le
 *            choix de la période.
 */
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import type { Ouverture, Periode } from '../api/ouverture'
import styles from './Ouverture.module.css'

const LIBELLES: Record<Periode, string> = {
  jour: 'Aujourd’hui',
  semaine: 'Cette semaine',
  mois: 'Ce mois-ci',
  toujours: 'Depuis toujours',
}

const PERIODES = Object.entries(LIBELLES).map(([valeur, libelle]) => ({ valeur: valeur as Periode, libelle }))

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
            {LIBELLES[periode]} : {pouls.nouveaux} {pouls.nouveaux === 1 ? 'nouvel Explorateur' : 'nouveaux Explorateurs'}, {pouls.visites}{' '}
            {pouls.visites === 1 ? 'visite' : 'visites'} sur place.
          </p>
        )}
      </div>
      <ChoixSegmente nom="Période" options={PERIODES} choisi={periode} onChoix={onPeriode} />
    </header>
  )
}
