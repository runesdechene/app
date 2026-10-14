import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Fragment } from '../api/fragments'
import { TiroirFragment } from './TiroirFragment'

const api = vi.hoisted(() => ({
  lireFragments: vi.fn(),
  enregistrerFragment: vi.fn(),
  lireScans: vi.fn(),
  recalculerEmpreintes: vi.fn(),
  retirerEmpreinte: vi.fn(),
  lireCultures: vi.fn(),
}))
vi.mock('../api/fragments', () => ({ lireFragments: api.lireFragments, enregistrerFragment: api.enregistrerFragment }))
vi.mock('../api/scan', () => ({
  lireScans: api.lireScans, recalculerEmpreintes: api.recalculerEmpreintes, retirerEmpreinte: api.retirerEmpreinte,
}))
vi.mock('@/shared/cultures/api', () => ({ lireCulturesDuHub: api.lireCultures }))
// La carte simulée : un bouton « poser » appelle la prop onPoser.
vi.mock('./CarteDOrigine', () => ({
  CarteDOrigine: ({ onPoser }: { onPoser: (lat: number, lng: number) => void }) => (
    <button type="button" onClick={() => { onPoser(43.1, 5.9) }}>poser</button>
  ),
}))

const fragment = (surcharge: Partial<Fragment> = {}): Fragment => ({
  id: 7, name: 'Hoplite', link_url: null, visible: true, shopify_handle: null, resume: null, histoire: null,
  illustration_url: null, illustration_sombre_url: null, audio_url: null, artiste: null, narrateur: null,
  heritage: null, synchronise_le: null, origine_lat: null, origine_lng: null, origine_nom: null, theme: null,
  ...surcharge,
})

function afficher(chemin = '/boutique/fragments/7?q=ho') {
  const router = createMemoryRouter(
    [
      { path: '/boutique/fragments', element: <p>liste</p> },
      { path: '/boutique/fragments/:id', Component: TiroirFragment },
    ],
    { initialEntries: [chemin] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.resetAllMocks()
  api.lireFragments.mockResolvedValue([fragment()])
  api.enregistrerFragment.mockResolvedValue(undefined)
  api.lireScans.mockResolvedValue([{ id: 7, illustrations: 4, vues: [], scans7: 2, scans30: 9 }])
  api.lireCultures.mockResolvedValue([{ id: 'grecque', label: 'Grecque', couleur: '#3366aa' }])
})

test('un Fragment sans fiche Shopify le dit, avec son lien', async () => {
  api.lireFragments.mockResolvedValue([fragment({ link_url: 'https://runesdechene.com/collections/Hoplite' })])
  afficher()
  expect(await screen.findByText(/Aucune fiche Shopify reliée/)).toHaveTextContent('collection (https://runesdechene.com/collections/Hoplite)')
})

test('poser un point puis Enregistrer', async () => {
  afficher()
  await userEvent.type(await screen.findByLabelText('Lieu d’origine'), 'Sparte')
  await userEvent.click(screen.getByRole('button', { name: 'poser' }))
  expect(screen.getByText(/43\.1000, 5\.9000/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(api.enregistrerFragment).toHaveBeenCalledWith({ id: 7, origine_lat: 43.1, origine_lng: 5.9, origine_nom: 'Sparte', visible: true, theme: null }) })
  expect(await screen.findByText(/Enregistré\./)).toBeInTheDocument()
})

test('Retirer le point puis Enregistrer part sans coordonnées', async () => {
  api.lireFragments.mockResolvedValue([fragment({ origine_lat: 43.1, origine_lng: 5.9, origine_nom: 'Sparte' })])
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Retirer le point' }))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(api.enregistrerFragment).toHaveBeenCalledWith(expect.objectContaining({ origine_lat: null, origine_lng: null })) })
})

test('sans origine, changer la culture part sans coordonnées', async () => {
  afficher()
  await screen.findByRole('option', { name: 'Grecque' })
  await userEvent.selectOptions(screen.getByLabelText(/Culture/), 'grecque')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(api.enregistrerFragment).toHaveBeenCalledWith({ id: 7, origine_lat: null, origine_lng: null, origine_nom: null, visible: true, theme: 'grecque' }) })
})

test('l’erreur de la base s’affiche', async () => {
  api.enregistrerFragment.mockRejectedValue(new Error('Culture inconnue : zzz'))
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Culture inconnue : zzz')
})

test('le scan : recalculer, et une vue se retire après confirmation en ligne', async () => {
  api.lireScans.mockResolvedValue([{ id: 7, illustrations: 4, vues: [{ id: 3, le: '2026-10-01T10:00:00Z', par: 'Uriel' }], scans7: 2, scans30: 9 }])
  api.recalculerEmpreintes.mockResolvedValue(4)
  api.retirerEmpreinte.mockResolvedValue(undefined)
  afficher()
  expect(await screen.findByText(/Scans : 2 en 7 jours · 9 en 30 jours/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Recalculer' }))
  await waitFor(() => { expect(api.recalculerEmpreintes).toHaveBeenCalled() })
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  expect(screen.getByText('Retirer cette vue ?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  await waitFor(() => { expect(api.retirerEmpreinte).toHaveBeenCalledWith(3) })
})

test('un Fragment visible sans vue est à filmer', async () => {
  afficher()
  expect(await screen.findByText(/À filmer/)).toBeInTheDocument()
})

test('un Fragment inconnu : introuvable, retour à la liste', async () => {
  afficher('/boutique/fragments/999')
  expect(await screen.findByText('Fragment introuvable.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la liste' })).toHaveAttribute('href', '/boutique/fragments')
})
