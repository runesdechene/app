/**
 * QUOI     — « Nos conditions évoluent » : qui n'a pas accepté la version en vigueur ne passe
 *            qu'après avoir coché et continué ; qui l'a acceptée entre sans rien voir.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { VERSION_DES_CONDITIONS } from '@/shared/lib/conditions'
import { ConditionsAJour } from './ConditionsAJour'

const api = vi.hoisted(() => ({
  mesConditions: vi.fn((): Promise<string | null> => Promise.resolve(null)),
  accepterConditions: vi.fn<(version: string) => Promise<void>>(() => Promise.resolve()),
}))
vi.mock('@/shared/supabase/conditions', () => api)

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ConditionsAJour>
          <p>l’appli</p>
        </ConditionsAJour>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('sans la version en vigueur, il faut cocher et continuer pour entrer', async () => {
  monter()
  const continuer = await screen.findByRole('button', { name: 'Continuer' })
  expect(screen.queryByText('l’appli')).not.toBeInTheDocument()
  expect(continuer).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(continuer)
  await waitFor(() => {
    // TanStack passe un second argument à la fonction : on lit le premier.
    expect(api.accepterConditions.mock.calls[0]?.[0]).toBe(VERSION_DES_CONDITIONS)
  })
  expect(await screen.findByText('l’appli')).toBeInTheDocument()
})

test('avec la version en vigueur, on entre sans rien voir', async () => {
  api.mesConditions.mockResolvedValueOnce(VERSION_DES_CONDITIONS)
  monter()
  expect(await screen.findByText('l’appli')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continuer' })).not.toBeInTheDocument()
})
