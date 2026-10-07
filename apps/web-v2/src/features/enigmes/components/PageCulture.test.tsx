/**
 * QUOI     — une culture dans « Les énigmes » : le compte, l'encart de ce qui reste, ce qu'on a appris.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { PageCulture } from './PageCulture'

const api = vi.hoisted(() => ({ fetchMesEnigmes: vi.fn(), fetchMaCulture: vi.fn() }))
vi.mock('../api/mesEnigmes', () => api)

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PageCulture id="byzantine" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const byzance = {
  culture: { id: 'byzantine', nom: 'Byzance', icone: null, couleur: '#a93d76', zone: 'entre la Thrace et l’Asie Mineure' },
  resolues: 14,
  total: 72,
  centre: { lat: 41, lng: 28.9 },
  enigmes: [
    { reponse: 'Sainte-Sophie', question: 'Quel monument ?', explication: 'La plus grande coupole…', le: '2026-05-03T10:00:00Z' },
  ],
}

test('le compte, l’encart et le lien qui vole sur la zone', async () => {
  api.fetchMaCulture.mockResolvedValue(byzance)
  afficher()
  expect(await screen.findByText('14 / 72')).toBeInTheDocument()
  expect(screen.getByText('Encore 58 énigmes à percer')).toBeInTheDocument()
  expect(screen.getByText(/s’éveille entre la Thrace et l’Asie Mineure/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Les chercher sur la carte/ })).toHaveAttribute('href', '/carte?centre=41,28.9,6.5')
})

test('une carte par énigme apprise : réponse, question, le savais-tu', async () => {
  api.fetchMaCulture.mockResolvedValue(byzance)
  afficher()
  expect(await screen.findByText('Sainte-Sophie')).toBeInTheDocument()
  expect(screen.getByText('Quel monument ?')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
})

test('sans cercle, pas de lien vers la carte', async () => {
  api.fetchMaCulture.mockResolvedValue({ ...byzance, centre: null })
  afficher()
  expect(await screen.findByText('Encore 58 énigmes à percer')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Les chercher sur la carte/ })).toBeNull()
})
