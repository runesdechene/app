/**
 * QUOI     — le bouton : une vraie balise button, trois sortes, un état désactivé qui l'est vraiment.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Button } from './Button'

test('rend un bouton de type button, principal par défaut', () => {
  render(<Button>Marquer ma visite</Button>)
  const button = screen.getByRole('button', { name: 'Marquer ma visite' })
  expect(button).toHaveAttribute('type', 'button')
  expect(button).toHaveClass('principal')
})

test('la sorte choisie donne sa classe', () => {
  render(<Button kind="discret">Lire ce fragment</Button>)
  expect(screen.getByRole('button')).toHaveClass('discret')
})

test('désactivé : ne réagit pas au toucher', async () => {
  const onClick = vi.fn()
  render(
    <Button disabled onClick={onClick}>
      Trop loin
    </Button>,
  )
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toBeDisabled()
  expect(onClick).not.toHaveBeenCalled()
})

test('actif : transmet le toucher', async () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Entrer</Button>)
  await userEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
