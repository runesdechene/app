/**
 * QUOI     — la feuille « Ajouter » : « Un lieu » ouvre le parcours ; un brouillon qui attend se
 *            propose en tête, avec ce qu'il lui reste.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE } from '../lib/brouillon'
import { AjouterFeuille } from './AjouterFeuille'

const stockage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }))
vi.mock('idb-keyval', () => stockage)

beforeEach(() => {
  stockage.get.mockResolvedValue(undefined)
})

function monter(enTete?: ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: '/:tab/ajouter/*',
        element: <AjouterFeuille onFermer={() => undefined} enTete={enTete} />,
      },
    ],
    { initialEntries: ['/carte/ajouter'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('« Un lieu » ouvre le parcours, à sa première étape', async () => {
  const router = monter()
  await userEvent.click(await screen.findByRole('button', { name: /Un lieu/ }))
  expect(router.state.location.pathname).toBe('/carte/ajouter/lieu/photo')
})

test('le pin GPS s’ouvre ; le point d’intérêt reste pour plus tard', async () => {
  const router = monter()
  expect(await screen.findByRole('button', { name: /Un point d’intérêt/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: /Un pin GPS/ }))
  expect(router.state.location.pathname).toBe('/carte/ajouter/pin')
})

test('un brouillon attend : on le reprend là où on l’a laissé', async () => {
  stockage.get.mockResolvedValue({
    ...BROUILLON_VIDE,
    etape: 'recit',
    nom: 'Château de Colomars',
    photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
    point: { latitude: 43.7, longitude: 7.2 },
    natures: ['t1'],
  })
  const router = monter()
  const reprendre = await screen.findByRole('button', { name: /Reprendre ton brouillon/ })
  expect(reprendre).toHaveTextContent('Château de Colomars · il te reste le récit')
  await userEvent.click(reprendre)
  expect(router.state.location.pathname).toBe('/carte/ajouter/lieu/recit')
})

test('l’en-tête reçu (« Tes pins ») passe avant le brouillon à reprendre', async () => {
  stockage.get.mockResolvedValue({ ...BROUILLON_VIDE, nom: 'Château de Colomars' })
  monter(<p>Tes pins</p>)
  const reprendre = await screen.findByRole('button', { name: /Reprendre ton brouillon/ })
  const pins = screen.getByText('Tes pins')
  expect(pins.compareDocumentPosition(reprendre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('separator')).toBeInTheDocument()
})

test('un brouillon né d’un pin, sans photo ni nom, se reprend aussi', async () => {
  stockage.get.mockResolvedValue({
    ...BROUILLON_VIDE,
    pin: { id: 'p1', point: { latitude: 43.7, longitude: 7.2 }, poseLe: '2026-10-03T12:00:00Z' },
  })
  monter()
  expect(await screen.findByRole('button', { name: /Reprendre ton brouillon/ })).toBeInTheDocument()
})
