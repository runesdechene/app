/**
 * QUOI     — la barre pour écrire de la messagerie (maquettes 45:278 et 264:162) : un cadre
 *            arrondi, le champ, le bouton rond ; `avant` pose ce qu'il faut sur son bord (le
 *            choix du canal), `dessus` ce qui s'ouvre au-dessus (les Explorateurs à mentionner).
 * POURQUOI — Uriel, 28/09 : le même champ partout dans la messagerie, pas un composant de plus
 *            par écran. Le champ se vide quand le message est parti, jamais avant.
 * ATTENTION — `saisie` rend le texte à qui le tient (le Registre, pour les mentions) : il suit
 *            alors aussi le curseur. Sans elle, la barre tient son texte seule (les Murmures).
 */
import { useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import envoyer from '@/assets/ui/envoyer.svg'
import styles from './BarreEcrire.module.css'

type Saisie = {
  texte: string
  changer: (texte: string, curseur: number) => void
  // Les touches, avant la barre : la liste des mentions s'en sert (flèches, Entrée, Échap).
  clavier?: (e: KeyboardEvent<HTMLInputElement>) => void
  champ: RefObject<HTMLInputElement | null>
}

export function BarreEcrire({
  invite,
  maximum,
  onEnvoyer,
  avant,
  dessus,
  saisie,
}: {
  invite: string
  maximum: number
  onEnvoyer: (texte: string) => Promise<void>
  avant?: ReactNode
  dessus?: ReactNode
  saisie?: Saisie
}) {
  const [texteSeul, setTexteSeul] = useState('')
  const texte = saisie ? saisie.texte : texteSeul
  const changer = (t: string, curseur: number) => {
    if (saisie) saisie.changer(t, curseur)
    else setTexteSeul(t)
  }

  return (
    <form
      className={styles.barre}
      onSubmit={(e) => {
        e.preventDefault()
        const t = texte.trim()
        if (!t) return
        void onEnvoyer(t).then(() => {
          changer('', 0)
        })
      }}
    >
      {dessus}
      {avant}
      <input
        ref={saisie?.champ}
        className={styles.champ}
        aria-label={invite}
        placeholder={`${invite}…`}
        maxLength={maximum}
        value={texte}
        onChange={(e) => {
          changer(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={saisie?.clavier}
        onSelect={(e) => {
          changer(e.currentTarget.value, e.currentTarget.selectionStart ?? texte.length)
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
