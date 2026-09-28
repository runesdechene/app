/**
 * QUOI     — le choix du canal où l'on écrit : une pastille posée sur le bord de la barre, à la
 *            couleur du canal choisi, qui ouvre une petite liste des canaux.
 * POURQUOI — Uriel, 28/09 : un vrai « select », mais pas la liste du système (« horrible ») ;
 *            la pastille prend la couleur de son canal (crème pour le général, bleu pour les
 *            bugs). La liste se ferme au choix, en touchant ailleurs, ou avec Échap.
 */
import { useEffect, useRef, useState } from 'react'
import type { Canal } from '../api/lireRegistre'
import styles from './ChoixCanal.module.css'

export function ChoixCanal({
  canaux,
  noms,
  valeur,
  onChange,
}: {
  canaux: readonly Canal[]
  noms: Record<Canal, string>
  valeur: Canal
  onChange: (canal: Canal) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const cadre = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const ailleurs = (e: PointerEvent) => {
      if (e.target instanceof Node && !cadre.current?.contains(e.target)) setOuvert(false)
    }
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('pointerdown', ailleurs)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('pointerdown', ailleurs)
      document.removeEventListener('keydown', echap)
    }
  }, [ouvert])

  const choisir = (c: Canal) => {
    onChange(c)
    setOuvert(false)
  }
  const teinte = (c: Canal) => (c === 'bugs' ? styles.bugs : styles.general)

  return (
    <div ref={cadre} className={styles.choix}>
      <button
        type="button"
        className={[styles.pastille, teinte(valeur)].join(' ')}
        aria-label={`Canal : ${noms[valeur]}`}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={() => {
          setOuvert(!ouvert)
        }}
      >
        {noms[valeur]}
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {ouvert && (
        <ul className={styles.liste} role="listbox" aria-label="Canal">
          {canaux.map((c) => (
            <li
              key={c}
              role="option"
              aria-selected={c === valeur}
              className={[styles.option, teinte(c)].join(' ')}
              tabIndex={0}
              onClick={() => {
                choisir(c)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  choisir(c)
                }
              }}
            >
              {noms[c]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
