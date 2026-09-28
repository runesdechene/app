/**
 * QUOI     — la barre pour écrire de la messagerie (maquettes 45:278 et 264:162) : un cadre
 *            arrondi, le champ, le bouton rond ; `avant` pose au-dessus ce qu'il faut (le choix
 *            du canal, dans le Registre).
 * POURQUOI — Uriel, 28/09 : le même champ partout dans la messagerie, pas un composant de plus
 *            par écran. Le champ se vide quand le message est parti, jamais avant.
 */
import { useState, type ReactNode } from 'react'
import envoyer from '@/assets/ui/envoyer.svg'
import styles from './BarreEcrire.module.css'

export function BarreEcrire({
  invite,
  maximum,
  onEnvoyer,
  avant,
}: {
  invite: string
  maximum: number
  onEnvoyer: (texte: string) => Promise<void>
  avant?: ReactNode
}) {
  const [texte, setTexte] = useState('')
  return (
    <form
      className={styles.barre}
      onSubmit={(e) => {
        e.preventDefault()
        const t = texte.trim()
        if (!t) return
        void onEnvoyer(t).then(() => {
          setTexte('')
        })
      }}
    >
      {avant}
      <input
        className={styles.champ}
        aria-label={invite}
        placeholder={`${invite}…`}
        maxLength={maximum}
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value)
        }}
      />
      <button
        type="submit"
        className={styles.envoyer}
        aria-label="Envoyer"
        disabled={!texte.trim()}
      >
        <img src={envoyer} alt="" width={16} height={16} />
      </button>
    </form>
  )
}
