/**
 * QUOI     — l'onglet Compte : mes badges, mon profil, puis Préférences et Déconnexion.
 * POURQUOI — le Compte est passé dans la barre basse (Uriel, 28/09) : ce qu'ouvrait le menu
 *            avatar vit ici, sans feuille. Préférences s'ouvre en détail par-dessus l'onglet.
 * ATTENTION — Déconnexion ne navigue nulle part : la garde d'accès voit la session tomber et
 *            renvoie vers la V1.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { seDeconnecter } from '../api/session'
import { useMonIdentifiant } from '../hooks/useMonIdentifiant'
import { BadgesExplorateur } from './BadgesExplorateur'
import { ProfilExplorateur } from './ProfilExplorateur'
import styles from './CompteScreen.module.css'

export function CompteScreen() {
  const moi = useMonIdentifiant()
  const navigate = useNavigate()
  const [echec, setEchec] = useState(false)

  if (moi === null) return null
  return (
    <div className={styles.compte}>
      <div className={styles.badges}>
        <BadgesExplorateur id={moi} />
      </div>
      <ProfilExplorateur id={moi} />
      <nav className={styles.entrees} aria-label="Mon compte">
        <button
          type="button"
          className={styles.entree}
          onClick={() => {
            void navigate('/compte/preferences')
          }}
        >
          Préférences
        </button>
        <button
          type="button"
          className={[styles.entree, styles.sortie].join(' ')}
          onClick={() => {
            setEchec(false)
            seDeconnecter().catch(() => {
              setEchec(true)
            })
          }}
        >
          Se déconnecter
        </button>
        {echec && (
          <p role="alert" className={styles.alerte}>
            La déconnexion a échoué. Vérifie ta connexion, puis réessaie.
          </p>
        )}
      </nav>
    </div>
  )
}
