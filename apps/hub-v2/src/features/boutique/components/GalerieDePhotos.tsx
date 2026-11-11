/**
 * QUOI     — la vue « Photos » de « Photos et avis » : toutes les photos en grille, chacune avec les endroits où
 *            elle est publiée (avis, fiche produit, mur, communauté), filtrables en placées / non placées.
 * POURQUOI — un clic ouvre la contribution de la photo dans la vue « Contributions », où se règlent les canaux.
 */
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { pluriel } from '@/shared/lib/texte'
import type { PhotoPubliee } from '../api/photos'
import { usePhotos } from '../hooks/useContributions'
import { estPlacee, PLACEMENTS, selonPlacement, type Placement } from '../lib/photos'
import { Miniature } from './Miniature'
import boutique from './Boutique.module.css'
import styles from './GalerieDePhotos.module.css'

function Endroits({ photo }: { photo: PhotoPubliee }) {
  if (!estPlacee(photo)) return <Balise texte="Nulle part" teinte="sommeil" />
  return (
    <>
      {photo.avis && <Balise texte="Avis" teinte="message" />}
      {photo.fiche && <Balise texte="Fiche produit" teinte="boutique" />}
      {photo.mur && <Balise texte="Mur" teinte="photo" />}
      {photo.communaute && <Balise texte="Communauté" teinte="compte" />}
    </>
  )
}

export function GalerieDePhotos({ placement, onPlacement, onOuvrir }: {
  placement: Placement; onPlacement: (p: Placement) => void; onOuvrir: (photo: PhotoPubliee) => void
}) {
  const { data, isError } = usePhotos()
  const photos = selonPlacement(data ?? [], placement)

  return (
    <>
      <div className={styles.barre}>
        <ChoixSegmente nom="Publication" options={PLACEMENTS} choisi={placement} onChoix={onPlacement} />
        {data && <span className={styles.compte}>{`${String(photos.length)} ${pluriel(photos.length, 'photo')}`}</span>}
      </div>
      {isError && <p className={boutique.calme}>La base ne répond pas.</p>}
      {data && photos.length === 0 && <Bloc><p className={boutique.calme}>Aucune photo ici.</p></Bloc>}
      <ul className={styles.grille}>
        {photos.map((p) => (
          <li key={p.id}>
            <button type="button" className={styles.carte} onClick={() => { onOuvrir(p) }}>
              <Miniature className={styles.image} url={p.url} alt={`Photo de ${p.nom}`} />
              <span className={styles.endroits}><Endroits photo={p} /></span>
              <span className={styles.nom}>{p.nom}</span>
              {p.produit_titre && <span className={styles.produit}>{p.produit_titre}</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
