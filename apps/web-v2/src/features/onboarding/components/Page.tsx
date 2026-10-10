/**
 * QUOI     — le cadre commun des écrans d'entrée (maquettes 94:142 à 95:107) : le parchemin, la
 *            flèche de retour quand il y en a une, le contenu, puis l'action en bas.
 * POURQUOI — les sept écrans ont ce cadre ; l'écrire une fois garde chaque écran court.
 *            Le retour est celui du navigateur : chaque écran a son adresse.
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import retour from '@/assets/onboarding/retour.svg'
import styles from './Onboarding.module.css'

export function Page({
  avecRetour = false,
  bas,
  children,
}: {
  avecRetour?: boolean
  bas?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <main className={styles.page}>
      <div className={styles.haut}>
        {avecRetour && (
          <button
            type="button"
            className={styles.retour}
            aria-label="Retour"
            onClick={() => {
              void navigate(-1)
            }}
          >
            <img src={retour} alt="" width={24} height={24} />
          </button>
        )}
      </div>
      <div className={styles.contenu}>{children}</div>
      {bas && <div className={styles.bas}>{bas}</div>}
    </main>
  )
}

// « Suivant → » : le bouton discret des écrans qu'on lit (Préambule, Nom).
export function Suivant({
  onClick,
  disabled = false,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className={styles.suivant} onClick={onClick} disabled={disabled}>
      Suivant
      <span className={styles.fleche} aria-hidden="true" />
    </button>
  )
}
