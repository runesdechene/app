import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FicheLieu } from './FicheLieu'

const api = vi.hoisted(() => ({
  fetchFiche: vi.fn(),
  basculerEnvie: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('../api/lieu', () => api)

const FICHE = {
  id: 'a',
  nom: 'Château de Jonjeac',
  recit: 'Un récit.',
  adresse: 'Jonjeac',
  lat: 45.9,
  lng: 6.1,
  photos: [
    { url: 'u1', vignette: 'v1' },
    { url: 'u2', vignette: 'v2' },
  ],
  type: { nom: 'Château et fortins', icone: null, couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150, saison: null, acces: null, bivouac: null },
  explorateurs: { nombre: 3, derniers: [] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null },
  ajouteLe: '2026-01-01T00:00:00Z',
  enrichiPar: { id: 'm', nom: 'Mathéo' },
  moi: { visiteLe: null, envie: false },
}

beforeEach(() => {
  api.fetchFiche.mockResolvedValue(FICHE)
})

function afficher() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <FicheLieu
          id="a"
          onOptions={vi.fn()}
          onPartager={vi.fn()}
          boutonVisite={() => <span>bouton</span>}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('la fiche montre le lieu tel que maquetté', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: 'Château de Jonjeac' })).toBeInTheDocument()
  expect(screen.getByText('Château et fortins')).toBeInTheDocument()
  expect(screen.getByText('Moyen Âge · XIIᵉ siècle')).toBeInTheDocument()
  expect(screen.getByText('3 Explorateurs ont foulé ce lieu')).toBeInTheDocument()
  expect(screen.getByText('LES LOUPS')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Jonjeac/ })).toHaveAttribute(
    'href',
    expect.stringContaining('45.9,6.1'),
  )
  expect(screen.getByText(/Enrichi par/)).toBeInTheDocument()
})

test('« Envie d’y aller » bascule tout de suite', async () => {
  afficher()
  const signet = await screen.findByRole('button', { name: 'Envie d’y aller' })
  expect(signet).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(signet)
  expect(signet).toHaveAttribute('aria-pressed', 'true')
  expect(api.basculerEnvie).toHaveBeenCalledWith('a')
})

test('un lieu nu n’affiche aucune ligne vide', async () => {
  api.fetchFiche.mockResolvedValue({
    ...FICHE,
    photos: [],
    type: null,
    revendication: null,
    enrichiPar: null,
    faits: { epoque: null, annee: null, saison: null, acces: null, bivouac: null },
    explorateurs: { nombre: 0, derniers: [] },
  })
  afficher()
  expect(await screen.findByText('Personne n’a encore foulé ce lieu')).toBeInTheDocument()
  expect(screen.queryByText(/Revendiqué par/)).toBeNull()
  expect(screen.queryByText(/siècle/)).toBeNull()
})

test('un lieu introuvable le dit', async () => {
  api.fetchFiche.mockResolvedValue(null)
  afficher()
  expect(await screen.findByText('Ce lieu n’existe pas ou n’est plus visible')).toBeInTheDocument()
})

test('si la base refuse l’envie, le signet revient et le dit', async () => {
  api.basculerEnvie.mockRejectedValueOnce(new Error('réseau'))
  afficher()
  const signet = await screen.findByRole('button', { name: 'Envie d’y aller' })
  await userEvent.click(signet)
  expect(await screen.findByRole('alert')).toHaveTextContent('L’envie n’a pas pu être enregistrée')
  expect(signet).toHaveAttribute('aria-pressed', 'false')
})
