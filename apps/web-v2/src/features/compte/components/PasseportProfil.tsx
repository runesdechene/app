/**
 * QUOI     — le passeport sur le profil (maquette « Passeport — 1 », 432:272) : un tampon par
 *            nature avec son compte, « N départements · N pays », « Ouvrir le passeport ».
 * POURQUOI — remplace la rangée « Visités » : à 200 lieux, une rangée de cartes ne disait plus
 *            rien ; 22 tampons au plus disent tout, à 5 comme à 300 lieux.
 *            Zéro tampon : la section n'existe pas (comme l'ancienne).
 */
import { Link, useParams } from 'react-router'
import { usePasseport } from '../hooks/usePasseport'
import { comptes, parNature } from '../lib/passeport'
import { TamponNature } from './TamponNature'
import styles from './PasseportProfil.module.css'

function accorder(n: number, un: string, plusieurs: string): string {
  return `${String(n)} ${n > 1 ? plusieurs : un}`
}

export function PasseportProfil({ id }: { id: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)

  if (erreur) {
    return (
      <section className={styles.section} aria-label="Passeport">
        <p className={styles.erreur}>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.reessayer} onClick={reessayer}>
          Réessayer
        </button>
      </section>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />
  if (passeport === null || passeport.tampons.length === 0) return null

  const { departements, pays } = comptes(passeport.tampons)
  const lieux = [
    departements > 0 ? accorder(departements, 'département', 'départements') : null,
    pays > 0 ? `${String(pays)} pays` : null,
  ].filter((x) => x !== null)

  return (
    <section className={styles.section} aria-label="Passeport">
      <h2 className={styles.titre}>
        Passeport{' '}
        <span className={styles.nombre}>
          {accorder(passeport.tampons.length, 'tampon', 'tampons')}
        </span>
      </h2>
      <div className={styles.page}>
        {parNature(passeport.natures, passeport.tampons).map((n) => (
          <TamponNature key={n.nature.id} nature={n.nature} compte={n.compte} encre={n.encre} />
        ))}
      </div>
      <p className={styles.pied}>
        <span>{lieux.join(' · ')}</span>
        <Link className={styles.ouvrir} to={`/${tab}/explorateur/${id}/passeport`}>
          Ouvrir le passeport ›
        </Link>
      </p>
    </section>
  )
}
