/**
 * QUOI     — l'invitation « Installer Runes de Chêne » : une carte posée au bas de la carte, avec
 *            l'icône de l'appli. Le bouton du navigateur (Android, PC), ou le geste à faire à la
 *            main sur iPhone ; la croix la fait taire.
 * POURQUOI — la V1 la montrait, la V2 l'avait perdue (Uriel, 31/10). Sur iPhone, les
 *            notifications n'existent que dans l'appli installée. Maquette d'Uriel : Figma 865:2549.
 * ATTENTION — comme la V1, elle revient à chaque ouverture tant que l'appli n'est pas installée ;
 *            la croix la fait taire jusqu'à la prochaine. Elle attend que l'invitation de position
 *            soit passée : jamais deux invitations à la fois. L'icône est celle du manifeste.
 */
import { useState, useSyncExternalStore } from 'react'
import partager from '@/assets/ui/partager-encre.svg'
import { invitationPositionVue } from '@/features/carte/lib/invitationPosition'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { Button } from '@/shared/ui/Button'
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

  return (
    // Pas un <aside> : la coquille réserve `> aside` à son panneau de détail.
    <div className={styles.invitation} role="region" aria-label={TITRE}>
      <img className={styles.icone} src="/icon-512.png" alt="" />
      <div className={styles.texte}>
        <p className={styles.titre}>{TITRE}</p>
        {/* Safari ne sait pas installer de lui-même : on montre le geste. */}
        {iPhone ? (
          <p className={styles.explication}>
            Touche <img className={styles.partager} src={partager} alt="Partager" />, puis « Sur
            l’écran d’accueil » : la carte en plein écran, et les notifications.
          </p>
        ) : (
          <>
            <p className={styles.explication}>
              Retrouve la carte sur ton écran d’accueil, en plein écran, comme une vraie appli.
            </p>
            <Button
              onClick={() => {
                setFermee(true)
                void installer()
              }}
            >
              Installer
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.croix}
        aria-label="Plus tard"
        onClick={() => {
          repousser()
          setFermee(true)
        }}
      />
    </div>
  )
}
