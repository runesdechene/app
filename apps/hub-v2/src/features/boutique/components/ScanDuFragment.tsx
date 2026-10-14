/**
 * QUOI     — le scan d'un Fragment : ses empreintes d'illustration (à recalculer), les vues du vrai t-shirt
 *            qui servent de références (à retirer), et combien de fois il a été scanné.
 * POURQUOI — les écritures invalident ['hub-scans'] : la liste des Fragments (« À filmer ») suit. Retirer une
 *            vue se confirme en ligne, sans fenêtre du navigateur.
 */
import { useState } from 'react'
import { dateCourte } from '@/shared/lib/dates'
import { pluriel } from '@/shared/lib/texte'
import type { Fragment } from '../api/fragments'
import { useRecalculerEmpreintes, useRetirerEmpreinte, useScans } from '../hooks/useFragments'
import styles from './Boutique.module.css'

export function ScanDuFragment({ fragment }: { fragment: Fragment }) {
  const { data: scans, isPending, isError, error } = useScans()
  const recalcul = useRecalculerEmpreintes()
  const retrait = useRetirerEmpreinte()
  const [aRetirer, setARetirer] = useState<number | null>(null)

  if (isPending) return <p className={styles.calme}>Lecture du scan…</p>
  if (isError) return <p className={styles.erreur} role="alert">{error.message}</p>
  const scan = scans.find((s) => s.id === fragment.id)
  const empreintes = scan?.illustrations ?? 0
  const vues = scan?.vues ?? []

  return (
    <div className={styles.section}>
      <p>
        {`${String(empreintes)} ${pluriel(empreintes, 'empreinte')} d’illustration · `}
        <button type="button" className={styles.boutonContour} disabled={recalcul.isPending} onClick={() => { recalcul.mutate(fragment) }}>
          {recalcul.isPending ? 'Calcul…' : 'Recalculer'}
        </button>
      </p>
      {recalcul.isError && <p className={styles.erreur} role="alert">{recalcul.error.message}</p>}
      {fragment.visible && vues.length === 0 && (
        <p className={styles.calme}>À filmer : aucune vue du vrai t-shirt (depuis le scanner d’Explore, en admin).</p>
      )}
      {vues.map((v) => (
        <p key={v.id} className={styles.uneVue}>
          {`Vue du ${dateCourte(v.le)}${v.par ? ` · ${v.par}` : ''}`}
          {aRetirer === v.id ? (
            <span>
              {' Retirer cette vue ? '}
              <button type="button" className={styles.boutonContour} disabled={retrait.isPending} onClick={() => { retrait.mutate(v.id, { onSettled: () => { setARetirer(null) } }) }}>Confirmer</button>
              <button type="button" className={styles.boutonContour} onClick={() => { setARetirer(null) }}>Annuler</button>
            </span>
          ) : (
            <button type="button" className={styles.boutonContour} onClick={() => { retrait.reset(); setARetirer(v.id) }}>Retirer</button>
          )}
        </p>
      ))}
      {retrait.isError && <p className={styles.erreur} role="alert">{retrait.error.message}</p>}
      <p className={styles.calme}>{`Scans : ${String(scan?.scans7 ?? 0)} en 7 jours · ${String(scan?.scans30 ?? 0)} en 30 jours`}</p>
    </div>
  )
}
