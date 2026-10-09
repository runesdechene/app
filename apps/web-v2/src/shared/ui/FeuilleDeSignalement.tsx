/**
 * QUOI     — une feuille « Signaler » : des raisons (une seule choisie), un mot facultatif, « Envoyer le
 *            signalement » ; puis un merci. `proposition` ajoute un champ quand une raison le demande
 *            (l'énigme : « Quelle serait la bonne réponse ? »).
 * POURQUOI — la même feuille sert au lieu (maquette « Lieu — signaler », 30/09) et à l'énigme (08/10,
 *            sans maquette : « au style de Signaler ce lieu ») ; chacun donne ses raisons et son envoi.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from './Button'
import { Feuille } from './Feuille'
import styles from './FeuilleDeSignalement.module.css'

export type Raison<R extends string> = { id: R; libelle: string }

// Le champ facultatif qui n'apparaît qu'avec la raison `pour`.
export type Proposition<R extends string> = { pour: R; libelle: string }

export function FeuilleDeSignalement<R extends string>({
  titre,
  consigne,
  raisons,
  merci,
  proposition,
  onEnvoyer,
  onFermer,
}: {
  titre: string
  consigne: string
  raisons: Raison<R>[]
  merci: string
  proposition?: Proposition<R>
  onEnvoyer: (raison: R, precision: string, proposition: string) => Promise<void>
  onFermer: () => void
}) {
  const [raison, setRaison] = useState<R | null>(null)
  const [precision, setPrecision] = useState('')
  const [propose, setPropose] = useState('')
  const avecProposition = proposition !== undefined && raison === proposition.pour
  const envoi = useMutation({
    mutationFn: (r: R) => onEnvoyer(r, precision, avecProposition ? propose : ''),
  })

  if (envoi.isSuccess) {
    return (
      <Feuille titre={titre} onFermer={onFermer}>
        <h2 className={styles.titre}>Merci</h2>
        <p className={styles.avertissement}>{merci}</p>
        <Button kind="doux" onClick={onFermer}>
          Fermer
        </Button>
      </Feuille>
    )
  }

  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <h2 className={styles.titre}>{titre}</h2>
      <fieldset className={styles.raisons}>
        <legend className={styles.description}>{consigne}</legend>
        {raisons.map((r) => (
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
      {avecProposition && (
        <input
          className={[styles.precision, styles.proposition].join(' ')}
          aria-label={proposition.libelle}
          placeholder={proposition.libelle}
          maxLength={200}
          value={propose}
          onChange={(e) => {
            setPropose(e.target.value)
          }}
        />
      )}
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
