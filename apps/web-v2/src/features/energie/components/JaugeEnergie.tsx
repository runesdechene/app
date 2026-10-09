/**
 * QUOI     — la jauge d'énergie sur la carte (maquette « Énergie — 1. la jauge sur la carte »,
 *            01/10) : ⚡ 7 / 10 · +1 dans 23 min. La toucher ouvre la règle.
 * POURQUOI — découvrir loin coûte de l'énergie (spec énergie 01/10) : on voit ce qu'on a avant
 *            d'aller chercher un lieu lointain. Pleine, elle ne compte plus rien. La règle dite ici
 *            est celle que la base rend (réglée dans le Hub).
 */
import { useState } from 'react'
import { attente } from '@/shared/lib/attente'
import { Feuille } from '@/shared/ui/Feuille'
import type { Energie } from '../api/lireEnergie'
import { useEnergie } from '../hooks/useEnergie'
import styles from './JaugeEnergie.module.css'

const KM = new Intl.NumberFormat('fr-FR')
const points = (n: number) => `${String(n)} point${n > 1 ? 's' : ''}`

function phrasesDeLaRegle({ regle: r, parPoint }: Energie) {
  return [
    `Découvrir est gratuit à moins de ${KM.format(r.gratuitKm)} km de toi. Plus loin, ça coûte : ` +
      `${points(r.cout1)} jusqu’à ${KM.format(r.palier1Km)} km, ${String(r.cout2)} jusqu’à ` +
      `${KM.format(r.palier2Km)} km, ${String(r.cout3)} jusqu’à ${KM.format(r.palier3Km)} km, ` +
      `${String(r.cout4)} au-delà.`,
    parPoint === 3600
      ? 'Un point revient chaque heure.'
      : `Un point revient toutes les ${attente(parPoint)}.`,
    'Chaque Fragment que tu possèdes ajoute un point à ta jauge.',
  ]
}

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
            {phrasesDeLaRegle(energie).map((phrase) => (
              <p key={phrase}>{phrase}</p>
            ))}
          </div>
        </Feuille>
      )}
    </>
  )
}
