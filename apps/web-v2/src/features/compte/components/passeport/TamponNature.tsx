/**
 * QUOI     — le tampon d'une nature : deux cercles et l'icône à sa couleur, le compte « ×N »
 *            (maquette « Passeport — 1 », 432:272).
 * POURQUOI — l'encre fonce à mesure qu'une nature se répète ; une nature jamais visitée reste
 *            en pointillés, sans couleur : ce qui manque se voit aussi.
 */
/* eslint-disable-next-line no-restricted-imports */
import type { Nature } from '@/features/compte/api/lirePasseport'
/* eslint-disable-next-line no-restricted-imports */
import type { Encre } from '@/features/compte/lib/passeport'
import styles from './TamponNature.module.css'

export function TamponNature({
  nature,
  compte,
  encre,
  taille = 'normal',
}: {
  nature: Nature
  compte: number
  encre: Encre | null
  taille?: 'normal' | 'petit'
}) {
  const libelle =
    encre === null
      ? `${nature.nom} : pas encore`
      : `${nature.nom} : ${String(compte)} ${compte > 1 ? 'lieux' : 'lieu'}`
  return (
    <span
      className={styles.tampon}
      role="img"
      aria-label={libelle}
      data-encre={encre ?? undefined}
      data-absent={encre === null ? '' : undefined}
      data-taille={taille}
      style={{ '--couleur': nature.couleur, '--icone': `url(${nature.icone})` }}
    >
      <span className={styles.icone} aria-hidden="true" />
      {encre !== null && (
        <span className={styles.compte} aria-hidden="true">
          ×{compte}
        </span>
      )}
    </span>
  )
}
