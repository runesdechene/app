/**
 * QUOI     — les adresses d'un pin : un pin inconnu (ou encore dans le téléphone, pour le
 *            compléter) renvoie à la feuille du « + » une fois la liste arrivée ; avant, rien.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PinAffiche } from '@/features/pin/hooks/usePins'
import { RouteCompleterPin, RouteFichePin } from './carte'

const pins = vi.hoisted(() => ({
  liste: undefined as PinAffiche[] | undefined,
}))
vi.mock('@/features/pin/hooks/usePins', () => ({
  useMesPinsCharges: () => pins.liste,
  useMesPins: () => pins.liste ?? [],
  useSupprimerPin: () => ({ mutate: vi.fn(), isPending: false }),
}))

const EN_ATTENTE: PinAffiche = {
  id: 'att',
  point: { latitude: 43.7, longitude: 7.2 },
  lieuDit: null,
  poseLe: new Date('2026-10-06T12:00:00Z'),
  jours: 15,
  enAttente: true,
  refuse: false,
}

beforeEach(() => {
  pins.liste = undefined
})

function monter(chemin: string) {
  const router = createMemoryRouter(
    [
      { path: '/:tab/ajouter/pin/:id', Component: RouteFichePin },
      { path: '/:tab/ajouter/pin/:id/completer', Component: RouteCompleterPin },
      { path: '*', element: null },
    ],
    { initialEntries: [chemin] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('pendant le chargement, on attend sans rien conclure', () => {
  const router = monter('/carte/ajouter/pin/inconnu')
  expect(router.state.location.pathname).toBe('/carte/ajouter/pin/inconnu')
})

test('la petite carte d’un pin inconnu renvoie au « + »', async () => {
  pins.liste = []
  const router = monter('/carte/ajouter/pin/inconnu')
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte/ajouter')
  })
})

test('compléter un pin inconnu, ou encore en attente, renvoie au « + »', async () => {
  pins.liste = [EN_ATTENTE]
  const router = monter('/carte/ajouter/pin/att/completer')
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte/ajouter')
  })
})

test('« Voir sur la carte » ouvre la carte sur le pin, sans empiler d’historique', async () => {
  pins.liste = [{ ...EN_ATTENTE, id: 'envoye', enAttente: false }]
  const router = monter('/carte/ajouter/pin/envoye')
  await userEvent.click(await screen.findByRole('button', { name: 'Voir sur la carte' }))
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte')
  })
  expect(router.state.location.search).toBe('?pin=envoye')
})
