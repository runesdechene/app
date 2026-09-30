/**
 * QUOI     — la dernière activité de la carte, sur la photo : « Un Explorateur vient de
 *            découvrir Fort des Têtes · il y a 38 min ». Une autre prend sa place toutes les
 *            cinq secondes.
 * POURQUOI — la carte vit, et un visiteur doit le sentir avant de s'inscrire (comme en V1).
 *            Anonyme : la vitrine ne dit jamais qui.
 */
import { useEffect, useState } from 'react'
import { ilYA } from '@/shared/lib/ilYA'
import { useActivite } from '../hooks/useVitrine'
import { phraseActivite } from '../lib/activite'
import styles from './ApercuActivite.module.css'

const TOUR = 5000

export function ApercuActivite() {
  const activite = useActivite()
  const [rang, setRang] = useState(0)

  useEffect(() => {
    if (activite.length < 2) return
    const minuteur = setInterval(() => {
      setRang((r) => r + 1)
    }, TOUR)
    return () => {
      clearInterval(minuteur)
    }
  }, [activite.length])

  const courante = activite[rang % Math.max(activite.length, 1)]
  if (!courante) return null
  const { debut, lieu } = phraseActivite(courante)

  return (
    <p className={styles.activite} aria-live="polite">
      <span className={styles.epingle} aria-hidden="true" />
      {/* La clé relance l'apparition à chaque nouvelle activité. */}
      <span key={rang} className={styles.texte}>
        {debut}
        <strong>{lieu}</strong> <span className={styles.quand}>· {ilYA(courante.quand)}</span>
      </span>
    </p>
  )
}
