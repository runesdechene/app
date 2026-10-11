/**
 * QUOI     — la carte « Nouveautés d’Explore » de la page Explore : la dernière note, ses comptes, et
 *            le chemin vers « Nouveautés » ; rien quand elle est ancienne et déjà lue.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { CarteNouveaute } from './CarteNouveaute'

const api = vi.hoisted(() => ({ fetchMisesAJour: vi.fn() }))
vi.mock('../api/nouveautes', () => api)

const note = (jours: number, lue: boolean) => ({
  id: 7,
  titre: 'Remonte le temps',
  texte: 'Un texte.',
  quand: new Date(Date.now() - jours * 86_400_000).toISOString(),
  image: 'https://exemple.test/frise.webp',
  version: 'Pythéas 1.17.0',
  coeurs: 12,
  miens: 0,
  mots: 4,
  aMoi: false,
  lue,
})

beforeEach(() => {
  api.fetchMisesAJour.mockResolvedValue([note(2, true)])
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/accueil']}>
        <Routes>
          {/* Comme dans la coquille : l'écran de l'onglet est rendu au-dessus de la route de l'onglet. */}
          <Route path="/" element={<CarteNouveaute />}>
            <Route path=":tab" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('la dernière note, ses comptes, et le chemin vers Nouveautés', async () => {
  afficher()
  const lien = await screen.findByRole('link', { name: /Remonte le temps/ })
  expect(lien).toHaveAttribute('href', '/accueil/nouveautes')
  expect(screen.getByText(/Pythéas 1\.17\.0/)).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText(/4 mots/)).toBeInTheDocument()
})

test('ancienne et déjà lue : rien', async () => {
  api.fetchMisesAJour.mockResolvedValue([note(20, true)])
  afficher()
  await vi.waitFor(() => {
    expect(api.fetchMisesAJour).toHaveBeenCalled()
  })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
