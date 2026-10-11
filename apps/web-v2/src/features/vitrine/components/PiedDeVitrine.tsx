/**
 * QUOI     — le bas de la vitrine, repris du site de la boutique (maquettes 549:828, 549:1097) :
 *            sa forêt immersive (les ruines et le porte-étendard, les sapins, la lisière), puis
 *            sur la crème, les réseaux, la marque et sa devise, deux colonnes de liens, la version.
 * POURQUOI — Uriel, 11/10 : que la vitrine finisse comme le site, dans son ambiance, et que la
 *            marque la signe. Pour Google, les liens vers la boutique sous le nom de la marque.
 * ATTENTION — des liens <a> vers la boutique et /mouvement (seo-pages) ; <Link> pour l'appli.
 */
import { Link } from 'react-router'
import logotype from '@/assets/ui/logotype.webp'
import { VERSION } from '@/shared/lib/version'
import styles from './PiedDeVitrine.module.css'

const BOUTIQUE = 'https://runesdechene.com'

export function PiedDeVitrine({ connecte }: { connecte: boolean }) {
  return (
    <footer className={styles.pied}>
      <div className={styles.foret} aria-hidden="true" />
      <div className={styles.creme}>
        <p className={styles.reseaux}>
          <a href="https://facebook.com/runesdechene" target="_blank" rel="noopener">
            Facebook
          </a>
          <a href="https://instagram.com/runesdechene" target="_blank" rel="noopener">
            Instagram
          </a>
        </p>

        <div className={styles.haut}>
          <div className={styles.marque}>
            <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
            <p>
              <strong>Runes de Chêne</strong> est une marque française qui fait porter l’Histoire.{' '}
              <strong>Explore</strong> est sa carte des lieux anciens et oubliés, offerte à tous.
            </p>
            <p className={styles.devise}>Apprenez. Incarnez. Explorez !</p>
          </div>

          <nav className={styles.liens} aria-label="Runes de Chêne">
            <div>
              <h2>Aller plus loin</h2>
              <a href={`${BOUTIQUE}/pages/notre-mission`}>Notre mission</a>
              <a href="/mouvement">Le Mouvement</a>
              <a href={BOUTIQUE}>La boutique</a>
            </div>
            <div>
              <h2>Explore</h2>
              <Link to="/bienvenue/carte">La carte</Link>
              <Link to={connecte ? '/carte' : '/bienvenue/preambule'}>Commencer mon périple</Link>
              <Link to={connecte ? '/carte' : '/bienvenue/email'}>Se connecter</Link>
            </div>
          </nav>
        </div>

        <p className={styles.bas}>
          <span>© {new Date().getFullYear()} Runes de Chêne</span>
          <span>{VERSION}</span>
        </p>
      </div>
    </footer>
  )
}
