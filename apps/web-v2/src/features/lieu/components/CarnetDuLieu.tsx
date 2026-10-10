/**
 * QUOI     — le Carnet de passage d'un lieu : le carnet commun (`shared/ui/Carnet`) alimenté par
 *            `useCarnet`. Sur la fiche, les trois derniers mots et « Lire les N mots » ; la page du
 *            carnet les montre tous.
 * POURQUOI — les commentaires de la V1 reviennent sous la fiche, dans le ton de la V2 (mig 389).
 */
import { Link } from 'react-router'
import { Carnet } from '@/shared/ui/Carnet'
import { useCarnet } from '../hooks/useCarnet'
import styles from './CarnetDuLieu.module.css'

const pluriel = (n: number) => `${String(n)} ${n > 1 ? 'mots' : 'mot'}`

export function CarnetDuLieu({ id, limite }: { id: string; limite: number | null }) {
  const { carnet, ecrire, aimer, effacer } = useCarnet(id, limite)
  if (!carnet) return null

  const montres = carnet.mots.reduce((n, m) => n + 1 + m.reponses.length, 0)
  return (
    <Carnet
      carnet={carnet}
      actions={{ ecrire: ecrire.mutate, enCours: ecrire.isPending, erreur: ecrire.error, aimer, effacer }}
      titre="Carnet de passage"
      chapo="Ce que les Explorateurs ont laissé ici : conseils, souvenirs…"
      indication="Laisse un mot sur ce lieu…"
      page={limite === null}
      lireTout={
        limite !== null &&
        carnet.total > montres && (
          <Link className={styles.tout} to="carnet" relative="path">
            Lire les {pluriel(carnet.total)} ›
          </Link>
        )
      }
    />
  )
}
