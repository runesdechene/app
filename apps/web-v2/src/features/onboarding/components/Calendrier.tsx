/**
 * QUOI     — « Quel calendrier ? » : où s'afficheront les dates des lieux et des énigmes.
 * POURQUOI — Uriel, 09/10 : le choix se propose à l'entrée, juste après le nom (spec calendrier).
 *            Est coché le calendrier déjà enregistré (chrétien, le défaut, pour un compte neuf) :
 *            « Suivant » sans rien toucher le garde.
 * ATTENTION — un compte déjà entré ne passe pas par ici : il change de calendrier dans les
 *            Préférences.
 */
import type { Calendrier as Choix } from '@runes/calendrier'
import { useState } from 'react'
import { useCalendrier, useChoisirCalendrier } from '@/shared/hooks/useCalendrier'
import { ChoixDuCalendrier } from '@/shared/ui/ChoixDuCalendrier'
import { useParcours } from '../hooks/useParcours'
import styles from './Onboarding.module.css'
import { Page, Suivant } from './Page'

export function Calendrier() {
  const { aller } = useParcours()
  const actuel = useCalendrier()
  const [choix, setChoix] = useState<Choix | null>(null)
  const { choisir, enCours, echec } = useChoisirCalendrier()

  return (
    <Page
      bas={
        <Suivant
          disabled={enCours}
          onClick={() => {
            choisir(choix ?? actuel, {
              onSuccess: () => {
                aller('fin')
              },
            })
          }}
        />
      }
    >
      <h1 className={styles.titre}>Quel calendrier ?</h1>
      <p className={styles.chapeau}>
        Les dates des lieux et des énigmes s’afficheront ainsi. Tu pourras en changer dans tes
        préférences.
      </p>
      <ChoixDuCalendrier valeur={choix ?? actuel} onChange={setChoix} />
      {echec && (
        <p role="alert" className={styles.alerte}>
          Ton calendrier n’a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}
    </Page>
  )
}
