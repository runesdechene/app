/**
 * QUOI     — la liste d'un classement du Panthéon : les lignes (rang en chiffres
 *            romains, portrait, nom, titre et niveau, lieux), puis ma place, dessinée comme une
 *            ligne, avec ce qui me manque pour entrer dans les dix.
 * POURQUOI — la même liste sur l'Accueil (cinq lignes) et dans la page du classement (toutes).
 *            Ma place ne dit jamais « dernier » : elle dit ce qu'il reste à faire (Uriel, 29/09).
 *            Un nom ouvre le profil, dans l'Accueil.
 */
import { Link } from 'react-router'
import { Avatar } from '@/shared/ui/Avatar'
import type { GrandExplorateur, GrandsExplorateurs, TypeDeClassement } from '../api/lireAccueil'
import { romain } from '../lib/romain'
import styles from './Classement.module.css'

const DIX = 10

function lieux(n: number) {
  return n > 1 ? 'lieux' : 'lieu'
}

// Sous le nombre, ce qu'on compte : « lieux visités » ou « lieux ajoutés » (Uriel, 29/09).
function unite(n: number, type: TypeDeClassement) {
  const fait = type === 'visites' ? 'visité' : 'ajouté'
  return `${lieux(n)} ${fait}${n > 1 ? 's' : ''}`
}

export function Classement({
  classement,
  type,
  lignes,
  avecMaPlace,
}: {
  classement: GrandsExplorateurs
  type: TypeDeClassement
  lignes: number
  avecMaPlace: boolean // hors des lignes, ma place : oui dans la page, non sur l'Accueil
}) {
  const { tete, moi } = classement
  const visibles = tete.slice(0, lignes)
  const moiVisible = moi?.rang != null && moi.rang <= visibles.length
  return (
    <div className={styles.classement}>
      <ol className={styles.tete} aria-label="Le Panthéon">
        {visibles.map((g) => (
          <Ligne key={g.id} explorateur={g} moi={moi?.rang === g.rang} type={type} />
        ))}
      </ol>
      {avecMaPlace && moi && !moiVisible && (
        <div className={styles.maPlace} aria-label="Ma place">
          <span className={styles.rang}>{moi.rang ? romain(moi.rang) : '—'}</span>
          <span className={styles.qui}>
            <span className={styles.portrait}>
              <Avatar url={moi.avatar} nom={moi.nom} taille="petit" />
            </span>
            <span className={styles.texte}>
              <span className={styles.nom}>Toi</span>
              <span className={styles.meta}>{ceQuiManque(classement, type)}</span>
            </span>
          </span>
          {moi.rang !== null && <Compte n={moi.lieux} type={type} />}
        </div>
      )}
    </div>
  )
}

// Jamais « tu es 14e sur 18 » : ce qu'il reste à faire, ou une invitation.
function ceQuiManque({ moi, dixieme, tete }: GrandsExplorateurs, type: TypeDeClassement) {
  if (!moi?.rang) {
    return type === 'visites'
      ? 'Une visite te fait entrer au Panthéon'
      : 'Un lieu ajouté te fait entrer au Panthéon'
  }
  if (moi.rang <= DIX || dixieme === null || tete.length < DIX) return 'Tu es dans les dix'
  // À égalité, le premier arrivé passe devant : il faut un lieu de plus que le dixième.
  const manque = dixieme + 1 - moi.lieux
  return `Encore ${String(manque)} ${lieux(manque)} pour entrer dans les dix`
}

function Compte({ n, type }: { n: number; type: TypeDeClassement }) {
  return (
    <span className={styles.compte}>
      {n}
      <span className={styles.unite}> {unite(n, type)}</span>
    </span>
  )
}

function Ligne({
  explorateur: g,
  moi,
  type,
}: {
  explorateur: GrandExplorateur
  moi: boolean
  type: TypeDeClassement
}) {
  const qui = [g.titre, `niveau ${String(g.niveau)}`].filter(Boolean).join(' · ')
  return (
    <li
      className={styles.ligne}
      data-moi={moi || undefined}
      data-premier={g.rang === 1 || undefined}
    >
      <span className={styles.rang}>{romain(g.rang)}</span>
      <Link className={styles.qui} to={`/accueil/explorateur/${g.id}`}>
        <span className={styles.portrait}>
          <Avatar url={g.avatar} nom={g.nom} taille="petit" />
        </span>
        <span className={styles.texte}>
          <span className={styles.nom}>{moi ? 'Toi' : g.nom}</span>
          <span className={styles.meta}>{qui}</span>
        </span>
      </Link>
      <Compte n={g.lieux} type={type} />
    </li>
  )
}
