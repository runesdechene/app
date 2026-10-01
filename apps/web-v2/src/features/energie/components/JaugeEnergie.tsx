/**
 * QUOI     — la jauge d'énergie sur la carte (maquette « Énergie — 1. la jauge sur la carte »,
 *            01/10) : ⚡ 7 / 10 · +1 dans 23 min. La toucher ouvre la règle.
 * POURQUOI — découvrir loin coûte de l'énergie (spec énergie 01/10) : on voit ce qu'on a avant
 *            d'aller chercher un lieu lointain. Pleine, elle ne compte plus rien.
 */
import { useState } from 'react'
import { attente } from '@/shared/lib/attente'
import { Feuille } from '@/shared/ui/Feuille'
import { useEnergie } from '../hooks/useEnergie'
import styles from './JaugeEnergie.module.css'

export function JaugeEnergie() {
  const energie = useEnergie()
  const [regle, setRegle] = useState(false)
  if (!energie) return null

  return (
    <>
      <button
        type="button"
        className={styles.jauge}
        aria-label={`Énergie : ${String(energie.points)} sur ${String(energie.max)}`}
        onClick={() => {
          setRegle(true)
        }}
      >
        <span className={styles.eclair} aria-hidden="true" />
        <strong className={styles.points}>{energie.points}</strong>
        <span className={styles.max}>/ {energie.max}</span>
        {energie.prochainDans !== null && (
          <span className={styles.recharge}>· +1 dans {attente(energie.prochainDans)}</span>
        )}
      </button>
      {regle && (
        <Feuille
          titre="L’énergie"
          onFermer={() => {
            setRegle(false)
          }}
        >
          <div className={styles.regle}>
            <h2 className={styles.titre}>L’énergie</h2>
            <p>
              Découvrir est gratuit à moins de 100 km de toi. Plus loin, ça coûte : 1 point jusqu’à
              500 km, 2 jusqu’à 1 500 km, 3 au-delà.
            </p>
            <p>Un point revient chaque heure.</p>
            <p>Chaque Fragment que tu possèdes ajoute un point à ta jauge.</p>
          </div>
        </Feuille>
      )}
    </>
  )
}
