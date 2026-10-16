/**
 * QUOI     — « Associer un Fragment » : chercher un Explorateur, le choisir, puis lui donner ou lui
 *            retirer un Fragment (le bloc de sa fiche, AssocierFragment).
 * POURQUOI — le geste le plus courant de la boutique méritait sa page, comme dans l'ancien Hub
 *            (Uriel, 16/10). La recherche (q) et le compte choisi (compte) sont dans l'adresse.
 */
import { Link, useSearchParams } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { useCompte } from '../hooks/useCompte'
import { useComptes } from '../hooks/useComptes'
import { AssocierFragment } from './AssocierFragment'
import styles from './Communaute.module.css'

const RESULTATS = 8

export function AssocierUnFragment() {
  const [params, setParams] = useSearchParams()
  const recherche = params.get('q') ?? ''
  const compte = params.get('compte')

  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Fragments et boutique" titre="Associer un Fragment"
        phrase="Cherche un Explorateur, puis donne-lui ou retire-lui un Fragment." />
      {compte ? (
        <CompteChoisi id={compte} retour={recherche} />
      ) : (
        <>
          <div className={styles.barre}>
            <ChampDeRecherche valeur={recherche} etiquette="Un nom, un e-mail…"
              onChange={(q) => { setParams(q ? { q } : {}, { replace: true }) }} />
          </div>
          {recherche && <Resultats recherche={recherche} />}
        </>
      )}
    </div>
  )
}

function Resultats({ recherche }: { recherche: string }) {
  const { data, isError } = useComptes({
    filtre: 'tous', recherche, provenance: null, departement: null, tri: 'nom', limite: RESULTATS, decalage: 0,
  })
  if (isError) return <p className={styles.calme}>La base ne répond pas.</p>
  if (!data) return null
  return (
    <Bloc>
      {data.lignes.length === 0 && <p className={styles.calme}>Aucun Explorateur ne correspond.</p>}
      {data.lignes.map((c) => (
        <Link key={c.id} className={`${styles.ligneFiche ?? ''} ${styles.lienFiche ?? ''}`} to={{ search: `?q=${encodeURIComponent(recherche)}&compte=${c.id}` }}>
          {c.avatar ? <img className={styles.vignette} src={c.avatar} alt="" loading="lazy" /> : <span className={styles.vignette} />}
          <span>{c.nom}</span>
          <span className={styles.detail}>{c.email ?? ''}</span>
          <span className={styles.air} />
          <span className={styles.detail}>{c.fragments === 1 ? '1 Fragment' : `${String(c.fragments)} Fragments`}</span>
        </Link>
      ))}
    </Bloc>
  )
}

function CompteChoisi({ id, retour }: { id: string; retour: string }) {
  const { data, isError } = useCompte(id)
  if (isError) return <p className={styles.calme}>La base ne répond pas.</p>
  if (!data) return null
  return (
    <>
      <Bloc>
        <div className={styles.ligneFiche}>
          {data.avatar ? <img className={styles.vignette} src={data.avatar} alt="" /> : <span className={styles.vignette} />}
          <span>{data.nom}</span>
          <span className={styles.detail}>{data.email ?? ''}</span>
          <span className={styles.air} />
          <Link className={styles.boutonContour} to={{ search: retour ? `?q=${encodeURIComponent(retour)}` : '' }}>Choisir un autre Explorateur</Link>
        </div>
      </Bloc>
      <AssocierFragment compte={data.id} fragments={data.fragments} />
    </>
  )
}
