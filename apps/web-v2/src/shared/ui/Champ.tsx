/**
 * QUOI     — un champ de saisie avec son libellé (« TON NOM ») et, si besoin, une limite et une aide.
 * POURQUOI — la limite se tient à la saisie : un texte collé trop long est coupé tout de suite,
 *            le compteur passe au rouge, et le serveur ne refuse jamais rien pour ça.
 */
import { useId } from 'react'
import styles from './Champ.module.css'

export function Champ({
  libelle,
  valeur,
  onChange,
  multiligne = false,
  max,
  aide,
}: {
  libelle: string
  valeur: string
  onChange: (valeur: string) => void
  multiligne?: boolean
  max?: number
  aide?: string
}) {
  const id = useId()
  const saisir = (texte: string) => {
    onChange(max === undefined ? texte : texte.slice(0, max))
  }
  const plein = max !== undefined && valeur.length >= max

  return (
    <div className={styles.champ}>
      <label className={styles.libelle} htmlFor={id}>
        {libelle}
      </label>
      {multiligne ? (
        <textarea
          id={id}
          className={styles.saisie}
          rows={3}
          value={valeur}
          onChange={(e) => {
            saisir(e.target.value)
          }}
        />
      ) : (
        <input
          id={id}
          className={styles.saisie}
          value={valeur}
          onChange={(e) => {
            saisir(e.target.value)
          }}
        />
      )}
      {(aide !== undefined || max !== undefined) && (
        <p className={styles.pied}>
          {aide}
          {max !== undefined && (
            <span className={plein ? styles.plein : styles.compteur}>
              {valeur.length} / {max}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
