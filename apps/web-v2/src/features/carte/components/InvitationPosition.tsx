/**
 * QUOI     — l'invitation « Apparaître sur la carte » : autoriser sa position, ou plus tard.
 * POURQUOI — sans position autorisée, un Explorateur connecté reste invisible sur la carte (Uriel,
 *            07/10). La V1 insistait à chaque session ; ici, une seule fois, et seulement si la
 *            position n'a jamais été demandée. Ensuite, la ligne des Préférences prend le relais.
 * ATTENTION — « vue » est gardé sur l'appareil (lib/invitationPosition.ts).
 */
import { useState } from 'react'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { Button } from '@/shared/ui/Button'
import { Question } from '@/shared/ui/Question'
import { invitationPositionVue, marquerInvitationPositionVue } from '../lib/invitationPosition'

export function InvitationPosition() {
  const { autorisation, autoriser } = useAutorisationPosition()
  const [fermee, setFermee] = useState(invitationPositionVue)
  if (fermee || autorisation !== 'a-demander') return null

  const fermer = () => {
    marquerInvitationPositionVue()
    setFermee(true)
  }
  return (
    <Question
      titre="Apparaître sur la carte"
      explication="Les autres Explorateurs te verront passer. Tu peux brouiller tes pistes dans les Préférences."
      onFermer={fermer}
    >
      <Button
        onClick={() => {
          fermer()
          void autoriser()
        }}
      >
        Autoriser ma position
      </Button>
      <Button kind="secondaire" onClick={fermer}>
        Plus tard
      </Button>
    </Question>
  )
}
