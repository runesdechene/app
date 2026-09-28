/**
 * QUOI     — « Un lieu, une ville… » : chercher un lieu par son nom parmi ceux déjà chargés,
 *            et y aller (maquette 162:107, calques 165:128).
 * POURQUOI — pas de requête : les lieux sont déjà là. Les accents et la casse ne comptent pas
 *            (« eglise » trouve « Église »). Les villes viendront avec le géocodage (plan 2).
 */
import { useState } from 'react'
import loupe from '@/assets/ui/loupe.svg'
import type { LieuCarte } from '../api/lireCarte'
import styles from './Recherche.module.css'

const MAX_RESULTATS = 10

const simplifier = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function Recherche({
  lieux,
  onAller,
}: {
  lieux: LieuCarte[]
  onAller: (point: { lat: number; lng: number }) => void
}) {
  const [texte, setTexte] = useState('')
  const cherche = simplifier(texte.trim())
  const resultats =
    cherche === ''
      ? []
      : lieux.filter((l) => simplifier(l.nom).includes(cherche)).slice(0, MAX_RESULTATS)

  return (
    <div className={styles.recherche}>
      <label className={styles.champ}>
        <img className={styles.loupe} src={loupe} alt="" />
        <input
          type="search"
          className={styles.saisie}
          placeholder="Un lieu, une ville…"
          aria-label="Un lieu, une ville…"
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value)
          }}
        />
      </label>
      {resultats.length > 0 && (
        <div role="listbox" aria-label="Lieux trouvés" className={styles.resultats}>
          {resultats.map((l) => (
            <button
              key={l.id}
              type="button"
              role="option"
              aria-selected="false"
              className={styles.resultat}
              onClick={() => {
                setTexte('')
                onAller({ lat: l.lat, lng: l.lng })
              }}
            >
              {l.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
