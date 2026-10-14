/**
 * QUOI     — l'écran d'ouverture du Hub (maquettes 587:761, 597:1365) : en-tête, pouls, ce qui
 *            t'attend, la santé, le fil d'activité.
 * POURQUOI — la période est dans l'adresse (?periode=30) : tout état navigable est une URL.
 */
import { useSearchParams } from 'react-router'
import type { Periode } from '../api/ouverture'
import { useOuverture } from '../hooks/useOuverture'
import { Attente } from './Attente'
import { EnTete } from './EnTete'
import { Pouls } from './Pouls'
import { Sante } from './Sante'
import styles from './Ouverture.module.css'

const VALIDES: Periode[] = ['1', '7', '30', '90']

export function Ouverture() {
  const [params, setParams] = useSearchParams()
  const brute = params.get('periode')
  const periode: Periode = VALIDES.find((p) => p === brute) ?? '7'
  const { data, isError, refetch } = useOuverture(periode)
  const maintenant = new Date()

  return (
    <div className={styles.ouverture}>
      <EnTete periode={periode} onPeriode={(p) => { setParams({ periode: p }) }} pouls={data?.pouls} maintenant={maintenant} />
      {isError && (
        <p className={styles.calme}>
          La base ne répond pas. <button type="button" onClick={() => void refetch()}>Réessayer</button>
        </p>
      )}
      {data && (
        <>
          <Pouls pouls={data.pouls} avant={data.avant} />
          <div className={styles.paire}>
            <Attente attente={data.attente} maintenant={maintenant} />
            <Sante sante={data.sante} maintenant={maintenant} />
          </div>
        </>
      )}
    </div>
  )
}
