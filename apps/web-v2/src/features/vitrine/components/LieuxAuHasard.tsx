/**
 * QUOI     — « Quelques lieux de la carte », sous le premier écran de la vitrine (maquettes
 *            549:828 ordinateur, 549:1097 téléphone) : des lieux tirés au sort, chacun avec sa
 *            photo, sa nature sur la photo, son département et son numéro, et qui l'a ajouté.
 *            Puis le lien vers la carte des visiteurs.
 * POURQUOI — Uriel, 11/10 : que la vitrine montre de vrais lieux, et que Google suive leurs
 *            liens vers les fiches publiques /lieu/* (la page est rendue au déploiement).
 *            « Ajouté par » : le sentiment d'une communauté vivante (exception validée le 11/10
 *            à « jamais de personne sur la vitrine » : le nom et la photo de profil seulement).
 * ATTENTION — un lien <a> et non <Link> : /lieu/* est servi par seo-pages, pas par l'appli.
 */
import { Link } from 'react-router'
import { aLaTaille } from '@/shared/lib/image'
import { Avatar } from '@/shared/ui/Avatar'
import type { LieuAuHasard } from '../api/lireVitrine'
import styles from './LieuxAuHasard.module.css'

const NOMBRE = new Intl.NumberFormat('fr-FR')

export function LieuxAuHasard({
  lieux,
  lieuxSurLaCarte,
}: {
  lieux: LieuAuHasard[]
  lieuxSurLaCarte: number | null
}) {
  if (lieux.length === 0) return null
  const combien = lieuxSurLaCarte === null ? '' : `${NOMBRE.format(lieuxSurLaCarte)} `

  return (
    <section className={styles.section} aria-labelledby="lieux-au-hasard">
      <p className={styles.surtitre}>Au hasard de la carte</p>
      <h2 id="lieux-au-hasard" className={styles.titre}>
        Quelques lieux de la carte
      </h2>
      <p className={styles.sous}>
        Tirés au hasard parmi les {combien}lieux que les Explorateurs ont sortis de l’oubli.
      </p>

      <ul className={styles.lieux}>
        {lieux.map((lieu) => (
          <li key={lieu.id} className={styles.lieu}>
            <a className={styles.lien} href={`/lieu/${lieu.slug}`}>
              <span className={styles.cadre}>
                <img
                  className={styles.photo}
                  src={aLaTaille(lieu.photo, 300)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                {lieu.nature && (
                  <span
                    className={styles.nature}
                    style={lieu.nature.couleur ? { '--type': lieu.nature.couleur } : undefined}
                  >
                    {lieu.nature.icone && (
                      <span
                        className={styles.icone}
                        style={{ '--icone': `url(${lieu.nature.icone})` }}
                        aria-hidden="true"
                      />
                    )}
                    {lieu.nature.nom}
                  </span>
                )}
              </span>
              <span className={styles.nom}>{lieu.nom}</span>
              {lieu.region && (
                <span className={styles.region}>
                  {lieu.numero ? `${lieu.region} (${lieu.numero})` : lieu.region}
                </span>
              )}
            </a>
            {lieu.auteur && (
              <p className={styles.auteur}>
                <Avatar url={lieu.auteur.avatar} nom={lieu.auteur.nom} taille="mini" />
                <span>
                  Ajouté par <strong>{lieu.auteur.nom}</strong>
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>

      <Link className={styles.carte} to="/bienvenue/carte">
        Voir les {combien}lieux sur la carte
      </Link>
    </section>
  )
}
