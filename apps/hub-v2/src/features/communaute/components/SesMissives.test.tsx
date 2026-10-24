import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SesMissives } from './SesMissives'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const ABONNE = {
  accord: true, accord_le: '2026-09-12T10:00:00Z', porte: 'site', listes: ['porteurs', 'meilleurs'], ambassadeur: null,
  portrait: {
    epoques: ['celtes', 'rome'], decouverte: [], amene: [], plait: [], attente: 'Plus de Celtes', departement: null,
    anniv_jour: 12, anniv_mois: 3, repondu_le: '2026-10-22T10:00:00Z',
  },
  suite: { cle: 'bienvenue', nom: 'Bienvenue', jour_fait: 7, prochaine_le: '2026-11-03T10:00:00Z', arretee_le: null },
  derniers_envois: [{ objet: 'Ce que cache notre logo', statut: 'envoye', le: '2026-10-26T18:00:00Z' }],
}

function monter(donnees: unknown) {
  mockRpc.mockImplementation((nom: string) => Promise.resolve({ data: nom === 'hub_ses_missives' ? donnees : null, error: null }))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SesMissives compte="u1" />
    </QueryClientProvider>,
  )
}

test('un abonné : depuis quand et par où, ses listes, sa suite, ses époques, son anniversaire, ses envois', async () => {
  monter(ABONNE)
  expect(await screen.findByText('Abonné')).toBeInTheDocument()
  expect(screen.getByText(/depuis le 12\/09\/2026 · arrivé par le site/)).toBeInTheDocument()
  expect(screen.getByText('Porteur')).toBeInTheDocument()
  expect(screen.getByText('Meilleur client')).toBeInTheDocument()
  expect(screen.getByText('Bienvenue')).toBeInTheDocument()
  expect(screen.getByText(/jour 7 parti · le prochain le 03\/11/)).toBeInTheDocument()
  expect(screen.getByText('Les Celtes et les Gaulois, Rome')).toBeInTheDocument()
  expect(screen.getByText('12 mars')).toBeInTheDocument()
  expect(screen.getByText('« Ce que cache notre logo »')).toBeInTheDocument()
})

test('un désabonné le dit, avec la date', async () => {
  monter({ ...ABONNE, accord: false, accord_le: '2026-10-20T10:00:00Z', porte: 'desabonnement', suite: null, portrait: null })
  expect(await screen.findByText('Désabonné')).toBeInTheDocument()
  expect(screen.getByText(/le 20\/10\/2026/)).toBeInTheDocument()
  expect(screen.getByText(/N’a pas répondu au questionnaire/)).toBeInTheDocument()
})

test('« + Ajouter aux Ambassadeurs et égéries » le nomme ambassadeur', async () => {
  monter(ABONNE)
  await userEvent.click(await screen.findByRole('button', { name: '+ Ajouter aux Ambassadeurs et égéries' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_ambassadeur', { p_user: 'u1', p_role: 'ambassadeur' })
})

test('déjà ambassadeur : sa balise une seule fois', async () => {
  monter({ ...ABONNE, ambassadeur: 'ambassadeur', listes: ['porteurs', 'ambassadeurs'] })
  expect(await screen.findAllByText('Ambassadeur')).toHaveLength(1)
})

test('égérie : sa balise, pas de bouton', async () => {
  monter({ ...ABONNE, ambassadeur: 'egerie' })
  expect(await screen.findByText('Égérie')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ajouter aux Ambassadeurs/ })).not.toBeInTheDocument()
})
