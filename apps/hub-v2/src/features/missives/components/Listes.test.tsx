import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Listes } from './Listes'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const LISTES = [
  { cle: 'tous', personnes: 4750, avec_accord: 3412, dernier: { objet: 'Ce que cache notre logo', le: '2026-10-26T18:00:00Z' } },
  { cle: 'prospects', personnes: 3622, avec_accord: 2284, dernier: null },
  { cle: 'porteurs', personnes: 1128, avec_accord: 1041, dernier: null },
  { cle: 'meilleurs', personnes: 86, avec_accord: 81, dernier: null },
  { cle: 'ambassadeurs', personnes: 1, avec_accord: 1, dernier: null },
]
const REPONSES: Record<string, unknown> = {
  hub_listes: LISTES,
  hub_ambassadeurs: [{ id: 'u1', nom: 'Laure', avatar: null, role: 'egerie', fragments: 9 }],
  hub_comptes: { lignes: [{ id: 'u7', nom: 'Pierrick', email: 'pierrick@exemple.fr', avatar: null, fragments: 7 }] },
}

function monter() {
  mockRpc.mockImplementation((nom: string) => Promise.resolve({ data: REPONSES[nom] ?? null, error: null }))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Listes />
    </QueryClientProvider>,
  )
}

test('cinq listes, avec leurs personnes, leurs accords et le dernier envoi', async () => {
  monter()
  const tous = await screen.findByRole('row', { name: /Tout le monde/ })
  expect(within(tous).getByText('4 750')).toBeInTheDocument()
  expect(within(tous).getByText('3 412')).toBeInTheDocument()
  expect(within(tous).getByText(/Ce que cache notre logo/)).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(6)
})

test('chercher un compte puis le nommer ambassadeur', async () => {
  monter()
  await userEvent.type(await screen.findByRole('searchbox', { name: /Ajouter/ }), 'pier')
  const ligne = await screen.findByRole('listitem', { name: 'Pierrick' })
  await userEvent.click(within(ligne).getByRole('button', { name: 'Ambassadeur' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_ambassadeur', { p_user: 'u7', p_role: 'ambassadeur' })
})

test('retirer une égérie', async () => {
  monter()
  const laure = await screen.findByRole('listitem', { name: 'Laure' })
  await userEvent.click(within(laure).getByRole('button', { name: 'Retirer' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_retirer_ambassadeur', { p_user: 'u1' })
})
