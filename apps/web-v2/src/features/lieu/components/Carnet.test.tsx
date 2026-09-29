/**
 * QUOI     — le Carnet de passage : les mots et leurs réponses, « est venu·e », des cœurs à volonté
 *            (pas sur les siens), écrire, répondre, effacer le sien, « Lire les N mots ».
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { Carnet } from './Carnet'

const api = vi.hoisted(() => ({
  fetchCarnet: vi.fn(),
  ecrireAuCarnet: vi.fn(() => Promise.resolve()),
  aimerMot: vi.fn(() => Promise.resolve()),
  effacerMot: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/lieu', () => api)

const mot = (id: number, nom: string, texte: string, extra = {}) => ({
  id,
  quand: new Date().toISOString(),
  texte,
  qui: { id: nom, nom, avatar: null },
  venu: false,
  photos: [],
  coeurs: 0,
  miens: 0,
  aMoi: false,
  reponses: [],
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchCarnet.mockResolvedValue({
    total: 5,
    mots: [
      mot(1, 'Kelpie', 'Le chemin est glissant après la pluie.', {
        venu: true,
        coeurs: 14,
        reponses: [mot(2, 'Moi', 'Merci !', { aMoi: true })],
      }),
      mot(3, 'Mathéo', 'Quelqu’un a une source ?'),
    ],
  })
})

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/accueil/lieu/a']}>
        <Routes>
          <Route path=":tab/lieu/:id" element={<Carnet id="a" limite={3} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('les mots, leurs réponses, « est venu·e », et le lien vers le carnet entier', async () => {
  monter()
  const kelpie = (await screen.findByText('Le chemin est glissant après la pluie.')).closest(
    'article',
  )
  expect(kelpie).not.toBeNull()
  expect(within(kelpie as HTMLElement).getByText('est venu·e')).toBeInTheDocument()
  expect(within(kelpie as HTMLElement).getByText('Merci !')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Lire les 5 mots/ })).toHaveAttribute(
    'href',
    '/accueil/lieu/a/carnet',
  )
})

test('un cœur à volonté sur le mot d’un autre ; le sien se lit sans se toucher', async () => {
  monter()
  const coeur = await screen.findByRole('button', { name: 'Envoyer un cœur (14)' })
  await userEvent.click(coeur)
  await userEvent.click(coeur)
  expect(api.aimerMot).toHaveBeenCalledTimes(2)
  expect(api.aimerMot).toHaveBeenCalledWith(1, expect.anything())
  const mien = screen.getByText('Merci !').closest('article') as HTMLElement
  expect(within(mien).queryByRole('button', { name: /Envoyer un cœur/ })).toBeNull()
})

test('écrire un mot, puis répondre : la réponse va sous le mot', async () => {
  monter()
  const champ = await screen.findByRole('textbox', { name: 'Laisse un mot sur ce lieu…' })
  await userEvent.type(champ, 'Superbe au coucher du soleil.')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrireAuCarnet).toHaveBeenCalledWith('a', 'Superbe au coucher du soleil.', [], null)
  await waitFor(() => {
    expect(champ).toHaveValue('')
  })

  const [repondre] = screen.getAllByRole('button', { name: 'Répondre' })
  await userEvent.click(repondre as HTMLElement)
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Répondre à Kelpie…' }),
    'Merci du conseil',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrireAuCarnet).toHaveBeenLastCalledWith('a', 'Merci du conseil', [], 1)
})

test('effacer son mot demande une confirmation', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Effacer' }))
  expect(api.effacerMot).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Effacer ce mot' }))
  expect(api.effacerMot).toHaveBeenCalledWith(2, expect.anything())
})
