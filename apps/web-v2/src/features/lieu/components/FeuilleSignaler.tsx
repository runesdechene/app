/**
 * QUOI     — la feuille « Signaler ce lieu » (maquette « Lieu — signaler », 30/09) : cinq raisons,
 *            un mot facultatif, « Envoyer le signalement » ; puis un merci.
 * POURQUOI — ce que Modifier ne répare pas (un lieu qui n'existe pas, un doublon, un endroit
 *            dangereux) part à l'équipe, qui le voit dans le Hub (mig 387).
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { signalerLieu, type Raison } from '../api/lieu'
import styles from './Feuilles.module.css'

const RAISONS: { id: Raison; libelle: string }[] = [
  { id: 'n_existe_pas', libelle: 'Il n’existe pas, ou plus' },
  { id: 'prive_ou_dangereux', libelle: 'Il est privé, ou dangereux d’accès' },
  { id: 'doublon', libelle: 'C’est un doublon d’un autre lieu' },
  { id: 'contenu', libelle: 'Le récit ou les photos posent problème' },
  { id: 'autre', libelle: 'Autre chose' },
]

export function FeuilleSignaler({ id, onFermer }: { id: string; onFermer: () => void }) {
  const [raison, setRaison] = useState<Raison | null>(null)
  const [precision, setPrecision] = useState('')
  const envoi = useMutation({
    mutationFn: (r: Raison) => signalerLieu(id, r, precision),
  })

  if (envoi.isSuccess) {
    return (
      <Feuille titre="Signaler ce lieu" onFermer={onFermer}>
        <h2 className={styles.titre}>Merci</h2>
        <p className={styles.avertissement}>L’équipe va regarder ce lieu de près.</p>
        <Button kind="doux" onClick={onFermer}>
          Fermer
        </Button>
      </Feuille>
    )
  }

  return (
    <Feuille titre="Signaler ce lieu" onFermer={onFermer}>
      <h2 className={styles.titre}>Signaler ce lieu</h2>
      <fieldset className={styles.raisons}>
        <legend className={styles.description}>
          Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement.
        </legend>
        {RAISONS.map((r) => (
          <label key={r.id} className={styles.raison}>
            <input
              type="radio"
              name="raison"
              checked={raison === r.id}
              onChange={() => {
                setRaison(r.id)
              }}
            />
            {r.libelle}
          </label>
        ))}
      </fieldset>
      <textarea
        className={styles.precision}
        aria-label="Un mot de plus"
        placeholder="Un mot de plus (facultatif)…"
        maxLength={500}
        rows={2}
        value={precision}
        onChange={(e) => {
          setPrecision(e.target.value)
        }}
      />
      {envoi.isError && (
        <p className={styles.refus} role="alert">
          Le signalement n’est pas parti. Réessaie dans un instant.
        </p>
      )}
      <Button
        disabled={raison === null || envoi.isPending}
        onClick={() => {
          if (raison) envoi.mutate(raison)
        }}
      >
        {envoi.isPending ? 'Envoi…' : 'Envoyer le signalement'}
      </Button>
    </Feuille>
  )
}
