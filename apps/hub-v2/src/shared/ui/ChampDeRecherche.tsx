/**
 * QUOI     — le champ de recherche des listes : une gélule claire bordée avec la loupe.
 * POURQUOI — chercher à chaque lettre ferait une requête par lettre : on attend 300 ms de calme.
 */
import { useEffect, useState } from 'react'
import loupe from '@/assets/ui/loupe.svg'
import styles from './ChampDeRecherche.module.css'

const ATTENTE = 300

export function ChampDeRecherche({ valeur, onChange, etiquette }: {
  valeur: string; onChange: (texte: string) => void; etiquette: string
}) {
  const [texte, setTexte] = useState(valeur)
  useEffect(() => {
    if (texte === valeur) return
    const minuteur = setTimeout(() => {
      onChange(texte)
    }, ATTENTE)
    return () => {
      clearTimeout(minuteur)
    }
  }, [texte, valeur, onChange])

  return (
    <label className={styles.champ}>
      <img src={loupe} alt="" />
      <input type="search" aria-label={etiquette} placeholder={etiquette} value={texte} onChange={(e) => {
        setTexte(e.target.value)
      }} />
    </label>
  )
}
