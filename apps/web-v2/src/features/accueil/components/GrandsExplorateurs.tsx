/**
 * QUOI     — « Les Grands Explorateurs » (maquette 275:128) : un classement au choix — les lieux
 *            visités ou ajoutés, ce mois-ci ou depuis toujours. Les cinq premiers en chiffres
 *            romains, les dix sur demande ; puis ma place, dessinée comme une ligne du
 *            classement, avec ce qui me manque pour entrer dans les dix.
 * POURQUOI — validé par Uriel (28-29/09), contre la spec V2 §5 qui excluait tout classement : par
 *            défaut, le compteur du mois, qui repart à zéro (mig 378). Ma place ne dit jamais
 *            « dernier » : elle dit ce qu'il reste à faire. Un nom ouvre le profil, dans l'Accueil.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import sectionGrandsExplorateurs from '@/assets/ui/section-nouvelles.png'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { Avatar } from '@/shared/ui/Avatar'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Segments } from '@/shared/ui/Segments'
import type {
  GrandExplorateur,
  GrandsExplorateurs as Classement,
  Periode,
  TypeDeClassement,
} from '../api/lireAccueil'
import { useGrandsExplorateurs } from '../hooks/useAccueil'
import { romain } from '../lib/romain'
import styles from './GrandsExplorateurs.module.css'

const D_ABORD = 5
const DIX = 10
const TYPES = [
  { id: 'visites', libelle: 'Visités' },
  { id: 'ajouts', libelle: 'Ajoutés' },
] as const
const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'mois', libelle: 'Ce mois-ci' },
  { id: 'toujours', libelle: 'Depuis toujours' },
]

function lieux(n: number) {
  return n > 1 ? 'lieux' : 'lieu'
}

export function GrandsExplorateurs() {
  const [type, setType] = useState<TypeDeClassement>('visites')
  const [periode, setPeriode] = useState<Periode>('mois')
  const [tout, setTout] = useState(false)
  const classement = useGrandsExplorateurs(type, periode)
  if (!classement) return null
  const { tete, moi } = classement
  const visibles = tout ? tete : tete.slice(0, D_ABORD)
  const moiVisible = moi?.rang != null && moi.rang <= visibles.length

  return (
    <section className={styles.grands} aria-label="Les Grands Explorateurs">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionGrandsExplorateurs} alt="" />
        Les Grands Explorateurs
      </h2>
      <div className={styles.choix}>
        <Segments libelle="Classement" options={TYPES} valeur={type} onChange={setType} />
        <div className={styles.periodes} role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <PastilleChoix
              key={p.id}
              libelle={p.libelle}
              choisie={periode === p.id}
              onClick={() => {
                setPeriode(p.id)
              }}
            />
          ))}
        </div>
      </div>

      {tete.length === 0 ? (
        <p className={styles.vide}>
          {periode === 'mois'
            ? 'Personne encore ce mois-ci : à toi d’ouvrir la marche.'
            : 'Personne encore : à toi d’ouvrir la marche.'}
        </p>
      ) : (
        <ol className={styles.tete} aria-label="Les Grands Explorateurs">
          {visibles.map((g) => (
            <Ligne key={g.id} explorateur={g} moi={moi?.rang === g.rang} />
          ))}
        </ol>
      )}

      {moi && !moiVisible && (
        <div className={styles.maPlace} aria-label="Ma place">
          <span className={styles.rang}>{moi.rang ? romain(moi.rang) : '—'}</span>
          <span className={styles.qui}>
            <span className={styles.portrait}>
              <Avatar url={moi.avatar} nom={moi.nom} taille="petit" />
            </span>
            <span className={styles.texte}>
              <span className={styles.nom}>Toi</span>
              <span className={styles.meta}>{ceQuiManque(classement, type, periode)}</span>
            </span>
          </span>
          {moi.rang !== null && <Compte n={moi.lieux} />}
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

// Jamais « tu es 14e sur 18 » : ce qu'il reste à faire, ou une invitation.
function ceQuiManque({ moi, dixieme, tete }: Classement, type: TypeDeClassement, periode: Periode) {
  const quand = periode === 'mois' ? ' ce mois-ci' : ''
  if (!moi?.rang) {
    return type === 'visites'
      ? `Une visite${quand} te fait entrer au classement`
      : `Un lieu ajouté${quand} te fait entrer au classement`
  }
  if (moi.rang <= DIX || dixieme === null || tete.length < DIX) return `Tu es dans les dix${quand}`
  // À égalité, le premier arrivé passe devant : il faut un lieu de plus que le dixième.
  const manque = dixieme + 1 - moi.lieux
  return `Encore ${String(manque)} ${lieux(manque)} pour entrer dans les dix`
}

function Compte({ n }: { n: number }) {
  return (
    <span className={styles.compte}>
      {n}
      <span className={styles.unite}> {lieux(n)}</span>
    </span>
  )
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
      <Link className={styles.qui} to={`/accueil/explorateur/${g.id}`} state={VENU_D_UN_ECRAN}>
        <span className={styles.portrait}>
          <Avatar url={g.avatar} nom={g.nom} taille="petit" />
        </span>
        <span className={styles.texte}>
          <span className={styles.nom}>{moi ? 'Toi' : g.nom}</span>
          <span className={styles.meta}>{qui}</span>
        </span>
      </Link>
      <Compte n={g.lieux} />
    </li>
  )
}
