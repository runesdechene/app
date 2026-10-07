/**
 * QUOI     — une culture dans « Les énigmes » : le compte, l'encart de ce qui reste, ce qu'on a appris.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    { numero: 242, reponse: 'Sainte-Sophie', question: 'Quel monument ?', explication: 'La plus grande coupole…', le: '2026-05-03T10:00:00Z' },
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

test('une énigme apprise montre sa question ; la réponse et le savais-tu se déplient au toucher', async () => {
  api.fetchMaCulture.mockResolvedValue(byzance)
  afficher()
  const question = await screen.findByText('Quel monument ?')
  expect(screen.getByText('Sainte-Sophie')).not.toBeVisible()
  expect(screen.getByText('La plus grande coupole…')).not.toBeVisible()
  await userEvent.click(question)
  expect(screen.getByText('Sainte-Sophie')).toBeVisible()
  expect(screen.getByText('La plus grande coupole…')).toBeVisible()
})

test('chaque énigme porte son numéro fixe ; on les range par date de réussite ou par numéro', async () => {
  api.fetchMaCulture.mockResolvedValue({
    ...byzance,
    enigmes: [
      { numero: 242, reponse: 'Sainte-Sophie', question: 'Quel monument ?', explication: 'La coupole…', le: '2026-05-03T10:00:00Z' },
      { numero: 30, reponse: 'Justinien', question: 'Quel empereur ?', explication: 'Le code…', le: '2026-04-01T10:00:00Z' },
    ],
  })
  afficher()
  let cartes = await screen.findAllByRole('listitem')
  expect(cartes[0]).toHaveTextContent('N° 242')
  expect(cartes[1]).toHaveTextContent('N° 30')
  await userEvent.click(screen.getByRole('radio', { name: 'Par numéro' }))
  cartes = screen.getAllByRole('listitem')
  expect(cartes[0]).toHaveTextContent('N° 30')
  expect(cartes[1]).toHaveTextContent('N° 242')
})

test('sans cercle, pas de lien vers la carte', async () => {
  api.fetchMaCulture.mockResolvedValue({ ...byzance, centre: null })
  afficher()
  expect(await screen.findByText('Encore 58 énigmes à percer')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Les chercher sur la carte/ })).toBeNull()
})
