/**
 * QUOI     — la page « Les énigmes » : le compte en tête, une ligne par culture qui s'ouvre.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PageEnigmes } from './PageEnigmes'

const api = vi.hoisted(() => ({ fetchMesEnigmes: vi.fn(), fetchMaCulture: vi.fn() }))
vi.mock('../api/mesEnigmes', () => api)

function afficher(onOuvrir = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PageEnigmes onOuvrirCulture={onOuvrir} />
    </QueryClientProvider>,
  )
  return onOuvrir
}

test('le compte en tête, puis une ligne par culture', async () => {
  api.fetchMesEnigmes.mockResolvedValue({
    resolues: 137,
    total: 451,
    cultures: [
      { id: 'celtique', nom: 'Mondes celtes', icone: null, couleur: '#57b33d', resolues: 61, total: 77 },
      { id: 'byzantine', nom: 'Byzance', icone: null, couleur: '#a93d76', resolues: 14, total: 72 },
    ],
  })
  const onOuvrir = afficher()
  expect(await screen.findByText('137')).toBeInTheDocument()
  expect(screen.getByText('énigmes résolues sur 451')).toBeInTheDocument()
  expect(screen.getByText('14 / 72 énigmes résolues')).toBeInTheDocument()
  expect(screen.getByText(/Chaque énigme que tu perces sur la carte/)).toBeInTheDocument()
  expect(screen.queryByText(/« \? »/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Byzance/ }))
  expect(onOuvrir).toHaveBeenCalledWith('byzantine')
})

test('un compte sans énigme résolue se lit à zéro', async () => {
  api.fetchMesEnigmes.mockResolvedValue({
    resolues: 0,
    total: 72,
    cultures: [{ id: 'byzantine', nom: 'Byzance', icone: null, couleur: null, resolues: 0, total: 72 }],
  })
  afficher()
  expect(await screen.findByText('énigme résolue sur 72')).toBeInTheDocument()
  expect(screen.getByText('0 / 72 énigme résolue')).toBeInTheDocument()
})
