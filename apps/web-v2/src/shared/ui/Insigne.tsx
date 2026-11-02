/**
 * QUOI     — l'insigne d'une rareté : sceau d'encre (commune), losange vert-de-gris (peu commune),
 *            étoile d'or qui rayonne (rare), avec ou sans son libellé.
 * POURQUOI — un seul jeu d'insignes pour le Codex : la rareté d'une anecdote et le rang du numéro
 *            de Porteur (spec 02/11, Figma « Codex V1 / Rareté »). Les couleurs viennent des jetons.
 */
import type { Rarete } from '@/shared/lib/rang'
import styles from './Insigne.module.css'

const NOMS: Record<Rarete, string> = {
  commune: 'Commune',
  peu_commune: 'Peu commune',
  rare: 'Rare',
}

// Chaque insigne : une forme pleine, un anneau intérieur, un signe clair au centre.
const FORMES: Record<Rarete, { forme: string; anneau: string; signe: string }> = {
  commune: {
    forme: 'M18 3a15 15 0 1 0 0 30a15 15 0 1 0 0-30Z',
    anneau: 'M18 6.5a11.5 11.5 0 1 0 0 23a11.5 11.5 0 1 0 0-23Z',
    signe: 'M18 10.5v15',
  },
  peu_commune: {
    forme: 'M18 2.5 33.5 18 18 33.5 2.5 18Z',
    anneau: 'M18 7.5 28.5 18 18 28.5 7.5 18Z',
    signe: 'M15 12.5v11M15 14l5 3.5-5 3.5',
  },
  rare: {
    forme:
      'M18 1.5l3.6 6.4 7-2.3-1.6 7.2 6.5 3.7-6.5 3.7 1.6 7.2-7-2.3L18 34.5l-3.6-6.4-7 2.3 1.6-7.2L2.5 18l6.5-3.7-1.6-7.2 7 2.3Z',
    anneau: 'M18 10a8 8 0 1 0 0 16a8 8 0 1 0 0-16Z',
    signe: 'M18 12.5l3.5 3.5-3.5 3.5-3.5-3.5Z M14.5 19.5l-2 4 M21.5 19.5l2 4',
  },
}

export function Insigne({
  rarete,
  avecLibelle = false,
}: {
  rarete: Rarete
  avecLibelle?: boolean
}) {
  const { forme, anneau, signe } = FORMES[rarete]
  return (
    <span className={styles.insigne} data-rarete={rarete}>
      <svg className={styles.dessin} viewBox="0 0 36 36" role="img" aria-label={NOMS[rarete]}>
        <path className={styles.forme} d={forme} />
        <path className={styles.anneau} d={anneau} />
        <path className={styles.signe} d={signe} />
      </svg>
      {avecLibelle && (
        <span className={styles.libelle} aria-hidden="true">
          {NOMS[rarete].toUpperCase()}
        </span>
      )}
    </span>
  )
}
