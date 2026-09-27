/**
 * QUOI     — un champ de saisie avec son libellé (« TON NOM ») et, si besoin, une limite et une aide.
 * POURQUOI — la limite se tient à la saisie : un texte collé trop long est coupé tout de suite,
 *            le compteur passe au rouge, et le serveur ne refuse jamais rien pour ça.
 * ATTENTION — on compte les caractères VISIBLES (graphèmes) : un drapeau 🇫🇷 compte pour un et
 *            n'est jamais coupé en deux. Un texte déjà trop long (écrit ailleurs, en V1) n'est
 *            pas coupé d'office : il peut seulement raccourcir.
 */
import { useId } from 'react'
import styles from './Champ.module.css'

const SEGMENTEUR = new Intl.Segmenter('fr', { granularity: 'grapheme' })

function caracteres(texte: string): string[] {
  return Array.from(SEGMENTEUR.segment(texte), (s) => s.segment)
}

function limiter(nouveau: string, actuel: string, max: number): string {
  const n = caracteres(nouveau).length
  if (n <= max) return nouveau
  const avant = caracteres(actuel).length
  if (avant > max) return n < avant ? nouveau : actuel
  return caracteres(nouveau).slice(0, max).join('')
}

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
    onChange(max === undefined ? texte : limiter(texte, valeur, max))
  }
  const longueur = caracteres(valeur).length
  const plein = max !== undefined && longueur >= max

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
              {longueur} / {max}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
