/**
 * QUOI     — l'invitation « Ne rate plus rien » (maquette Figma 951:3439, Uriel 05/11) : une feuille
 *            qui propose les notifications sur ce téléphone (+1 à la jauge d'énergie), et, à qui ne
 *            l'a pas encore donné, l'accord aux nouvelles par e-mail (+2), dans une case à part.
 * POURQUOI — la V2 ne demandait jamais : 52 joueurs joignables par push sur 5 000. Deux accords
 *            distincts, comme le veut le RGPD ; refuser ne coûte rien.
 * ATTENTION — la demande du téléphone part dans le geste même (Safari l'exige) : `abonner` est lancé
 *            avant d'attendre l'accord aux nouvelles. Jamais deux invitations à la fois : elle attend
 *            celles de la position et de l'installation. Quand l'inviter : `invitationNotifications.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import eclair from '@/assets/ui/eclair.svg'
import { donnerAccordNouvelles, lireAccordNouvelles } from '@/shared/supabase/nouvelles'
import {
  aInviterCeTelephone,
  repousserInvitation,
} from '@/features/compte/lib/invitationNotifications'
import { abonner } from '@/features/compte/lib/push'
import { invitationPositionVue } from '@/features/carte/lib/invitationPosition'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import { estInstallee, installation, surIPhone } from './installation'
import styles from './InvitationNotifications.module.css'

const TITRE = 'Ne rate plus rien'

function Recompense({ points }: { points: number }) {
  return (
    <span className={styles.recompense}>
      <img src={eclair} alt="" />+{points}
    </span>
  )
}

export function InvitationNotifications() {
  const [ouverte, setOuverte] = useState(aInviterCeTelephone)
  const [nouvelles, setNouvelles] = useState(false)
  const possible = useSyncExternalStore(installation.suivre, installation.possible)
  const installationRepoussee = useSyncExternalStore(installation.suivre, installation.repoussee)
  const { autorisation } = useAutorisationPosition()
  const accord = useQuery({
    queryKey: ['accord-nouvelles'],
    queryFn: lireAccordNouvelles,
    enabled: ouverte,
  })
  const client = useQueryClient()
  const activer = useMutation({
    mutationFn: async () => {
      const abonnement = abonner()
      if (nouvelles) await donnerAccordNouvelles().catch(() => undefined)
      await abonnement
    },
    // Accordée ou refusée, le téléphone a répondu : l'invitation ne revient plus.
    onSettled: () => {
      setOuverte(false)
      for (const cle of [['energie'], ['accord-nouvelles'], ['push-ce-telephone']]) {
        void client.invalidateQueries({ queryKey: cle })
      }
    },
  })

  const installationEnAttente =
    !installationRepoussee && !estInstallee() && (possible || surIPhone())
  const positionEnAttente = autorisation === 'a-demander' && !invitationPositionVue()
  if (!ouverte || installationEnAttente || positionEnAttente) return null

  const plusTard = () => {
    repousserInvitation()
    setOuverte(false)
  }

  return (
    <Feuille titre={TITRE} onFermer={plusTard}>
      <Text variant="titre-carte">{TITRE}</Text>
      <p className={styles.texte}>
        Les nouveaux Fragments, les réponses à tes mots et les nouveautés d’Explore, sur ce
        téléphone.
      </p>
      <p className={styles.ligne}>
        <Recompense points={1} /> à ta jauge d’énergie, pour les notifications
      </p>
      {accord.data === false && (
        <label className={styles.ligne}>
          <input
            type="checkbox"
            checked={nouvelles}
            onChange={(e) => {
              setNouvelles(e.target.checked)
            }}
          />
          <Recompense points={2} /> Et les nouvelles de Runes de Chêne par e-mail
        </label>
      )}
      <div className={styles.choix}>
        <Button
          enCours={activer.isPending}
          onClick={() => {
            activer.mutate()
          }}
        >
          Activer
        </Button>
        <Button kind="secondaire" onClick={plusTard}>
          Plus tard
        </Button>
      </div>
    </Feuille>
  )
}
