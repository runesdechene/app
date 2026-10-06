/**
 * QUOI     — les adresses d'un pin : un pin inconnu (ou encore dans le téléphone, pour le
 *            compléter) renvoie à la feuille du « + » une fois la liste arrivée ; avant, rien.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PinAffiche } from '@/features/pin/hooks/usePins'
import { RouteAjouter, RouteCompleterPin, RouteFichePin } from './carte'

// La liste est une petite source externe : la changer refait le rendu, comme le cache relu.
const pins = vi.hoisted(() => {
  const abonnes = new Set<() => void>()
  const etat = {
    liste: undefined as PinAffiche[] | undefined,
    envoyerALOuverture: vi.fn(),
    abonner: (f: () => void) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    relire: (l: PinAffiche[]) => {
      etat.liste = l
      abonnes.forEach((f) => {
        f()
      })
    },
  }
  return etat
})
vi.mock('@/features/pin/hooks/usePins', async () => {
  const { useSyncExternalStore } = await import('react')
  const useListe = () => useSyncExternalStore(pins.abonner, () => pins.liste)
  return {
    useMesPinsCharges: useListe,
    useMesPins: () => useListe() ?? [],
    useSupprimerPin: () => ({ mutate: vi.fn(), isPending: false }),
    useEnvoyerALOuverture: pins.envoyerALOuverture,
  }
})
// « C'est l'un de ceux-là ? » a ses propres tests : ici, seule compte la route qui la porte.
vi.mock('@/features/pin/components/CestLunDeCeuxLa', () => ({
  CestLunDeCeuxLa: () => <p>Les lieux proches du pin</p>,
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
      { path: '/:tab/ajouter', Component: RouteAjouter },
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

test('ouvrir le « + » envoie les pins en attente', () => {
  pins.liste = []
  monter('/carte/ajouter')
  expect(pins.envoyerALOuverture).toHaveBeenCalled()
})

test('compléter : le pin fermé pendant « C’est lui » ne renvoie pas au « + » (l’écran finit de le dire)', async () => {
  pins.liste = [{ ...EN_ATTENTE, id: 'envoye', enAttente: false }]
  const router = monter('/carte/ajouter/pin/envoye/completer')
  expect(await screen.findByText('Les lieux proches du pin')).toBeInTheDocument()
  act(() => {
    pins.relire([]) // « C'est lui » l'a fermé : la liste relue ne l'a plus
  })
  expect(router.state.location.pathname).toBe('/carte/ajouter/pin/envoye/completer')
  expect(screen.getByText('Les lieux proches du pin')).toBeInTheDocument()
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
