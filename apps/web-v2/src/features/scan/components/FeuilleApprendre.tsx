/**
 * QUOI     — « Apprendre cette vue » (maquette 530:1013), pour les admins : choisir le Fragment (celui
 *            que le modèle croit voir, d'office), ajouter la vue du viseur, retirer la dernière.
 * POURQUOI — les vues du vrai t-shirt font passer la ressemblance au-delà de 0,9 (essai du 09/10) ;
 *            ajoutée, une vue sert aussitôt à tout le monde. À refaire par coloris.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ajouterVue, retirerEmpreinte } from '../api/scan'
import { useEmpreintes, useFragmentsVisibles } from '../hooks/useEmpreintes'
import styles from './FeuilleApprendre.module.css'

type Props = { suggestion: number | null; empreinteActuelle: () => number[] | null }

export function FeuilleApprendre({ suggestion, empreinteActuelle }: Props) {
  const client = useQueryClient()
  const tous = useFragmentsVisibles() ?? []
  const { fragments } = useEmpreintes()
  const [choisi, setChoisi] = useState<number | null>(null)
  const [occupe, setOccupe] = useState(false)
  const fragment = choisi ?? suggestion ?? tous[0]?.id ?? null
  const vues =
    fragments?.find((f) => f.id === fragment)?.empreintes.filter((e) => e.source === 'vue') ?? []
  const derniere = vues.reduce<number | null>(
    (max, e) => (max === null || e.id > max ? e.id : max),
    null,
  )

  async function agir(action: () => Promise<unknown>) {
    setOccupe(true)
    try {
      await action()
      await client.invalidateQueries({ queryKey: ['scan', 'empreintes'] })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <section className={styles.feuille} aria-label="Apprendre cette vue">
      <h2 className={styles.titre}>Apprendre cette vue</h2>
      <select
        className={styles.choix}
        value={fragment ?? ''}
        onChange={(e) => {
          setChoisi(Number(e.target.value))
        }}
      >
        {tous.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nom}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.ajouter}
        disabled={occupe || fragment === null || empreinteActuelle() === null}
        onClick={() => {
          const vue = empreinteActuelle()
          if (fragment !== null && vue) void agir(() => ajouterVue(fragment, vue))
        }}
      >
        Ajouter cette vue
      </button>
      <p className={styles.compte}>
        {vues.length} vue{vues.length > 1 ? 's' : ''} apprise{vues.length > 1 ? 's' : ''}
        {derniere !== null && (
          <>
            {' · '}
            <button
              type="button"
              className={styles.retirer}
              disabled={occupe}
              onClick={() => {
                void agir(() => retirerEmpreinte(derniere))
              }}
            >
              Retirer la dernière
            </button>
          </>
        )}
      </p>
    </section>
  )
}
