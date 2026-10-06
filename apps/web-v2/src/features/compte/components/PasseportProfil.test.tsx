/**
 * QUOI     — le passeport sur le profil : un tampon par nature, les comptes, le lien d'ouverture.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Passeport } from '../api/lirePasseport'
import { PasseportProfil } from './PasseportProfil'

const api = vi.hoisted(() => ({ fetchPasseport: vi.fn() }))
vi.mock('../api/passeport', () => api)

const N = (id: string, nom: string) => ({
  id,
  nom,
  icone: `https://x/${id}.svg`,
  couleur: '#a9260f',
})
const T = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  nom: id,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-01',
  ...o,
})

const PASSEPORT: Passeport = {
  auJour: true,
  natures: [N('chateau', 'Châteaux'), N('source', 'Sources')],
  tampons: [T('a'), T('b', { departement: 'Var' }), T('c', { departement: null, pays: 'Italie' })],
}

beforeEach(() => {
  api.fetchPasseport.mockResolvedValue(PASSEPORT)
})

function afficher() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/compte/explorateur/u1']}>
        <Routes>
          <Route path="/:tab/explorateur/:id" element={<PasseportProfil id="u1" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('un tampon par nature, les manquantes en pointillés', async () => {
  afficher()
  expect(await screen.findByRole('img', { name: 'Châteaux : 3 lieux' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sources : pas encore' })).toBeInTheDocument()
})

test('le titre, les comptes et le lien d’ouverture', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: /Passeport\s*3/ })).toBeInTheDocument()
  expect(screen.getByText('2 départements · 2 pays')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ouvrir le passeport ›' })).toHaveAttribute(
    'href',
    '/compte/explorateur/u1/passeport',
  )
})

test('un compte nul ne s’affiche pas', async () => {
  api.fetchPasseport.mockResolvedValue({
    ...PASSEPORT,
    tampons: [T('c', { departement: null, pays: 'Italie' })],
  })
  afficher()
  expect(await screen.findByText('1 pays')).toBeInTheDocument()
  expect(screen.queryByText(/département/)).not.toBeInTheDocument()
})

test('zéro tampon ou passeport introuvable : pas de section', async () => {
  api.fetchPasseport.mockResolvedValue({ ...PASSEPORT, tampons: [] })
  afficher()
  await vi.waitFor(() => {
    expect(api.fetchPasseport).toHaveBeenCalled()
  })
  expect(screen.queryByRole('heading', { name: /Passeport/ })).not.toBeInTheDocument()
})

test('erreur : une ligne et Réessayer', async () => {
  api.fetchPasseport.mockRejectedValue(new Error('réseau'))
  afficher()
  expect(await screen.findByText('Le passeport n’a pas pu s’ouvrir.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
