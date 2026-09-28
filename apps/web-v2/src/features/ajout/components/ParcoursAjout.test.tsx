/**
 * QUOI     — le cadre du parcours : l'en-tête et ses étapes, jamais plus loin que le brouillon ne
 *            le permet, et quitter (sans question si rien n'est commencé ; sinon garder ou jeter).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE } from '../lib/brouillon'
import { ParcoursAjout } from './ParcoursAjout'

const stockage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}))
vi.mock('idb-keyval', () => stockage)
vi.mock('../api/ajout', () => ({
  fetchNatures: () => Promise.resolve([]),
  fetchEpoques: () => Promise.resolve([]),
  fetchVoisins: () => Promise.resolve([]),
}))

const quitter = vi.fn()

beforeEach(() => {
  stockage.get.mockResolvedValue(undefined)
  quitter.mockReset()
})

function Parcours() {
  const { etape } = useParams()
  return <ParcoursAjout etape={etape} onQuitter={quitter} onVoirLieu={() => undefined} />
}

function Ailleurs() {
  return null
}

function monter(chemin: string) {
  const router = createMemoryRouter(
    [
      { path: '/:tab/ajouter/lieu/:etape', Component: Parcours },
      { path: '*', Component: Ailleurs },
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

test('l’en-tête : quitter, le titre, et les quatre étapes', async () => {
  monter('/carte/ajouter/lieu/photo')
  expect(await screen.findByRole('dialog', { name: 'Nouveau lieu' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Quitter' })).toBeInTheDocument()
  const etapes = screen.getByRole('navigation', { name: 'Étapes' })
  expect(etapes).toHaveTextContent('Photo')
  expect(etapes).toHaveTextContent('Récit')
  expect(screen.getByRole('button', { name: 'Photo' })).toHaveAttribute('aria-current', 'step')
})

test('une étape que le brouillon ne permet pas encore ramène à la bonne', async () => {
  const router = monter('/carte/ajouter/lieu/recit')
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte/ajouter/lieu/photo')
  })
})

test('rien de commencé : quitter ne demande rien', async () => {
  monter('/carte/ajouter/lieu/photo')
  await userEvent.click(await screen.findByRole('button', { name: 'Quitter' }))
  expect(quitter).toHaveBeenCalled()
})

test('un brouillon commencé : quitter demande de le garder ou de le jeter', async () => {
  stockage.get.mockResolvedValue({
    ...BROUILLON_VIDE,
    photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
  })
  monter('/carte/ajouter/lieu/photo')
  await userEvent.click(await screen.findByRole('button', { name: 'Quitter' }))
  expect(quitter).not.toHaveBeenCalled()
  await userEvent.click(await screen.findByRole('button', { name: 'Le jeter' }))
  await waitFor(() => {
    expect(quitter).toHaveBeenCalled()
  })
  expect(stockage.del).toHaveBeenCalled()
})
