/**
 * QUOI     — l'invitation « Apparaître sur la carte » : une seule fois, et seulement si la position
 *            n'a jamais été demandée.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, type Mock } from 'vitest'
import type { Autorisation } from '@/shared/lib/position'
import { InvitationPosition } from './InvitationPosition'

type Position = { autorisation: Autorisation | null; autoriser: Mock<() => Promise<void>> }
const position = vi.hoisted(
  (): Position => ({ autorisation: 'a-demander', autoriser: vi.fn(() => Promise.resolve()) }),
)
vi.mock('@/shared/hooks/useAutorisationPosition', () => ({
  useAutorisationPosition: () => position,
}))

beforeEach(() => {
  localStorage.clear()
  position.autorisation = 'a-demander'
  position.autoriser.mockClear()
})

test('jamais demandée : l’invitation, et « Autoriser ma position » demande la position', async () => {
  render(<InvitationPosition />)
  expect(screen.getByText('Apparaître sur la carte')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Autoriser ma position' }))
  expect(position.autoriser).toHaveBeenCalled()
  expect(screen.queryByText('Apparaître sur la carte')).toBeNull()
})

test('« Plus tard » la ferme pour de bon', async () => {
  const { unmount } = render(<InvitationPosition />)
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
  expect(screen.queryByText('Apparaître sur la carte')).toBeNull()
  unmount()
  render(<InvitationPosition />)
  expect(screen.queryByText('Apparaître sur la carte')).toBeNull()
})

test.each<Autorisation | null>(['accordee', 'refusee', 'impossible', null])(
  'rien quand la position est « %s »',
  (autorisation) => {
    position.autorisation = autorisation
    render(<InvitationPosition />)
    expect(screen.queryByText('Apparaître sur la carte')).toBeNull()
  },
)
