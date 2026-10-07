/**
 * QUOI     — l'invitation « Apparaître sur la carte » : autoriser sa position, ou plus tard.
 * POURQUOI — sans position autorisée, un Explorateur connecté reste invisible sur la carte (Uriel,
 *            07/10). La V1 insistait à chaque session ; ici, une seule fois, et seulement si la
 *            position n'a jamais été demandée. Ensuite, la ligne des Préférences prend le relais.
 * ATTENTION — « vue » est gardé sur l'appareil ; s'il ne peut pas l'être (navigation privée),
 *            l'invitation reviendra à la prochaine ouverture, sans plus.
 */
import { useState } from 'react'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import styles from './InvitationPosition.module.css'

const VUE = 'invitation-position-vue'

function dejaVue() {
  try {
    return localStorage.getItem(VUE) === '1'
  } catch {
    return false
  }
}

function marquerVue() {
  try {
    localStorage.setItem(VUE, '1')
  } catch {
    // Rien à faire : elle reviendra à la prochaine ouverture.
  }
}

export function InvitationPosition() {
  const { autorisation, autoriser } = useAutorisationPosition()
  const [fermee, setFermee] = useState(dejaVue)
  if (fermee || autorisation !== 'a-demander') return null

  const fermer = () => {
    marquerVue()
    setFermee(true)
  }
  return (
    <Feuille titre="Apparaître sur la carte" onFermer={fermer}>
      <p className={styles.titre}>Apparaître sur la carte</p>
      <p className={styles.explication}>
        Les autres Explorateurs te verront passer. Tu peux brouiller tes pistes dans les
        Préférences.
      </p>
      <div className={styles.choix}>
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
      </div>
    </Feuille>
  )
}
