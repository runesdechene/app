/**
 * QUOI     — la carte d'un lieu dans le profil (maquette « sous le signe de l'Hoplite ») :
 *            photo arrondie, nom, distance et pastille de catégorie, et son auteur si demandé.
 * POURQUOI — la distance ne s'affiche que si l'on connaît la position de celui qui regarde
 *            (Uriel, 27/09). L'auteur se montre sur les lieux visités ou désirés, pas sur ceux
 *            que le Porteur a lui-même ajoutés.
 * ATTENTION — l'icône de catégorie est un pochoir (comme en V1) : sa forme blanche est posée
 *            sur un rond de la couleur de la catégorie, par variables CSS.
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
      <span className={styles.photo}>
        {/* Sans photo, la tuile parchemin reste vide : le nom est écrit juste dessous. */}
        {lieu.imageUrl && <img src={lieu.imageUrl} alt="" loading="lazy" draggable={false} />}
      </span>
      <span className={styles.nom}>{lieu.nom}</span>
      {(distance || lieu.categorie) && (
        <span className={styles.ligne}>
          {distance}
          {lieu.categorie && (
            <span
              className={styles.categorie}
              style={{
                '--icone': `url(${lieu.categorie.icone})`,
                '--nuance': lieu.categorie.couleur,
              }}
              aria-hidden="true"
            />
          )}
        </span>
      )}
      {avecAuteur && lieu.auteur && (
        <span className={styles.auteur}>
          <Avatar url={lieu.auteur.avatarUrl} nom={lieu.auteur.nom} taille="mini" />
          par <strong>{lieu.auteur.nom}</strong>
        </span>
      )}
    </li>
  )
}
