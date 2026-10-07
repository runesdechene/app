/**
 * QUOI     — un lien d'invitation (`?company=<clé>`) ouvre la fiche de sa Compagnie.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { Invitation } from './Invitation'
import { cleDInvitation } from './cleDInvitation'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc } }))

test('la clé d’invitation se lit dans l’adresse', () => {
  expect(cleDInvitation('?company=a1b2c3')).toBe('a1b2c3')
  expect(cleDInvitation('?autre=1')).toBeNull()
  expect(cleDInvitation('')).toBeNull()
})

test('une clé connue mène à la fiche de la Compagnie', async () => {
  rpc.mockResolvedValue({ data: 'f-lys', error: null })
  const router = createMemoryRouter(
    [
      { path: '/', element: <Invitation /> },
      { path: '/compagnies/compagnie/:id', element: <p>La fiche</p> },
    ],
    { initialEntries: ['/?company=a1b2c3'] },
  )
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('La fiche')).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('compagnie_par_lien', { p_cle: 'a1b2c3' })
  expect(router.state.location.pathname).toBe('/compagnies/compagnie/f-lys')
})

test('une clé inconnue ne bouge rien', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  const router = createMemoryRouter([{ path: '/', element: <Invitation /> }], {
    initialEntries: ['/?company=perdue'],
  })
  render(<RouterProvider router={router} />)
  await waitFor(() => {
    expect(rpc).toHaveBeenCalledWith('compagnie_par_lien', { p_cle: 'perdue' })
  })
  expect(router.state.location.pathname).toBe('/')
})
