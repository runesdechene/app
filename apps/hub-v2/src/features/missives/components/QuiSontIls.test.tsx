import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { QuiSontIls } from './QuiSontIls'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const REPONSE = {
  repondants: 128,
  reponses: {
    epoques: [{ cle: 'celtes', nombre: 58 }, { cle: 'rome', nombre: 12 }],
    decouverte: [{ cle: 'stand', nombre: 52 }],
    amene: [],
    plait: [{ cle: 'illustrations', nombre: 88 }],
  },
  libres: { epoques: [{ texte: 'Les Mayas', nombre: 2 }] },
  attentes: [{ id: 'u1', nom: 'Kelpie', texte: 'Plus de Celtes', le: '2026-10-22T10:00:00Z' }],
  mots: [{ id: 'u1', nom: 'Kelpie', texte: 'Merci pour tout', le: '2026-10-22T10:00:00Z' }],
  anniversaires_du_mois: [{ id: 'u2', nom: 'Brann', jour: 17 }],
}

function monter(reponse: unknown = REPONSE) {
  mockRpc.mockResolvedValue({ data: reponse, error: null })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <QuiSontIls />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('chaque réponse a son libellé et son nombre, les attentes et les anniversaires suivent', async () => {

  monter()
  const epoques = await screen.findByRole('region', { name: 'Quelle époque aimeraient-ils porter ?' })
  expect(within(epoques).getByRole('listitem', { name: /Les Celtes et les Gaulois/ })).toHaveTextContent('58')
  expect(screen.getByText(/128 personnes ont répondu/)).toBeInTheDocument()
  expect(screen.getByText('« Plus de Celtes »')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Leurs petits mots' })).getByText('« Merci pour tout »')).toBeInTheDocument()
  expect(within(epoques).getByText('Ils ont précisé : Les Mayas (2)')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: /Anniversaires/ })).getByText('Brann')).toBeInTheDocument()
})

test('« Porteurs » relit les réponses des seuls porteurs', async () => {
  monter()
  await screen.findByText(/128 personnes/)
  await userEvent.click(screen.getByRole('radio', { name: 'Porteurs' }))
  expect(mockRpc).toHaveBeenLastCalledWith('hub_qui_sont_ils', { p_segment: 'porteurs' })
})

test('personne n’a répondu : l’écran dit comment mettre le lien dans une Missive', async () => {
  monter({ repondants: 0, reponses: {}, libres: {}, attentes: [], mots: [], anniversaires_du_mois: [] })
  expect(await screen.findByText(/Personne n’a encore répondu/)).toBeInTheDocument()
  expect(screen.getByText('{questionnaire}')).toBeInTheDocument()
})

test('sans répondant, les anniversaires donnés au stand se voient quand même', async () => {
  monter({ repondants: 0, reponses: {}, libres: {}, attentes: [], mots: [], anniversaires_du_mois: [{ id: 'u2', nom: 'Brann', jour: 17 }] })
  expect(await screen.findByText('Brann')).toBeInTheDocument()
})
