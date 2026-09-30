/**
 * QUOI     — la vitrine (maquettes 314:146 téléphone, 314:203 ordinateur) : la photo des deux
 *            voyageurs, le logo, l'activité de la carte, la recherche, la devise, les natures,
 *            « Commencer mon périple » et l'entrée des clients déjà connus.
 * POURQUOI — l'esprit de l'Accueil de l'onboarding, qu'elle remplace (Uriel, 30/09), et une vraie
 *            recherche ouverte à tous : on cherche et on voit un lieu sans compte ; le reste
 *            s'ouvre en rejoignant. Les chiffres sont vrais (get_landing_stats), jamais en dur.
 * ATTENTION — un seul arbre pour les deux maquettes : sur ordinateur, `.haut` s'efface
 *            (display: contents) et la grille range ses enfants dans l'ordre de la maquette PC.
 *            L'activité est posée en haut, hors du flux (Uriel, 30/09) : qu'elle tienne sur une
 *            ligne ou deux, rien ne bouge autour d'elle.
 */
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import logo from '@/assets/onboarding/logo-clair.webp'
import { useChiffres, useNatures } from '../hooks/useVitrine'
import { ApercuActivite } from './ApercuActivite'
import { DefileNatures } from './DefileNatures'
import { Recherche } from './Recherche'
import styles from './Vitrine.module.css'

const NOMBRE = new Intl.NumberFormat('fr-FR')
// Le nom de la version en cours, à changer à chaque version publiée.
const VERSION = 'Version Pytheas 0.21'

export function Vitrine() {
  const chiffres = useChiffres()
  const natures = useNatures()
  const [texte, setTexte] = useState('')
  const [nature, setNature] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  return (
    <main className={styles.vitrine}>
      <div className={styles.haut}>
        <header className={styles.entete}>
          <img className={styles.logo} src={logo} alt="Runes de Chêne" />
          <span className={styles.logotype} role="img" aria-label="Runes de Chêne Explore" />
          <p className={styles.explore}>Explore</p>
          <div className={styles.vie}>
            {chiffres && (
              <p className={styles.chiffres}>
                <strong>{NOMBRE.format(chiffres.lieux)}</strong> lieux d’Histoire ·{' '}
                <strong>{NOMBRE.format(chiffres.explorateurs)}</strong> Explorateurs
              </p>
            )}
            <ApercuActivite />
          </div>
        </header>

        {chiffres && (
          <p className={styles.phrase}>
            <strong>{NOMBRE.format(chiffres.lieux)}</strong> hauts lieux, anciens, magiques ou
            atypiques de nos contrées, ajoutés par{' '}
            <strong>{NOMBRE.format(chiffres.explorateurs)}</strong> explorateurs.
          </p>
        )}

        <div className={styles.cherche}>
          <Recherche
            ref={champ}
            texte={texte}
            nature={natures.find((n) => n.id === nature) ?? null}
            onTexte={setTexte}
            onRetirerNature={() => {
              setNature(null)
              champ.current?.focus()
            }}
          />
        </div>
      </div>

      <h1 className={styles.devise}>
        <span className={styles.porter}>Porter l’Histoire</span>
        <span className={styles.explorer}>Explorer le monde</span>
      </h1>

      <p className={styles.description}>
        Une carte vivante du patrimoine naturel et historique pour réenchanter le monde et recréer
        du lien dans nos régions. Propulsé gratuitement et avec <u>amour</u> par la marque{' '}
        <strong>Runes de Chêne.</strong>
      </p>

      <div className={styles.natures}>
        <DefileNatures
          natures={natures}
          choisie={nature}
          onChoisir={(id) => {
            // La recherche prend le focus : ses résultats s'ouvrent, filtrés par la nature.
            setNature(id)
            champ.current?.focus()
          }}
        />
      </div>

      <div className={styles.actions}>
        <Link className={styles.commencer} to="/bienvenue/preambule">
          Commencer mon périple
        </Link>
        <Link className={styles.connecter} to="/bienvenue/email">
          {/* Un seul bloc de texte : la grille du lien ne coupe pas la phrase en trois. */}
          <span>
            Se connecter avec mon <strong>Compte client</strong>{' '}
            <strong className={styles.marque}>Runes de Chêne</strong>
          </span>
        </Link>
      </div>

      <p className={styles.version}>{VERSION}</p>
    </main>
  )
}
