/**
 * QUOI     — chaque style de texte rend la bonne balise et la bonne classe.
 */
import { render, screen } from '@testing-library/react'
import { Text } from './Text'
import { TEXT_VARIANTS } from './textVariants'

test('un titre d’écran est un h1 par défaut', () => {
  render(<Text variant="titre-ecran">Le Codex</Text>)
  expect(screen.getByRole('heading', { level: 1, name: 'Le Codex' })).toHaveClass('titreEcran')
})

test('la balise peut changer sans changer le style', () => {
  render(
    <Text variant="titre-ecran" as="h2">
      Le Codex
    </Text>,
  )
  expect(screen.getByRole('heading', { level: 2 })).toHaveClass('titreEcran')
})

test('le corps est un paragraphe', () => {
  render(<Text variant="corps">Chaque motif est une histoire vraie.</Text>)
  expect(screen.getByText('Chaque motif est une histoire vraie.').tagName).toBe('P')
})

test('chaque style a sa classe', () => {
  for (const variant of TEXT_VARIANTS) {
    const { unmount } = render(<Text variant={variant}>{variant}</Text>)
    expect(screen.getByText(variant).className).not.toBe('')
    unmount()
  }
})
