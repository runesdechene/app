/**
 * QUOI     — « Ce qui t'attend » : une ligne par file non vide, avec le lien vers son écran.
 */
import sectionNouvelles from '@/assets/ui/section-nouvelles.png'
import { depuis } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { LigneATraiter } from '@/shared/ui/LigneATraiter'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

export function Attente({ attente, maintenant }: { attente: Ouverture['attente']; maintenant: Date }) {
  const lignes = [
    { nombre: attente.photos, titre: 'Photos et avis à valider', vers: '/boutique/photos',
      detail: attente.photos_depuis ? `Le plus ancien attend depuis ${depuis(attente.photos_depuis, maintenant).replace('il y a ', '')}` : 'À relire' },
    { nombre: attente.lieux, titre: 'Lieux à modérer', vers: '/communaute/lieux', detail: 'Ajoutés depuis la bascule, jamais vérifiés' },
    { nombre: attente.signalements_lieu, titre: 'Signalements de lieux', vers: '/communaute/signalements', detail: 'Pas encore traités' },
    { nombre: attente.signalements_enigme, titre: 'Énigmes signalées', vers: '/jeu/enigmes-signalees', detail: 'Pas encore traitées' },
    { nombre: attente.achats, titre: 'Achats à associer à la main', vers: '/boutique/fragments', detail: 'Commandes sans compte trouvé' },
  ].filter((l) => l.nombre > 0)

  return (
    <section className={styles.section}>
      <TitreDeSection titre="Ce qui t’attend" icone={sectionNouvelles} />
      {lignes.length === 0 ? (
        <p className={styles.calme}>Rien ne t’attend. Belle journée.</p>
      ) : (
        <Bloc>
          {lignes.map((l) => <LigneATraiter key={l.vers} {...l} />)}
        </Bloc>
      )}
    </section>
  )
}
