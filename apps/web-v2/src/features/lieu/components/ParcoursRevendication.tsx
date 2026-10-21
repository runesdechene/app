/**
 * QUOI     — le parcours après une visite sur place : la fête de la visite (la brique Recompense,
 *            sur la photo du lieu), puis « Plante ton étendard », puis « Conquis ! ».
 * POURQUOI — spec « Revendiquer par GPS » (Uriel, 21/10) : la visite est une fête, la revendication
 *            une cérémonie à part ; le même parcours part du bouton de la carte et de la fiche.
 * ATTENTION — un calque posé sur l'écran de départ (comme la découverte) : fermer y ramène.
 */
import { useEffect, useState } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import { Recompense } from '@/shared/ui/Recompense'
import type { Conquete as ConqueteFaite, Recompense as RecompenseVisite } from '../api/lireLieu'
import { useFiche } from '../hooks/useFiche'
import { Conquete } from './Conquete'
import { PlanteTonEtendard } from './PlanteTonEtendard'
import styles from './ParcoursRevendication.module.css'

function phraseVisite({ rang, gain }: RecompenseVisite) {
  if (gain === 0) return 'Te revoilà !' // une revisite ne rapporte rien
  return rang === 1 ? 'Ton 1ᵉʳ lieu visité !' : `Ton ${String(rang)}ᵉ lieu visité !`
}

export function ParcoursRevendication({
  id,
  recompense,
  monNom,
  onFermer,
  onVoirLeLieu,
}: {
  id: string
  recompense: RecompenseVisite
  monNom: string
  onFermer: () => void
  onVoirLeLieu: () => void
}) {
  const { fiche, erreur } = useFiche(id)
  const [conquete, setConquete] = useState<ConqueteFaite | null>(null)
  const [etendard, setEtendard] = useState(false)
  // Une fiche qui ne vient pas : on referme, plutôt qu'un calque vide sans issue.
  useEffect(() => {
    if (erreur) onFermer()
  }, [erreur, onFermer])
  if (!fiche) return null

  if (conquete)
    return (
      <Conquete
        lieu={fiche.nom}
        conquete={conquete}
        onVoirLeLieu={onVoirLeLieu}
        onFermer={onFermer}
      />
    )

  if (etendard)
    return (
      <PlanteTonEtendard
        fiche={fiche}
        monNom={monNom}
        onConquis={setConquete}
        onFermer={onFermer}
      />
    )

  // Une curiosité ne se revendique pas ; un lieu que je tiens, je le tiens déjà.
  const revendicable = fiche.nature === 'lieu' && fiche.revendication?.moi !== true
  const photo = aLaTaille(fiche.photos[0]?.url ?? null, Math.min(window.innerWidth, 1000))
  return (
    <div className={styles.visite}>
      {photo ? (
        <img className={styles.photo} src={photo} alt="" />
      ) : (
        <div className={styles.sansPhoto} />
      )}
      <Recompense
        nom={fiche.nom}
        type={fiche.type?.nom ?? null}
        phrase={phraseVisite(recompense)}
        gain={recompense}
        libelleAcceder={revendicable ? 'Revendiquer ce lieu' : 'Voir le lieu'}
        libelleRevenir="Revenir à la carte"
        onAcceder={
          revendicable
            ? () => {
                setEtendard(true)
              }
            : onVoirLeLieu
        }
        onFermer={onFermer}
      />
    </div>
  )
}
