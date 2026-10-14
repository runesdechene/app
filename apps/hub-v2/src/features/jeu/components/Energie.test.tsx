import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { DEFAUTS, versLignes } from '../lib/energie'
import { Energie } from './Energie'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom } }))

const upsert = vi.fn()

function monter(lignes = versLignes(DEFAUTS)) {
  upsert.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({
    select: () => ({ in: () => Promise.resolve({ data: lignes, error: null }) }),
    upsert,
  })
  const router = createMemoryRouter([{ path: '/jeu/energie', Component: Energie }], { initialEntries: ['/jeu/energie'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
}

beforeEach(() => { upsert.mockReset() })

test('l’écran montre les réglages et la phrase qui dit la règle', async () => {
  monter()
  expect(await screen.findByRole('heading', { name: 'La jauge' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'L’Énergie' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Le prix d’une découverte' })).toBeInTheDocument()
  expect(screen.getByLabelText('Minutes par point')).toHaveValue(120)
  expect(screen.getByText(/Gratuit jusqu’à 50 km, puis 1 point jusqu’à 150 km/)).toBeInTheDocument()
})

test('une règle cassée : le message s’affiche et rien n’est écrit', async () => {
  monter()
  await screen.findByLabelText('Palier 1 (km)')
  const palier1 = screen.getByLabelText('Palier 1 (km)')
  await userEvent.clear(palier1)
  await userEvent.type(palier1, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Les distances doivent aller croissant')
  expect(upsert).not.toHaveBeenCalled()
})

test('des réglages valides : les dix lignes sont écrites, en secondes pour le cycle, puis « Enregistré. »', async () => {
  monter()
  const minutes = await screen.findByLabelText('Minutes par point')
  await userEvent.clear(minutes)
  await userEvent.type(minutes, '30')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(upsert).toHaveBeenCalledTimes(1)
  const [lignes, options] = upsert.mock.calls[0] as [{ key: string; value: string }[], { onConflict: string }]
  expect(options).toEqual({ onConflict: 'key' })
  expect(lignes).toHaveLength(10)
  expect(lignes).toContainEqual({ key: 'energy_base_cycle', value: '1800' })
  // Un champ modifié efface « Enregistré. »
  await userEvent.type(minutes, '5')
  expect(screen.queryByText('Enregistré.')).not.toBeInTheDocument()
})

test('une erreur de la base s’affiche telle quelle', async () => {
  monter()
  upsert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })
  await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('new row violates row-level security policy')
})

test('en erreur, l’en-tête de l’écran reste affiché', async () => {
  mockFrom.mockReturnValue({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'boum' } }) }) })
  const router = createMemoryRouter([{ path: '/jeu/energie', Component: Energie }], { initialEntries: ['/jeu/energie'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  expect(await screen.findByText('La base ne répond pas.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'L’Énergie' })).toBeInTheDocument()
})
