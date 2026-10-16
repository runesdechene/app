/**
 * QUOI     — la carte « Nouveautés d'Explore » de la page Explore (Figma 545:596) : la vignette, la
 *            version, le titre de la dernière mise à jour, ses cœurs et ses mots ; elle ouvre
 *            « Nouveautés ».
 * POURQUOI — Uriel, 11/10 : la cloche lue, la note disparaissait du regard, et ses commentaires
 *            avec. Elle se montre là où l'on passe, puis s'efface (`aMontrerALAccueil`).
 * ATTENTION — la page Explore est une autre zone : la coquille pose cette carte dans son
 *            emplacement, la zone Accueil ne l'importe pas.
 */
import { Link, useLocation } from 'react-router'
import { aLaTaille } from '@/shared/lib/image'
import { ilYA } from '@/shared/lib/ilYA'
import { useNouveautes } from '../hooks/useNouveautes'
import { aMontrerALAccueil } from '../lib/aLAccueil'
import styles from './CarteNouveaute.module.css'

const TAILLE_VIGNETTE = 64

export function CarteNouveaute() {
  const { misesAJour } = useNouveautes()
  // « Nouveautés » s'ouvre dans l'onglet où l'on est, comme une fiche depuis une carte de lieu.
  const onglet = useLocation().pathname.split('/')[1] || 'accueil'
  const m = misesAJour ? aMontrerALAccueil(misesAJour, new Date()) : null
  if (!m) return null
  return (
    <Link className={styles.carte} to={`/${onglet}/nouveautes`}>
      {m.image && (
        <img
          className={styles.vignette}
          src={aLaTaille(m.image, TAILLE_VIGNETTE)}
          alt=""
          decoding="async"
        />
      )}
      <span className={styles.texte}>
        <span className={styles.surtitre}>Nouveautés{m.version && ` · ${m.version}`}</span>
        <span className={styles.titre}>{m.titre}</span>
        <span className={styles.comptes}>
          {m.coeurs > 0 && (
            <span className={styles.coeurs}>
              <span className={styles.coeur} aria-hidden="true" />
              {m.coeurs}
            </span>
          )}
          <span>
            {m.mots > 0 && `${String(m.mots)} ${m.mots > 1 ? 'mots' : 'mot'} · `}
            {ilYA(m.quand)}
          </span>
        </span>
      </span>
      <span className={styles.fleche} aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
