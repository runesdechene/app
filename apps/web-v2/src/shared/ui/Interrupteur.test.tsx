/**
 * QUOI     — l'interrupteur : un switch accessible, qui ne bouge pas quand il est désactivé.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Interrupteur } from './Interrupteur'

test('un switch dont l’état se lit', () => {
  render(<Interrupteur libelle="Brouiller tes pistes" actif onChange={() => undefined} />)
  expect(screen.getByRole('switch', { name: 'Brouiller tes pistes' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('un clic demande l’état inverse', async () => {
  const onChange = vi.fn()
  render(<Interrupteur libelle="Montrer tes envies" actif={false} onChange={onChange} />)
  await userEvent.click(screen.getByRole('switch'))
  expect(onChange).toHaveBeenCalledWith(true)
})

test('désactivé : aucun appel', async () => {
  const onChange = vi.fn()
  render(<Interrupteur libelle="x" actif onChange={onChange} desactive />)
  await userEvent.click(screen.getByRole('switch'))
  expect(onChange).not.toHaveBeenCalled()
})
