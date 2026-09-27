/**
 * QUOI     — le menu ouvert par l'avatar (maquette « Menu Avatar », 89:238) : Mon profil,
 *            Préférences, Déconnexion.
 * POURQUOI — le menu a son adresse (/<onglet>/menu) : le retour du téléphone le ferme. Mon
 *            profil et Préférences REMPLACENT le menu dans l'historique, pour que le retour
 *            depuis le profil ramène à l'onglet et ne rouvre pas le menu.
 * ATTENTION — Déconnexion ne navigue nulle part : la garde d'accès voit la session tomber et
 *            renvoie vers la V1.
 */
import { useNavigate, useParams } from 'react-router'
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import { seDeconnecter } from '../api/session'
import { useExplorateur } from '../hooks/useExplorateur'
import { useMonIdentifiant } from '../hooks/useMonIdentifiant'
import styles from './MenuAvatar.module.css'

export function MenuAvatar({ onFermer }: { onFermer: () => void }) {
  const { tab = 'accueil' } = useParams()
  const navigate = useNavigate()
  const moi = useMonIdentifiant()
  const { profil } = useExplorateur(moi)

  return (
    <Feuille titre="Mon compte" onFermer={onFermer}>
      <button
        type="button"
        className={styles.entree}
        disabled={moi === null}
        onClick={() => {
          if (moi) void navigate(`/${tab}/explorateur/${moi}`, { replace: true })
        }}
      >
        <Avatar url={profil?.avatarUrl ?? null} nom={profil?.nom ?? ''} taille="petit" />
        Mon profil
      </button>
      <button
        type="button"
        className={styles.entree}
        onClick={() => {
          void navigate(`/${tab}/preferences`, { replace: true })
        }}
      >
        Préférences
      </button>
      <button
        type="button"
        className={[styles.entree, styles.sortie].join(' ')}
        onClick={() => {
          void seDeconnecter()
        }}
      >
        Déconnexion
      </button>
    </Feuille>
  )
}
