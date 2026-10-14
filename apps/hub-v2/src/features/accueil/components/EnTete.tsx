/**
 * QUOI     — l'en-tête de l'ouverture : la date, « Bonjour », une phrase de la période, le
 *            choix de la période.
 */
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import type { Ouverture, Periode } from '../api/ouverture'
import styles from './Ouverture.module.css'

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: 'jour', libelle: 'Aujourd’hui' },
  { valeur: 'semaine', libelle: 'Cette semaine' },
  { valeur: 'mois', libelle: 'Ce mois-ci' },
  { valeur: 'toujours', libelle: 'Depuis toujours' },
]

const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function libelleDe(periode: Periode) {
  return PERIODES.find((p) => p.valeur === periode)?.libelle
}

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
            {libelleDe(periode)} : {pouls.nouveaux} {pouls.nouveaux === 1 ? 'nouvel Explorateur' : 'nouveaux Explorateurs'}, {pouls.visites}{' '}
            {pouls.visites === 1 ? 'visite' : 'visites'} sur place.
          </p>
        )}
      </div>
      <ChoixSegmente nom="Période" options={PERIODES} choisi={periode} onChoix={onPeriode} />
    </header>
  )
}
