/**
 * QUOI     — sur la carte, le bouton « Marquer ma visite » quand un lieu est à portée (maquette
 *            679:1732), puis le parcours de la visite et de la revendication.
 * POURQUOI — spec « Revendiquer par GPS » (Uriel, 21/10) : sur place, la carte pousse à visiter, puis
 *            à revendiquer. Le Shell le pose dans la carte, qui lui confie ses lieux et entoure d'un
 *            anneau celui qu'il propose (`onAPortee`).
 * ATTENTION — la position n'est jamais demandée ici : seulement suivie si elle est déjà autorisée.
 */
import { useEffect, useState } from 'react'
import { usePosition } from '@/shared/hooks/usePosition'
import type { Recompense } from '../api/lireLieu'
import { useVisite } from '../hooks/useVisite'
import { lieuAPortee, type LieuProche } from '../lib/lieuAPortee'
import { ParcoursRevendication } from './ParcoursRevendication'
import styles from './BoutonAPortee.module.css'

export function BoutonAPortee({
  lieux,
  monNom,
  onAPortee,
  onVoirLeLieu,
}: {
  lieux: LieuProche[]
  monNom: string
  onAPortee: (id: string | null) => void
  onVoirLeLieu: (id: string) => void
}) {
  const { position } = usePosition()
  const proche = lieuAPortee(position, lieux)
  const id = proche?.lieu.id ?? null
  const { visiter, enCours, erreur } = useVisite(id ?? '')
  // Le parcours garde son lieu, même si l'on s'éloigne pendant qu'il est ouvert.
  const [parcours, setParcours] = useState<{ id: string; recompense: Recompense } | null>(null)
  const [envoye, setEnvoye] = useState(false) // un double toucher ne marque qu'une visite

  useEffect(() => {
    onAPortee(id)
  }, [id, onAPortee])

  if (parcours)
    return (
      // Sur PC, le calque laisse le tiroir à sa place (la carte passe dessous).
      <div className={styles.calque}>
        <ParcoursRevendication
          id={parcours.id}
          recompense={parcours.recompense}
          monNom={monNom}
          onFermer={() => {
            setParcours(null)
          }}
          onVoirLeLieu={() => {
            setParcours(null) // la fiche s'ouvre sur la carte : le calque ne doit pas rester dessous
            onVoirLeLieu(parcours.id)
          }}
        />
      </div>
    )

  if (!proche || typeof position === 'string') return null

  function marquer(lieu: string, ici: { lat: number; lng: number }) {
    setEnvoye(true)
    visiter(ici).then(
      (recompense) => {
        setEnvoye(false)
        setParcours({ id: lieu, recompense })
      },
      () => {
        setEnvoye(false) // le refus est écrit par `erreur`
      },
    )
  }

  return (
    <div className={styles.aPortee}>
      {erreur && (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      )}
      <button
        type="button"
        className={styles.bouton}
        disabled={enCours || envoye}
        onClick={() => {
          marquer(proche.lieu.id, position)
        }}
      >
        <span className={styles.etendard} aria-hidden="true" />
        <span className={styles.texte}>
          <span className={styles.action}>Marquer ma visite</span>
          <span className={styles.lieu}>
            {proche.lieu.nom} · à {proche.distance}
          </span>
        </span>
      </button>
    </div>
  )
}
