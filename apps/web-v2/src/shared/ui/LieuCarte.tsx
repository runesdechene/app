/**
 * QUOI     — la carte d'un lieu, façon carnet de route (maquette 123:107, reprise par l'Accueil
 *            27:2 dans « Ajoutés récemment ») : la
 *            photo en grand ; en bas, l'icône de catégorie puis le nom, et l'auteur à droite ;
 *            en haut à droite, la distance.
 * POURQUOI — « J'adore la proposition pour les lieux » (Uriel, 27/09) : la photo est l'héroïne.
 *            La distance ne s'affiche que si l'on connaît la position de celui qui regarde ;
 *            l'auteur se montre sur les lieux visités ou désirés, pas sur ceux qu'on a ajoutés.
 *            Toute la carte est un lien vers la fiche (Uriel, 28/09) ; un glissé du carrousel à
 *            la souris ne l'ouvre pas (useGlisser annule le clic).
 * ATTENTION — l'icône de catégorie est un pochoir (comme en V1), peint en crème, SANS rond de
 *            couleur : sur une photo, une couleur de catégorie peut jurer (Uriel, 27/09).
 *            pastille et coin ne servent qu'au passeport (date du jour, tampon de la nature) ;
 *            le coin déborde de la carte, le rognage est donc sur le lien, pas sur la carte.
 *            pleineLargeur (passeport) : la carte prend la largeur de sa colonne, 180 px de haut,
 *            au lieu de 290 × 196 ; la photo se demande alors plus large.
 */
import { type ReactNode } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import { Link, useLocation } from 'react-router'
import { Avatar } from '@/shared/ui/Avatar'
import { distanceKm, formatDistance, type Point } from '@/shared/lib/distance'
import styles from './LieuCarte.module.css'

// Ce qu'une carte montre d'un lieu. Le profil et l'Accueil lisent la même forme.
export type LieuDeCarte = {
  id: string
  nom: string
  imageUrl: string | null
  latitude: number | null
  longitude: number | null
  categorie: { icone: string } | null
  auteur: { nom: string; avatarUrl: string | null } | null
}

export function LieuCarte({
  lieu,
  position,
  avecAuteur,
  pastille,
  coin,
  pleineLargeur,
}: {
  lieu: LieuDeCarte
  position: Point | null
  avecAuteur: boolean
  pastille?: string | undefined
  coin?: ReactNode | undefined
  pleineLargeur?: boolean | undefined
}) {
  const distance =
    position && lieu.latitude !== null && lieu.longitude !== null
      ? formatDistance(distanceKm(position, { latitude: lieu.latitude, longitude: lieu.longitude }))
      : null

  // La fiche s'ouvre dans l'onglet où l'on est (Compte, ou l'onglet qui montre ce profil).
  const onglet = useLocation().pathname.split('/')[1] ?? 'compte'

  return (
    <li className={styles.carte} data-pleine-largeur={pleineLargeur ? '' : undefined}>
      <Link
        className={styles.lien}
        to={`/${onglet}/lieu/${lieu.id}`}

        draggable={false}
      >
        {lieu.imageUrl && (
          <img
            className={styles.photo}
            src={aLaTaille(lieu.imageUrl, pleineLargeur ? 400 : 290)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}
        <span className={styles.voileHaut} aria-hidden="true" />
        {distance && <span className={styles.distance}>{distance}</span>}
        {pastille && <span className={styles.pastille}>{pastille}</span>}
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
      {coin && <span className={styles.coin}>{coin}</span>}
    </li>
  )
}
