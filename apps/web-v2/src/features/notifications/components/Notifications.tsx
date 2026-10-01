/**
 * QUOI     — le tiroir des Notifications (maquette « Notifications (tiroir) — proposition 30/09 ») :
 *            rangées par moment, chacune avec le visage de qui a agi (ou la bille d'un palier),
 *            sa phrase, depuis quand ; les non lues sur un voile rose, un point à droite.
 * POURQUOI — ce qui touche tes lieux et toi, pas les rappels quotidiens. Toucher une notification
 *            ouvre le lieu (le Registre pour une mention, les Nouveautés pour une mise à jour) ;
 *            le retour ramène ici.
 */
import { Link } from 'react-router'
import { ilYA } from '@/shared/lib/ilYA'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { Notification } from '../api/lireNotifications'
import { useNotifications } from '../hooks/useNotifications'
import { parMoment } from '../lib/moments'
import { phraseDe } from '../lib/phrase'
import styles from './Notifications.module.css'

export function Notifications() {
  const { notifications, erreur, reessayer } = useNotifications()

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>Les notifications n’ont pas pu être chargées</EmptyState>
        <Button kind="doux" onClick={() => void reessayer()}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!notifications) return <div className={styles.chargement} aria-busy="true" />
  if (notifications.length === 0) return <EmptyState>Rien de nouveau pour l’instant</EmptyState>

  return (
    <div className={styles.notifications}>
      {parMoment(notifications).map((rubrique) => (
        <section key={rubrique.titre} className={styles.rubrique} aria-label={rubrique.titre}>
          <h2 className={styles.titre}>{rubrique.titre}</h2>
          <ul className={styles.liste}>
            {rubrique.liste.map((n) => (
              <li key={`${n.type}-${String(n.id)}`}>
                <Ligne notification={n} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Où mène une notification : le lieu, le Registre pour une mention ou un message aimé, les
// Nouveautés pour une mise à jour, nulle part sinon.
function cibleDe(n: Notification) {
  if (n.type === 'mention') return '/messages'
  if (n.type === 'salut' && n.evenement === 'message') return '/messages'
  if (n.type === 'mise_a_jour') return '../nouveautes'
  return n.lieu ? `../lieu/${n.lieu.id}` : null
}

function Ligne({ notification: n }: { notification: Notification }) {
  const contenu = (
    <>
      {n.qui ? (
        <Avatar url={n.qui.avatar} nom={n.qui.nom} taille="petit" />
      ) : (
        <span
          className={styles.bille}
          data-nouveaute={n.type === 'mise_a_jour' || undefined}
          aria-hidden="true"
        />
      )}
      <span className={styles.texte}>
        <span className={styles.phrase}>
          {phraseDe(n).map((m, i) =>
            m.sorte === 'texte' ? (
              m.texte
            ) : (
              <strong key={i} className={m.sorte === 'lieu' ? styles.lieu : styles.qui}>
                {m.texte}
              </strong>
            ),
          )}
        </span>
        <span className={styles.quand}>{ilYA(n.quand)}</span>
      </span>
      {!n.lu && <span className={styles.point} role="img" aria-label="Non lue" />}
    </>
  )
  const cible = cibleDe(n)
  return cible ? (
    <Link className={styles.ligne} data-non-lue={!n.lu || undefined} to={cible} relative="path">
      {contenu}
    </Link>
  ) : (
    <div className={styles.ligne} data-non-lue={!n.lu || undefined}>
      {contenu}
    </div>
  )
}
