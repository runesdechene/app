import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Notifications } from './Notifications'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const vue = {
  abonnes: 1234,
  cloche: ['mise_a_jour'],
  sortes: [
    { type: 'mise_a_jour', semaine: 5, mois: 9, derniere: '2026-10-14T10:00:00Z', cloche: true },
    { type: 'new_comment', semaine: 2, mois: 4, derniere: '2026-10-13T10:00:00Z', cloche: false },
    { type: 'daily_enigma_ready', semaine: 40, mois: 100, derniere: '2026-10-08T10:30:00Z', cloche: false },
  ],
  fil: [
    { id: 2, type: 'mise_a_jour', quand: '2026-10-14T10:00:00Z', lu: false, pour: null, qui: null, sur: null },
    { id: 1, type: 'new_comment', quand: '2026-10-13T10:00:00Z', lu: true, pour: 'Aldric', qui: 'Kelpie', sur: 'Le col' },
  ],
}

function monter() {
  mockRpc.mockResolvedValue({ data: vue, error: null })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Notifications /></QueryClientProvider>)
}

test('trois chiffres : abonnés, qui partent ces 7 jours, créées sans partir', async () => {
  monter()
  expect(await screen.findByText('1 234')).toBeInTheDocument()
  expect(screen.getByText('téléphones abonnés au push')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.getByText('qui partent, ces 7 jours')).toBeInTheDocument()
  expect(screen.getByText('40')).toBeInTheDocument()
  expect(screen.getByText('créées sans partir')).toBeInTheDocument()
})

test('la RPC reçoit les types connus et ceux qui partent', async () => {
  monter()
  await screen.findByText('1 234')
  const [nom, args] = mockRpc.mock.calls[0] as [string, { p_types: string[]; p_fil: string[] }]
  expect(nom).toBe('notifications_du_hub')
  expect(args.p_types).toContain('daily_enigma_ready')
  expect(args.p_fil).not.toContain('daily_enigma_ready')
})

test('un type qui part sans ligne en 30 jours est signalé', async () => {
  monter()
  await screen.findByText('1 234')
  expect(screen.getAllByText('Aucune en 30 jours : à vérifier.').length).toBeGreaterThan(0)
})

test('une ligne du fil d’un compte effacé le dit', async () => {
  monter()
  expect(await screen.findByText('compte effacé')).toBeInTheDocument()
  expect(screen.getByText('Kelpie → Aldric · Le col')).toBeInTheDocument()
})
