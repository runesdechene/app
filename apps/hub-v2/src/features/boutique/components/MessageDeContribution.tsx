/**
 * QUOI     — le message du contributeur : le texte, « Modifier », ou « + Ajouter un message » s'il est vide.
 * POURQUOI — le message est publié avec la photo : l'équipe le corrige (500 caractères). L'erreur de la
 *            base reste sous le bloc ; le champ ne se ferme qu'une fois l'enregistrement réussi.
 */
import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import styles from './Photos.module.css'

type Ecriture = UseMutationResult<void, Error, { id: string; message: string | null }>

export function MessageDeContribution({ id, message, ecriture }: { id: string; message: string | null; ecriture: Ecriture }) {
  const [texte, setTexte] = useState<string | null>(null)

  function enregistrer() {
    if (texte === null) return
    ecriture.reset()
    ecriture.mutate({ id, message: texte.trim() === '' ? null : texte.trim() }, { onSuccess: () => { setTexte(null) } })
  }

  return (
    <section className={styles.message}>
      {texte === null ? (
        <>
          {message && <p className={styles.texteDuMessage}>{message}</p>}
          <button type="button" className={styles.discret} onClick={() => { ecriture.reset(); setTexte(message ?? '') }}>
            {message ? 'Modifier le message' : '+ Ajouter un message'}
          </button>
        </>
      ) : (
        <>
          <textarea aria-label="Message" maxLength={500} rows={4} value={texte} onChange={(e) => { setTexte(e.target.value) }} />
          <div className={styles.rangee}>
            <button type="button" className={styles.plein} disabled={ecriture.isPending} onClick={enregistrer}>Enregistrer</button>
            <button type="button" className={styles.contour} onClick={() => { setTexte(null) }}>Annuler</button>
          </div>
        </>
      )}
      {ecriture.error && <p role="alert">{ecriture.error.message}</p>}
    </section>
  )
}
