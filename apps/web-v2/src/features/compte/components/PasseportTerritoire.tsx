/**
 * QUOI     — un territoire en détail (maquette « Passeport — 3 », 442:272) : le résumé, ses
 *            natures, puis un défilement horizontal par mois de cartes « Lieux ajoutés », le
 *            tampon de la nature posé sur le coin, la date du jour en pastille (pour soi).
 * POURQUOI — « sans tampon pour les lieux en détail, juste un scroll horizontal » (Uriel,
 *            07/10) : la photo redevient l'héroïne, le tampon reste en coin. Les deux mois
 *            les plus récents sont ouverts, les autres repliés : la page reste courte.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import type { Nature, Tampon } from '../api/lirePasseport'
import { usePasseport } from '../hooks/usePasseport'
import { dateCourte, depuis, moisLong } from '../lib/dates'
import { parMois, parNature, territoireDe, type Mois } from '../lib/passeport'
import { TamponNature } from './TamponNature'
import styles from './PasseportTerritoire.module.css'

const OUVERTS = 2

export function PasseportTerritoire({ id, territoire }: { id: string; territoire: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)
  const [deplies, setDeplies] = useState<string[]>([])

  if (erreur) {
    return (
      <div className={styles.etat}>
        <p>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.lien} onClick={reessayer}>
          Réessayer
        </button>
      </div>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />

  const tampons = (passeport?.tampons ?? []).filter((t) => territoireDe(t) === territoire)
  if (passeport === null || tampons.length === 0) {
    return (
      <div className={styles.etat}>
        <p>Ce territoire n’est pas dans le passeport.</p>
        <Link className={styles.lien} to={`/${tab}/explorateur/${id}/passeport`}>
          ‹ Le passeport
        </Link>
      </div>
    )
  }

  const natures = parNature(passeport.natures, tampons).filter((n) => n.encre !== null)
  const parId = new Map(passeport.natures.map((n) => [n.id, n]))
  const plusAncien = tampons[tampons.length - 1]?.quand ?? ''
  const mois = parMois(tampons)

  return (
    <div className={styles.page}>
      <p className={styles.resume}>
        {tampons.length} {tampons.length > 1 ? 'tampons' : 'tampon'} · {natures.length}{' '}
        {natures.length > 1 ? 'natures' : 'nature'} sur {passeport.natures.length} ·{' '}
        {depuis(plusAncien, passeport.auJour)}
      </p>
      <h2 className={styles.rubrique}>Ses natures</h2>
      <div className={styles.natures}>
        {natures.map((n) => (
          <TamponNature key={n.nature.id} nature={n.nature} compte={n.compte} encre={n.encre} />
        ))}
      </div>
      {mois.map((m, i) =>
        i < OUVERTS || deplies.includes(m.cle) ? (
          <MoisOuvert key={m.cle} mois={m} natures={parId} auJour={passeport.auJour} />
        ) : (
          <button
            key={m.cle}
            type="button"
            className={styles.replie}
            onClick={() => {
              setDeplies([...deplies, m.cle])
            }}
          >
            {moisLong(m.cle)} · {m.tampons.length} {m.tampons.length > 1 ? 'tampons' : 'tampon'} ›
          </button>
        ),
      )}
    </div>
  )
}

function MoisOuvert({
  mois,
  natures,
  auJour,
}: {
  mois: Mois
  natures: Map<string, Nature>
  auJour: boolean
}) {
  const glisser = useGlisser()
  const titre = `${moisLong(mois.cle)} · ${String(mois.tampons.length)} ${mois.tampons.length > 1 ? 'tampons' : 'tampon'}`
  return (
    <section className={styles.mois} aria-label={titre}>
      <h3 className={styles.rubrique}>{titre}</h3>
      <div className={styles.cadre}>
        <ul ref={glisser} className={styles.rangee}>
          {mois.tampons.map((t) => (
            <Carte
              key={t.id}
              tampon={t}
              nature={t.nature === null ? null : (natures.get(t.nature) ?? null)}
              auJour={auJour}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}

function Carte({
  tampon,
  nature,
  auJour,
}: {
  tampon: Tampon
  nature: Nature | null
  auJour: boolean
}) {
  return (
    <LieuCarte
      lieu={{
        id: tampon.id,
        nom: tampon.nom,
        imageUrl: tampon.imageUrl,
        latitude: null,
        longitude: null,
        categorie: nature ? { icone: nature.icone } : null,
        auteur: null,
      }}
      position={null}
      avecAuteur={false}
      {...(auJour ? { pastille: dateCourte(tampon.quand, true) } : {})}
      coin={
        nature ? <TamponNature nature={nature} compte={1} encre="fort" taille="petit" /> : undefined
      }
    />
  )
}
