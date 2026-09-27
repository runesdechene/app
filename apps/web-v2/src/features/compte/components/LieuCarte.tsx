/**
 * QUOI     — la carte d'un lieu dans le profil, façon carnet de route (maquette 123:107) : la
 *            photo en grand ; en bas, l'icône de catégorie puis le nom, et l'auteur à droite ;
 *            en haut à droite, la distance.
 * POURQUOI — « J'adore la proposition pour les lieux » (Uriel, 27/09) : la photo est l'héroïne.
 *            La distance ne s'affiche que si l'on connaît la position de celui qui regarde ;
 *            l'auteur se montre sur les lieux visités ou désirés, pas sur ceux qu'on a ajoutés.
 * ATTENTION — l'icône de catégorie est un pochoir (comme en V1), peint en crème, SANS rond de
 *            couleur : sur une photo, une couleur de catégorie peut jurer (Uriel, 27/09).
 */
import { Avatar } from '@/shared/ui/Avatar'
import type { Lieu } from '../api/lireProfil'
import { distanceKm, formatDistance, type Point } from '../lib/distance'
import styles from './LieuCarte.module.css'

export function LieuCarte({
  lieu,
  position,
  avecAuteur,
}: {
  lieu: Lieu
  position: Point | null
  avecAuteur: boolean
}) {
  const distance =
    position && lieu.latitude !== null && lieu.longitude !== null
      ? formatDistance(distanceKm(position, { latitude: lieu.latitude, longitude: lieu.longitude }))
      : null

  return (
    <li className={styles.carte}>
      {lieu.imageUrl && (
        <img className={styles.photo} src={lieu.imageUrl} alt="" loading="lazy" draggable={false} />
      )}
      <span className={styles.voileHaut} aria-hidden="true" />
      {distance && <span className={styles.distance}>{distance}</span>}
      <span className={styles.bas}>
        {lieu.categorie && (
          <span
            className={styles.categorie}
            style={{ '--icone': `url(${lieu.categorie.icone})` }}
            aria-hidden="true"
          />
        )}
        <span className={styles.nom}>{lieu.nom}</span>
        {avecAuteur && lieu.auteur && (
          <span className={styles.auteur}>
            par {lieu.auteur.nom}
            <Avatar url={lieu.auteur.avatarUrl} nom={lieu.auteur.nom} taille="mini" />
          </span>
        )}
      </span>
    </li>
  )
}
