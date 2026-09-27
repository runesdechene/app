/**
 * QUOI     — les fondations de la DA : styles de texte, couleurs, espacements, rayons.
 * POURQUOI — chaque valeur de tokens.css, montrée avec son nom exact, pour être validée à l'œil.
 * ATTENTION — la valeur de chaque échantillon passe par une variable CSS inline ('--nuance',
 *            '--mesure') : c'est la seule forme de style inline que le lint autorise.
 */
import { Text } from '@/shared/ui/Text'
import { TEXT_VARIANTS } from '@/shared/ui/textVariants'
import { DaSection } from './DaSection'
import { COLOR_TOKENS, RADIUS_TOKENS, SPACE_TOKENS } from './daTokens'
import styles from './DaPage.module.css'

const PHRASE = 'Chaque motif est une histoire vraie.'

export function DaTextes() {
  return (
    <DaSection name="Textes">
      <ul className={styles.liste}>
        {TEXT_VARIANTS.map((variant) => (
          <li key={variant} className={styles.ligne}>
            <code>{variant}</code>
            <Text variant={variant} as="span">
              {PHRASE}
            </Text>
          </li>
        ))}
      </ul>
    </DaSection>
  )
}

export function DaMesures() {
  return (
    <>
      <DaSection name="Couleurs">
        <ul className={styles.grille}>
          {COLOR_TOKENS.map((token) => (
            <li key={token} className={styles.nuance}>
              <span className={styles.echantillon} style={{ '--nuance': `var(${token})` }} />
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </DaSection>

      <DaSection name="Espacements">
        <ul className={styles.liste}>
          {SPACE_TOKENS.map((token) => (
            <li key={token} className={styles.ligne}>
              <code>{token}</code>
              <span className={styles.espace} style={{ '--mesure': `var(${token})` }} />
            </li>
          ))}
        </ul>
      </DaSection>

      <DaSection name="Rayons">
        <ul className={styles.grille}>
          {RADIUS_TOKENS.map((token) => (
            <li key={token} className={styles.nuance}>
              <span className={styles.rayon} style={{ '--mesure': `var(${token})` }} />
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </DaSection>
    </>
  )
}
