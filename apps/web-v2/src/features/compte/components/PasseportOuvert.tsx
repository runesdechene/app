/**
 * QUOI     — le passeport ouvert (maquette « Passeport — 2 », 429:519) : une page par
 *            département ou pays, comme des visas ; ses 4 tampons les plus récents en photo
 *            encrée qui se chevauchent, avec leur date ; « +N › » ouvre le territoire.
 * POURQUOI — pas de nom de lieu ici (Uriel, 06/10) : la page dit « où » et « quand », le
 *            détail est un toucher plus loin.
 */
import { Link, useParams } from 'react-router'
import { usePasseport } from '../hooks/usePasseport'
import { dateCourte } from '../lib/dates'
import { parTerritoire } from '../lib/passeport'
import { TamponPhoto } from './TamponPhoto'
import styles from './PasseportOuvert.module.css'

const MONTRES = 4

export function PasseportOuvert({ id }: { id: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <p>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.reessayer} onClick={reessayer}>
          Réessayer
        </button>
      </div>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />
  if (passeport === null) return <p className={styles.etat}>Ce passeport n’existe pas.</p>

  const natures = new Map(passeport.natures.map((n) => [n.id, n]))
  return (
    <ul className={styles.pages}>
      {parTerritoire(passeport.tampons).map((t) => (
        <li key={t.nom}>
          <Link
            className={styles.page}
            to={`/${tab}/explorateur/${id}/passeport/${encodeURIComponent(t.nom)}`}
          >
            <span className={styles.entete}>
              <span className={styles.nom}>{t.nom}</span>
              <span className={styles.compte}>
                {t.tampons.length} {t.tampons.length > 1 ? 'tampons' : 'tampon'}
              </span>
              {t.tampons.length > MONTRES && (
                <span className={styles.plus}>+{t.tampons.length - MONTRES} ›</span>
              )}
            </span>
            <span className={styles.tampons}>
              {t.tampons.slice(0, MONTRES).map((x) => (
                <TamponPhoto
                  key={x.id}
                  tampon={x}
                  nature={x.nature === null ? null : (natures.get(x.nature) ?? null)}
                  date={dateCourte(x.quand, passeport.auJour)}
                />
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
