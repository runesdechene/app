/**
 * QUOI     — la dernière activité de la carte, sur la photo : « Un Compagnon vient de
 *            découvrir Fort des Têtes · il y a 38 min ». Une autre prend sa place toutes les
 *            cinq secondes, en fondu. La toucher ouvre le lieu, en aperçu sur la carte.
 * POURQUOI — la carte vit, et un visiteur doit le sentir avant de s'inscrire (comme en V1).
 *            Anonyme : la vitrine ne dit jamais qui.
 * ATTENTION — c'est l'animation qui fait tourner les activités : chaque vitre apparaît, reste,
 *            s'efface (--duree-activite), et sa fin passe à la suivante. Pas de minuteur à tenir
 *            d'accord avec le CSS. Une seule activité reste affichée, sans s'effacer.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { ilYA } from '@/shared/lib/ilYA'
import { useActivite } from '../hooks/useVitrine'
import { phraseActivite } from '../lib/activite'
import styles from './ApercuActivite.module.css'

export function ApercuActivite() {
  const activite = useActivite()
  const [rang, setRang] = useState(0)

  const courante = activite[rang % Math.max(activite.length, 1)]
  if (!courante) return null
  const { debut, lieu } = phraseActivite(courante)
  const tourne = activite.length > 1

  return (
    // La clé remonte une vitre neuve à chaque activité : son animation repart de zéro.
    <Link
      key={rang}
      to={`/bienvenue/carte/lieu/${courante.lieu.id}`}
      className={styles.activite}
      data-tourne={tourne || undefined}
      aria-live="polite"
      onAnimationEnd={() => {
        // Seule, la vitre finit juste d'apparaître : elle reste.
        if (tourne) setRang((r) => r + 1)
      }}
    >
      <span className={styles.epingle} aria-hidden="true" />
      <span>
        {debut}
        <strong>{lieu}</strong> <span className={styles.quand}>· {ilYA(courante.quand)}</span>
      </span>
    </Link>
  )
}
