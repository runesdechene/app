/**
 * QUOI     — la carte d'un lieu dans le profil, façon carnet de route (maquette 123:107) : la
 *            photo en grand ; en bas, l'icône de catégorie puis le nom, et l'auteur à droite ;
 *            en haut à droite, la distance.
 * POURQUOI — « J'adore la proposition pour les lieux » (Uriel, 27/09) : la photo est l'héroïne.
 *            La distance ne s'affiche que si l'on connaît la position de celui qui regarde ;
 *            l'auteur se montre sur les lieux visités ou désirés, pas sur ceux qu'on a ajoutés.
 *            Toute la carte est un lien vers la fiche (Uriel, 28/09) ; un glissé du carrousel à
 *            la souris ne l'ouvre pas (useGlisser annule le clic). La fiche sait que le profil est
 *            derrière elle : sur PC aussi, sa flèche y ramène.
 * ATTENTION — l'icône de catégorie est un pochoir (comme en V1), peint en crème, SANS rond de
 *            couleur : sur une photo, une couleur de catégorie peut jurer (Uriel, 27/09).
 */
import { Link, useLocation } from 'react-router'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
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

  // La fiche s'ouvre dans l'onglet où l'on est (Compte, ou l'onglet qui montre ce profil).
  const onglet = useLocation().pathname.split('/')[1] ?? 'compte'

  return (
    <li className={styles.carte}>
      <Link
        className={styles.lien}
        to={`/${onglet}/lieu/${lieu.id}`}
        state={VENU_D_UN_ECRAN}
        draggable={false}
      >
        {lieu.imageUrl && (
          <img
            className={styles.photo}
            src={lieu.imageUrl}
            alt=""
            loading="lazy"
            draggable={false}
          />
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
      </Link>
    </li>
  )
}
