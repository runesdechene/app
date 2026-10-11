/**
 * QUOI     — la mise en page commune des textes légaux : le logo vers la vitrine, le titre, la date
 *            de la version, le texte, puis les liens vers les deux autres textes.
 * POURQUOI — trois pages publiques, lisibles sans compte (LCEN art. 6, RGPD art. 13), liées depuis
 *            le bas de la vitrine et des fiches, l'inscription et les Préférences.
 */
import { type ReactNode } from 'react'
import { Link } from 'react-router'
import logotype from '@/assets/ui/logotype.webp'
import { DATE_DES_CONDITIONS } from '@/shared/lib/conditions'
import styles from './PageLegale.module.css'

const TEXTES = [
  { chemin: '/legal/mentions', nom: 'Mentions légales' },
  { chemin: '/legal/confidentialite', nom: 'Politique de confidentialité' },
  { chemin: '/legal/conditions', nom: 'Conditions d’utilisation' },
]

export function PageLegale({
  titre,
  chemin,
  children,
}: {
  titre: string
  chemin: string
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <title>{`${titre} — Runes de Chêne`}</title>
      <header className={styles.entete}>
        <Link to="/bienvenue">
          <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
        </Link>
      </header>
      <article className={styles.texte}>
        <h1>{titre}</h1>
        <p className={styles.version}>Version du {DATE_DES_CONDITIONS}</p>
        {children}
      </article>
      <nav className={styles.autres} aria-label="Textes légaux">
        {TEXTES.filter((t) => t.chemin !== chemin).map((t) => (
          <Link key={t.chemin} to={t.chemin}>
            {t.nom}
          </Link>
        ))}
        <Link to="/bienvenue">Retour à Explore</Link>
      </nav>
    </main>
  )
}
