/**
 * QUOI     — /<onglet>/lieu/<id> : la fiche dans le cadre de détail, son bouton de visite, la
 *            fenêtre de revendication (après une visite), et les feuilles « Ce lieu » et
 *            « Partager ce lieu ».
 * POURQUOI — la zone Lieu ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre. Fenêtre
 *            et feuilles sont des moments, pas des adresses : un état local, fermé par le voile ou
 *            Échap.
 */
import { useState } from 'react'
import { useParams } from 'react-router'
import { BoutonVisite } from '@/features/lieu/components/BoutonVisite'
import { FenetreRevendication } from '@/features/lieu/components/FenetreRevendication'
import { FeuilleOptions } from '@/features/lieu/components/FeuilleOptions'
import { FeuillePartager } from '@/features/lieu/components/FeuillePartager'
import { FicheLieu } from '@/features/lieu/components/FicheLieu'
import { useFiche } from '@/features/lieu/hooks/useFiche'
import { DetailPane } from '../shell/DetailPane'

type Ouvert = 'options' | 'partager' | 'revendiquer' | null

// Un lieu = un état neuf : passer d'un lieu à l'autre efface erreurs, galerie et feuilles ouvertes.
export function RouteLieu() {
  const { id = '' } = useParams()
  return <Lieu key={id} id={id} />
}

function Lieu({ id }: { id: string }) {
  const { fiche } = useFiche(id)
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const fermer = () => {
    setOuvert(null)
  }

  return (
    <DetailPane title={fiche?.nom ?? 'Lieu'} surImage={Boolean(fiche)}>
      <FicheLieu
        id={id}
        onOptions={() => {
          setOuvert('options')
        }}
        onPartager={() => {
          setOuvert('partager')
        }}
        boutonVisite={(f) => (
          <BoutonVisite
            fiche={f}
            onVisite={() => {
              setOuvert('revendiquer')
            }}
          />
        )}
      />
      {fiche && ouvert === 'options' && <FeuilleOptions fiche={fiche} onFermer={fermer} />}
      {fiche && ouvert === 'partager' && <FeuillePartager fiche={fiche} onFermer={fermer} />}
      {fiche && ouvert === 'revendiquer' && (
        <FenetreRevendication fiche={fiche} onFermer={fermer} />
      )}
    </DetailPane>
  )
}
