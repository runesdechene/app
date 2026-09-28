/**
 * QUOI     — la petite liste des Explorateurs à mentionner, ouverte au-dessus de la barre quand on
 *            tape « @ » puis le début d'un nom : portrait et nom, un toucher pour choisir.
 * POURQUOI — la même feuille que le choix du canal (Menu.module.css) : un seul style de menu dans
 *            la messagerie.
 */
import { Avatar } from '@/shared/ui/Avatar'
import type { Personne } from '../api/lireRegistre'
import menu from './Menu.module.css'
import styles from './ListeMentions.module.css'

export function ListeMentions({
  personnes,
  onChoisir,
}: {
  personnes: Personne[]
  onChoisir: (p: Personne) => void
}) {
  return (
    <ul className={[menu.liste, styles.mentions].join(' ')} role="listbox" aria-label="Mentionner">
      {personnes.map((p) => (
        <li
          key={p.id}
          role="option"
          aria-selected={false}
          tabIndex={0}
          className={[menu.option, styles.personne].join(' ')}
          // Au pointeur appuyé, pas au clic : le champ ne perd pas la main avant le choix.
          onPointerDown={(e) => {
            e.preventDefault()
            onChoisir(p)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onChoisir(p)
            }
          }}
        >
          <Avatar url={p.avatar} nom={p.nom} taille="mini" />
          {p.nom}
        </li>
      ))}
    </ul>
  )
}
