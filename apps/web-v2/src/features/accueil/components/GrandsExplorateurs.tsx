/**
 * QUOI     — « Les Grands Explorateurs » (maquette 275:128) : ceux qui ont le plus marché ce
 *            mois-ci. Les trois premiers, en chiffres romains, puis les dix sur demande ; et ma
 *            place, toujours visible, avec ce qui me manque pour entrer dans les dix.
 * POURQUOI — validé par Uriel (28-29/09), contre la spec V2 §5 qui excluait tout classement : le
 *            compteur repart à zéro chaque mois (mig 377), et ma place ne dit jamais « dernier »
 *            — elle dit ce qu'il reste à marcher. Un nom ouvre le profil, dans l'Accueil.
 *            Personne n'a encore marché ce mois-ci : le bloc ne s'affiche pas.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import sectionGrandsExplorateurs from '@/assets/ui/section-nouvelles.png'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { Avatar } from '@/shared/ui/Avatar'
import type { GrandExplorateur } from '../api/lireAccueil'
import { useGrandsExplorateurs } from '../hooks/useAccueil'
import { romain } from '../lib/romain'
import styles from './GrandsExplorateurs.module.css'

const D_ABORD = 3
const DIX = 10

function lieux(n: number) {
  return n > 1 ? 'lieux' : 'lieu'
}

export function GrandsExplorateurs() {
  const classement = useGrandsExplorateurs()
  const [tout, setTout] = useState(false)
  if (!classement || classement.tete.length === 0) return null
  const { tete, moi, dixieme } = classement
  const visibles = tout ? tete : tete.slice(0, D_ABORD)
  const moiVisible = moi !== null && moi.rang <= visibles.length

  return (
    <section className={styles.grands} aria-label="Les Grands Explorateurs">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionGrandsExplorateurs} alt="" />
        Les Grands Explorateurs
      </h2>
      <p className={styles.chapo}>Ceux qui ont le plus marché ce mois-ci</p>

      <ol className={styles.tete} aria-label="Les Grands Explorateurs">
        {visibles.map((g) => (
          <Ligne key={g.id} explorateur={g} moi={moi?.rang === g.rang} />
        ))}
      </ol>

      {!moiVisible && (
        <div className={styles.maPlace} aria-label="Ma place">
          <span className={styles.rang}>{moi ? romain(moi.rang) : '—'}</span>
          <span className={styles.texte}>
            <span className={styles.nom}>Toi</span>
            <span className={styles.meta}>{ceQuiManque(moi, dixieme, tete.length)}</span>
          </span>
          {moi && (
            <span className={styles.compte}>
              {moi.lieux}
              <span className={styles.unite}> {lieux(moi.lieux)}</span>
            </span>
          )}
        </div>
      )}

      {!tout && tete.length > D_ABORD && (
        <button
          type="button"
          className={styles.plus}
          onClick={() => {
            setTout(true)
          }}
        >
          Voir tout le classement
        </button>
      )}
    </section>
  )
}

// Jamais « tu es 14e sur 18 » : ce qu'il reste à marcher, ou une invitation.
function ceQuiManque(
  moi: { rang: number; lieux: number } | null,
  dixieme: number | null,
  combien: number,
): string {
  if (!moi) return 'Une visite ce mois-ci te fait entrer au classement'
  if (moi.rang <= DIX || dixieme === null || combien < DIX) return 'Tu es dans les dix ce mois-ci'
  // À égalité, le premier arrivé passe devant : il faut un lieu de plus que le dixième.
  const manque = dixieme + 1 - moi.lieux
  return `Encore ${String(manque)} ${lieux(manque)} pour entrer dans les dix`
}

function Ligne({ explorateur: g, moi }: { explorateur: GrandExplorateur; moi: boolean }) {
  const qui = [g.titre, `niveau ${String(g.niveau)}`].filter(Boolean).join(' · ')
  return (
    <li
      className={styles.ligne}
      data-moi={moi || undefined}
      data-premier={g.rang === 1 || undefined}
    >
      <span className={styles.rang}>{romain(g.rang)}</span>
      <Link className={styles.lien} to={`/accueil/explorateur/${g.id}`} state={VENU_D_UN_ECRAN}>
        <span className={styles.portrait}>
          <Avatar url={g.avatar} nom={g.nom} taille="petit" />
        </span>
        <span className={styles.texte}>
          <span className={styles.nom}>{g.nom}</span>
          <span className={styles.meta}>{qui}</span>
        </span>
      </Link>
      <span className={styles.compte}>
        {g.lieux}
        <span className={styles.unite}> {lieux(g.lieux)}</span>
      </span>
    </li>
  )
}
