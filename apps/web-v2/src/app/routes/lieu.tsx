/**
 * QUOI     — /<onglet>/lieu/<id> : la fiche dans le cadre de détail, son bouton de visite, et la
 *            fenêtre de revendication qui s'ouvre après une visite réussie.
 * POURQUOI — la zone Lieu ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre. La
 *            fenêtre est un moment, pas une adresse : un état local, fermé par le voile ou Échap.
 */
import { useState } from 'react'
import { useParams } from 'react-router'
import { BoutonVisite } from '@/features/lieu/components/BoutonVisite'
import { FenetreRevendication } from '@/features/lieu/components/FenetreRevendication'
import { FicheLieu } from '@/features/lieu/components/FicheLieu'
import { DetailPane } from '../shell/DetailPane'

export function RouteLieu() {
  const { id = '' } = useParams()
  const [aRevendiquer, setARevendiquer] = useState<{ id: string; nom: string } | null>(null)

  return (
    <DetailPane title="Lieu" surImage>
      <FicheLieu
        id={id}
        onOptions={() => undefined}
        onPartager={() => undefined}
        boutonVisite={(fiche) => (
          <BoutonVisite
            fiche={fiche}
            onVisite={() => {
              setARevendiquer({ id: fiche.id, nom: fiche.nom })
            }}
          />
        )}
      />
      {aRevendiquer && (
        <FenetreRevendication
          fiche={aRevendiquer}
          onFermer={() => {
            setARevendiquer(null)
          }}
        />
      )}
    </DetailPane>
  )
}
