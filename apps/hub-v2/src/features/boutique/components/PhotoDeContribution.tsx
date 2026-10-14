/**
 * QUOI     — une photo (ou une vidéo) d'une contribution, qui s'ouvre en grand dans un onglet.
 * POURQUOI — l'emplacement de chaque fichier dans la lecture : les canaux (Média, communauté, mur), le
 *            produit Shopify, le téléchargement et la suppression s'y ajoutent sous l'image.
 */
import type { Contribution, PhotoDeContribution as Photo } from '../api/contributions'
import { estUneVideo, texteAlternatif } from '../lib/contribution'
import styles from './Photos.module.css'

export function PhotoDeContribution({ contribution, photo }: { contribution: Contribution; photo: Photo; rang: number }) {
  return (
    <figure className={styles.photo}>
      <a href={photo.url} target="_blank" rel="noreferrer">
        {estUneVideo(photo.url)
          ? <video src={photo.url} muted preload="metadata" />
          : <img src={photo.url} alt={texteAlternatif(contribution.nom, contribution.hauteur, photo.taille ?? contribution.taille)} loading="lazy" />}
      </a>
    </figure>
  )
}
