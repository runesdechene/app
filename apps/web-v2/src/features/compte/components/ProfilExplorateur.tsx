/**
 * QUOI     — le profil public d'un Explorateur (maquette Figma « COMPTE », 89:124).
 * POURQUOI — la même page pour soi et pour les autres ; seul le bouton change (« Modifier mon
 *            profil » ou « Envoyer un murmure »), comme sur Instagram.
 * ATTENTION — trois états avant le profil : chargement (rien), erreur (réessayer), introuvable.
 *            Jamais un écran vide ni une erreur brute.
 */
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useExplorateur } from '../hooks/useExplorateur'
import { ExplorateurIntrouvable } from './ExplorateurIntrouvable'
import { ProfilDecouvertes } from './ProfilDecouvertes'
import { ProfilEntete } from './ProfilEntete'
import { ProfilFragments } from './ProfilFragments'
import styles from './ProfilExplorateur.module.css'

export function ProfilExplorateur({ id }: { id: string }) {
  const { profil, erreur, reessayer } = useExplorateur(id)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>Ce profil n’a pas pu être chargé</EmptyState>
        <Button kind="secondaire" onClick={reessayer}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (profil === undefined) return null
  if (profil === null) return <ExplorateurIntrouvable />

  return (
    <div className={styles.profil}>
      <ProfilEntete profil={profil} />
      <ProfilFragments profil={profil} />
      <ProfilDecouvertes profil={profil} />
    </div>
  )
}
