/**
 * QUOI     — /<onglet>/lieu/<id> : la fiche dans le cadre de détail, son bouton de visite, la
 *            fenêtre de revendication (après une visite), et les feuilles « Ce lieu » et
 *            « Partager ce lieu ». Un lieu encore inconnu passe d'abord par sa découverte.
 * POURQUOI — la zone Lieu ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre. Fenêtre
 *            et feuilles sont des moments, pas des adresses : un état local, fermé par le voile ou
 *            Échap.
 */
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BoutonVisite } from '@/features/lieu/components/BoutonVisite'
import { ModifierFiche } from '@/features/ajout/components/ModifierFiche'
import { QuestionAbandon } from '@/features/ajout/components/QuestionAbandon'
import { DecouverteLieu } from '@/features/lieu/components/DecouverteLieu'
import { FenetreRevendication } from '@/features/lieu/components/FenetreRevendication'
import { Carnet } from '@/features/lieu/components/Carnet'
import { FeuilleCoeurs } from '@/features/lieu/components/FeuilleCoeurs'
import { FeuilleHistoire } from '@/features/lieu/components/FeuilleHistoire'
import { FeuilleOptions } from '@/features/lieu/components/FeuilleOptions'
import { FeuillePartager } from '@/features/lieu/components/FeuillePartager'
import { FeuilleSignaler } from '@/features/lieu/components/FeuilleSignaler'
import { FicheLieu } from '@/features/lieu/components/FicheLieu'
import { useFiche } from '@/features/lieu/hooks/useFiche'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

type Ouvert = 'options' | 'partager' | 'revendiquer' | 'coeurs' | 'histoire' | 'signaler' | null

// Un lieu = un état neuf : passer d'un lieu à l'autre efface erreurs, galerie et feuilles ouvertes.
export function RouteLieu() {
  const { id = '' } = useParams()
  return <Lieu key={id} id={id} />
}

function Lieu({ id }: { id: string }) {
  const { fiche } = useFiche(id)
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const fermerDetail = useFermerDetail()
  const navigate = useNavigate()
  const fermer = () => {
    setOuvert(null)
  }

  // Un lieu inconnu s'ouvre voilé : on le découvre avant de voir sa fiche.
  if (fiche && !fiche.moi.decouvert) {
    return (
      <DetailPane title="Un lieu inconnu" surImage>
        <DecouverteLieu fiche={fiche} onFermer={fermerDetail} />
      </DetailPane>
    )
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
        onCoeurs={() => {
          setOuvert('coeurs')
        }}
        onEnrichir={() => {
          void navigate('modifier', { relative: 'path' })
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
      {fiche && ouvert === 'options' && (
        <FeuilleOptions
          fiche={fiche}
          onFermer={fermer}
          onSupprime={fermerDetail}
          onHistoire={() => {
            setOuvert('histoire')
          }}
          onSignaler={() => {
            setOuvert('signaler')
          }}
        />
      )}
      {ouvert === 'coeurs' && <FeuilleCoeurs id={id} onFermer={fermer} />}
      {ouvert === 'histoire' && <FeuilleHistoire id={id} onFermer={fermer} />}
      {ouvert === 'signaler' && <FeuilleSignaler id={id} onFermer={fermer} />}
      {fiche && ouvert === 'partager' && <FeuillePartager fiche={fiche} onFermer={fermer} />}
      {fiche && ouvert === 'revendiquer' && (
        <FenetreRevendication fiche={fiche} onFermer={fermer} />
      )}
    </DetailPane>
  )
}

// /<onglet>/lieu/<id>/modifier — « Modifier la fiche » (faire vivre un lieu, migs 387-388).
// Enregistrer ramène à la fiche, qui se relit. La flèche de retour demande d'abord s'il y a des
// changements à perdre (Uriel, 30/09) ; sinon elle ferme aussitôt.
export function RouteModifierLieu() {
  const { id = '' } = useParams()
  const fermer = useFermerDetail()
  const modifie = useRef(false)
  const [question, setQuestion] = useState(false)
  return (
    <DetailPane
      title="Modifier la fiche"
      surImage
      onFermer={() => {
        if (modifie.current) setQuestion(true)
        else fermer()
      }}
    >
      <ModifierFiche
        id={id}
        onFini={fermer}
        onModifie={(m) => {
          modifie.current = m
        }}
      />
      {question && (
        <QuestionAbandon
          onContinuer={() => {
            setQuestion(false)
          }}
          onAbandonner={fermer}
        />
      )}
    </DetailPane>
  )
}

// /<onglet>/lieu/<id>/carnet — le Carnet de passage en entier (mig 389) ; la fiche n'en montre que
// les trois derniers mots.
export function RouteCarnet() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Carnet de passage">
      <Carnet id={id} limite={null} />
    </DetailPane>
  )
}
