/**
 * QUOI     — l'invitation « Installer Runes de Chêne » : le bouton du navigateur (Android, PC), ou
 *            le geste à faire à la main sur iPhone.
 * POURQUOI — la V1 la montrait, la V2 l'avait perdue (Uriel, 31/10). Sur iPhone, les
 *            notifications n'existent que dans l'appli installée.
 * ATTENTION — comme la V1, elle revient à chaque ouverture tant que l'appli n'est pas installée ;
 *            « Plus tard » la fait taire jusqu'à la prochaine. Elle attend que l'invitation de
 *            position soit passée : jamais deux fenêtres l'une sur l'autre.
 */
import { useState, useSyncExternalStore } from 'react'
import partager from '@/assets/ui/partager-encre.svg'
import { invitationPositionVue } from '@/features/carte/lib/invitationPosition'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { estInstallee, installation, installer } from './installation'
import styles from './InvitationInstaller.module.css'

const PLUS_TARD = 'installation-plus-tard'
const TITRE = 'Installer Runes de Chêne'

function repoussee() {
  try {
    return sessionStorage.getItem(PLUS_TARD) === '1'
  } catch {
    return false
  }
}

function repousser() {
  try {
    sessionStorage.setItem(PLUS_TARD, '1')
  } catch {
    // Rien à faire : elle reviendra à la prochaine ouverture de toute façon.
  }
}

export function InvitationInstaller() {
  const possible = useSyncExternalStore(installation.suivre, installation.possible)
  const { autorisation } = useAutorisationPosition()
  const [fermee, setFermee] = useState(repoussee)
  const iPhone = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const positionEnAttente = autorisation === 'a-demander' && !invitationPositionVue()
  if (fermee || positionEnAttente || estInstallee() || !(possible || iPhone)) return null

  const fermer = () => {
    repousser()
    setFermee(true)
  }
  return (
    <Feuille titre={TITRE} onFermer={fermer}>
      <p className={styles.titre}>{TITRE}</p>
      {iPhone ? (
        <p className={styles.explication}>
          Touche <img className={styles.icone} src={partager} alt="Partager" />, puis « Sur l’écran
          d’accueil » : la carte s’ouvrira en plein écran, et tu recevras les notifications.
        </p>
      ) : (
        <p className={styles.explication}>
          Retrouve la carte sur ton écran d’accueil, en plein écran, comme une vraie appli.
        </p>
      )}
      <div className={styles.choix}>
        {iPhone ? (
          <Button onClick={fermer}>Compris</Button>
        ) : (
          <>
            <Button
              onClick={() => {
                setFermee(true)
                void installer()
              }}
            >
              Installer
            </Button>
            <Button kind="secondaire" onClick={fermer}>
              Plus tard
            </Button>
          </>
        )}
      </div>
    </Feuille>
  )
}
