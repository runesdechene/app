/**
 * QUOI     — l'onglet Compte : mes badges et mon profil.
 * POURQUOI — « Mon profil » du menu du profil (07/10) mène ici ; Préférences et la sortie vivent
 *            dans ce menu.
 */
import { useMonIdentifiant } from '../hooks/useMonIdentifiant'
import { BadgesExplorateur } from './BadgesExplorateur'
import { ProfilExplorateur } from './ProfilExplorateur'
import styles from './CompteScreen.module.css'

export function CompteScreen() {
  const moi = useMonIdentifiant()

  if (moi === null) return null
  return (
    <div className={styles.compte}>
      <div className={styles.badges}>
        <BadgesExplorateur id={moi} />
      </div>
      <ProfilExplorateur id={moi} />
    </div>
  )
}
