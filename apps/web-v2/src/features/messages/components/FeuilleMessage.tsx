/**
 * QUOI     — les actions sur son propre message, du Registre ou des Murmures : « Modifier » (dans
 *            ses 15 minutes), « Supprimer » (après confirmation : c'est sans retour).
 * POURQUOI — Uriel, 11/10 : on modifie pendant 15 minutes et ça se voit ; on retire quand on veut,
 *            et le message disparaît pour tout le monde. La base vérifie les deux (migration 502).
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import styles from './FeuilleMessage.module.css'

export function FeuilleMessage({
  texte,
  modifiable,
  maximum,
  onModifier,
  onRetirer,
  onFermer,
}: {
  texte: string
  modifiable: boolean
  maximum: number
  onModifier: (texte: string) => Promise<void>
  onRetirer: () => Promise<void>
  onFermer: () => void
}) {
  const [etape, setEtape] = useState<'choix' | 'modifier' | 'retirer'>('choix')
  const [nouveau, setNouveau] = useState(texte)
  const modification = useMutation({ mutationFn: onModifier, onSuccess: onFermer })
  const retrait = useMutation({ mutationFn: onRetirer, onSuccess: onFermer })

  if (etape === 'modifier') {
    const t = nouveau.trim()
    return (
      <Feuille titre="Modifier le message" onFermer={onFermer}>
        <h2 className={styles.titre}>Modifier</h2>
        <textarea
          className={styles.champ}
          aria-label="Ton message"
          maxLength={maximum}
          rows={3}
          value={nouveau}
          onChange={(e) => {
            setNouveau(e.target.value)
          }}
        />
        {modification.isError && (
          <p className={styles.refus} role="alert">
            Le message n’a pas été modifié : les quinze minutes sont peut-être passées.
          </p>
        )}
        <Button
          disabled={!t || t === texte || modification.isPending}
          onClick={() => {
            modification.mutate(t)
          }}
        >
          Enregistrer
        </Button>
      </Feuille>
    )
  }

  if (etape === 'retirer') {
    return (
      <Feuille titre="Supprimer le message" onFermer={onFermer}>
        <h2 className={styles.titre}>Supprimer ce message ?</h2>
        <p className={styles.consigne}>
          Il disparaît pour tout le monde ; « Message retiré » reste à sa place.
        </p>
        {retrait.isError && (
          <p className={styles.refus} role="alert">
            Le message n’a pas été retiré. Réessaie dans un instant.
          </p>
        )}
        <Button
          disabled={retrait.isPending}
          onClick={() => {
            retrait.mutate()
          }}
        >
          Retirer le message
        </Button>
        <Button kind="doux" onClick={onFermer}>
          Annuler
        </Button>
      </Feuille>
    )
  }

  return (
    <Feuille titre="Ton message" onFermer={onFermer}>
      {modifiable && (
        <Button
          kind="secondaire"
          onClick={() => {
            setEtape('modifier')
          }}
        >
          Modifier
        </Button>
      )}
      <Button
        kind="secondaire"
        onClick={() => {
          setEtape('retirer')
        }}
      >
        Supprimer
      </Button>
    </Feuille>
  )
}
