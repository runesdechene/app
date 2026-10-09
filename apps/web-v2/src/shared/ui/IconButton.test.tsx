/**
 * QUOI     — le bouton-icône a toujours un nom lisible par un lecteur d'écran.
 */
import { render, screen } from '@testing-library/react'
import { IconButton } from './IconButton'

test('le libellé devient le nom accessible, l’image est décorative', () => {
  render(<IconButton label="Partager" icon="/icone.svg" />)
  const button = screen.getByRole('button', { name: 'Partager' })
  expect(button.querySelector('img')).toHaveAttribute('alt', '')
})
