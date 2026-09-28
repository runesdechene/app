/**
 * QUOI     — le premier écran (maquette 94:107) : la photo des deux voyageurs, le logo, la
 *            devise, « Rejoindre 4 978 Explorateurs » et l'entrée des clients déjà connus.
 * POURQUOI — les deux chiffres sont vrais (get_landing_stats), jamais écrits en dur : un nombre
 *            figé ment six mois plus tard. Sans eux (hors ligne), les phrases se passent de
 *            nombre. « Se connecter » saute le Préambule et la Charte, déjà signée.
 */
import { useQuery } from '@tanstack/react-query'
import logo from '@/assets/onboarding/logo-clair.webp'
import { fetchChiffres } from '../api/entree'
import { useParcours } from '../hooks/useParcours'
import styles from './EcranAccueil.module.css'

const NOMBRE = new Intl.NumberFormat('fr-FR')

export function EcranAccueil() {
  const { data: chiffres } = useQuery({ queryKey: ['entree', 'chiffres'], queryFn: fetchChiffres })
  const { aller } = useParcours()

  return (
    <main className={styles.accueil}>
      <div className={styles.photo}>
        <img className={styles.logo} src={logo} alt="Runes de Chêne" />
        <p className={styles.explore}>Explore</p>
        {chiffres && (
          <p className={styles.lieux}>
            <span className={styles.nombre}>{NOMBRE.format(chiffres.lieux)}</span> lieux sortis de
            l’oubli
          </p>
        )}
      </div>

      <div className={styles.bas}>
        <h1 className={styles.devise}>
          <span className={styles.porter}>Porter l’Histoire</span>
          <span className={styles.explorer}>Explorer le monde</span>
        </h1>
        <button
          type="button"
          className={styles.rejoindre}
          onClick={() => {
            aller('preambule')
          }}
        >
          Rejoindre{' '}
          {chiffres && (
            <span className={styles.nombre}>{NOMBRE.format(chiffres.explorateurs)}</span>
          )}{' '}
          Explorateurs
        </button>
        <button
          type="button"
          className={styles.connecter}
          onClick={() => {
            aller('email')
          }}
        >
          Se connecter avec mon <strong>Compte client</strong>{' '}
          <strong className={styles.marque}>Runes de Chêne</strong>
        </button>
        <p className={styles.mention}>
          Application développée et éditée avec amour par la marque Runes de Chêne, librement
          offerte. Toute création de compte crée un compte Runes de Chêne.
        </p>
      </div>
    </main>
  )
}
