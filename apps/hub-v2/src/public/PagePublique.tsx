/**
 * QUOI     — le cadre commun des pages publiques : la page entière, le contenu centré, et la
 *            place d'une photo.
 * POURQUOI — deux mises en page seulement, une par famille de pages :
 *            - « colonne » (/flyer, /flyercadeau) : sur le parchemin, la photo en haut au
 *              téléphone et à gauche sur PC, la colonne de 420 px à côté ;
 *            - « carte » (/soumettre-contenu, le design de la page en ligne) : sur PC, la photo
 *              couvre la page sous un voile et la carte se pose au centre ; au téléphone, pas de
 *              photo, la carte prend tout l'écran.
 *            La photo elle-même (l'image, sa lisière) et l'image de fond (`fond`) appartiennent à
 *            chaque page. Chaque page nomme son
 *            onglet : un `<title>` de React 19, que React pose dans le <head>.
 */
import type { CSSProperties, ReactNode } from 'react'
import styles from './PagePublique.module.css'

export function PagePublique({
  titre,
  children,
  photo,
  fond,
  disposition = 'colonne',
}: {
  titre: string
  children: ReactNode
  photo?: ReactNode
  fond?: string
  disposition?: 'colonne' | 'carte'
}) {
  return (
    <main className={styles.page} data-disposition={disposition}>
      <title>{titre}</title>
      {fond && <div className={styles.fond} style={{ '--fond': `url(${fond})` } as CSSProperties} aria-hidden="true" />}
      {photo && (
        <div className={styles.photo} data-photo>
          {photo}
        </div>
      )}
      <div className={styles.contenu}>{children}</div>
    </main>
  )
}
