/**
 * QUOI     — les Murmures : la liste (le sceau sur ce qui n'est pas lu, « Toi : »), une
 *            conversation (le moment après un silence, « lu », le silence du début) et murmurer.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { Conversation } from './Conversation'
import { ListeMurmures } from './ListeMurmures'

const api = vi.hoisted(() => ({
  fetchFils: vi.fn(),
  fetchConversation: vi.fn(),
  fetchCorrespondant: vi.fn(),
  murmurer: vi.fn(),
  lireMurmures: vi.fn(),
  ecouterMurmures: vi.fn(() => () => undefined),
}))
vi.mock('../api/murmures', () => api)

const LUNA = { id: 'u2', nom: 'Luna', avatar: null }

beforeEach(() => {
  api.fetchFils.mockResolvedValue([
    {
      avec: LUNA,
      dernier: { texte: 'Samedi, dix heures ?', quand: '2026-09-28T09:00:00Z', deMoi: false },
      nonLus: 2,
    },
    {
      avec: { id: 'u3', nom: 'Rémy', avatar: null },
      dernier: { texte: 'À bientôt.', quand: '2026-09-20T09:00:00Z', deMoi: true },
      nonLus: 0,
    },
  ])
  api.fetchCorrespondant.mockResolvedValue({ ...LUNA, derniereConnexion: null, region: null })
  api.fetchConversation.mockResolvedValue([
    {
      id: 1,
      texte: 'J’ai trouvé ton menhir.',
      quand: '2026-09-27T20:00:00Z',
      deMoi: false,
      luLe: '2026-09-28T08:00:00Z',
    },
    {
      id: 2,
      texte: 'Avec joie.',
      quand: '2026-09-28T09:00:00Z',
      deMoi: true,
      luLe: '2026-09-28T09:30:00Z',
    },
    {
      id: 3,
      texte: 'J’apporte le café.',
      quand: '2026-09-28T09:05:00Z',
      deMoi: true,
      luLe: '2026-09-28T09:30:00Z',
    },
  ])
  api.murmurer.mockResolvedValue(undefined)
  api.lireMurmures.mockResolvedValue(undefined)
})

function monter(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/messages'] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('la liste : le sceau sur les murmures pas lus, « Toi : » quand j’ai parlé en dernier', async () => {
  const router = monter(<ListeMurmures />)
  const luna = await screen.findByRole('link', { name: /Luna/ })
  expect(within(luna).getByRole('img', { name: '2 non lus' })).toBeInTheDocument()
  const remy = screen.getByRole('link', { name: /Rémy/ })
  expect(remy).toHaveTextContent('Toi : À bientôt.')
  expect(within(remy).queryByRole('img', { name: /non lu/ })).toBeNull()
  await userEvent.click(luna)
  expect(router.state.location.pathname).toBe('/messages/murmures/u2')
})

test('une conversation : le moment après un silence, « lu » sous mon dernier murmure', async () => {
  monter(<Conversation avec="u2" />)
  expect(await screen.findByText('J’ai trouvé ton menhir.')).toBeInTheDocument()
  // Deux moments : avant le premier, puis après la nuit ; pas entre deux murmures rapprochés.
  expect(
    screen.getAllByText(/^(hier|ce |cet |le |lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/),
  ).toHaveLength(2)
  const lus = screen.getAllByText('lu')
  expect(lus).toHaveLength(1)
})

test('rien encore : le silence, puis un premier murmure', async () => {
  api.fetchConversation.mockResolvedValue([])
  monter(<Conversation avec="u2" />)
  expect(await screen.findByText('Rien n’a encore été dit.')).toBeInTheDocument()
  await userEvent.type(await screen.findByRole('textbox', { name: 'Murmurer à Luna' }), 'Bonjour !')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.murmurer).toHaveBeenCalledWith('u2', 'Bonjour !')
})

test('ouvrir une conversation marque lus les murmures reçus', async () => {
  api.fetchConversation.mockResolvedValue([
    { id: 1, texte: 'Samedi ?', quand: '2026-09-28T09:00:00Z', deMoi: false, luLe: null },
  ])
  monter(<Conversation avec="u2" />)
  await screen.findByText('Samedi ?')
  expect(api.lireMurmures).toHaveBeenCalledWith('u2')
})
