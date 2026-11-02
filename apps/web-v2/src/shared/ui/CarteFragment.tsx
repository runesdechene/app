/**
 * QUOI     — la carte d'un Fragment, la même au profil et au Codex, dans ses trois états :
 *            porté (la carte dorée, le check à la couleur de sa collection), scanné (le motif net,
 *            sans couleur, « ×N »), inconnu (une silhouette, « ??? »). Deux marques possibles :
 *            « Nouveau » et l'édition (« Édition limitée », « Retiré », « Exclusif… »).
 * POURQUOI — une chose qui se répète devient un seul composant (Méthode d'Uriel) : la carte du
 *            profil (maquette 123:107) est celle du Codex (maquette F, 02/11).
 * ATTENTION — la carte ne porte pas d'action : le profil et le Codex l'enveloppent dans leur bouton.
 *            Sa largeur vient de son parent (112 px au profil, la grille au Codex).
 */
import { aLaTaille } from '@/shared/lib/image'
import styles from './CarteFragment.module.css'

export type EtatFragment = 'inconnu' | 'scanne' | 'porte'

export function CarteFragment({
  nom,
  image,
  etat,
  scans = 0,
  nouveau = false,
  edition = null,
  couleur = null,
  choisi = false,
}: {
  nom: string
  image: string | null
  etat: EtatFragment
  scans?: number
  nouveau?: boolean
  edition?: string | null
  couleur?: string | null
  choisi?: boolean
}) {
  return (
    <span
      className={styles.carte}
      data-etat={etat}
      data-choisi={choisi || undefined}
      style={couleur ? { '--couleur-collection': couleur } : undefined}
    >
      <span className={styles.motif}>
        {image && (
          <img
            src={aLaTaille(image, 104)}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        )}
        {etat === 'inconnu' && (
          <span className={styles.inconnu} aria-hidden="true">
            ?
          </span>
        )}
        {nouveau && <span className={styles.nouveau}>Nouveau</span>}
        {etat === 'scanne' && <span className={styles.scans}>×{scans}</span>}
        {etat === 'porte' && (
          <svg className={styles.porte} viewBox="0 0 22 22" role="img" aria-label="Porté">
            <circle cx="11" cy="11" r="11" />
            <path d="m6.5 11.2 3 3 6-6.2" />
          </svg>
        )}
      </span>
      <span className={styles.nom}>{etat === 'inconnu' ? '???' : nom}</span>
      {edition && <span className={styles.edition}>{edition}</span>}
    </span>
  )
}
