import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Synchro } from './Synchro'

const api = vi.hoisted(() => ({
  relierComptesEtClients: vi.fn(),
  lireComptesClients: vi.fn(),
  envoyerEtiquettes: vi.fn(),
  lireClientsShopify: vi.fn(),
}))
vi.mock('../api/synchro', () => ({
  relierComptesEtClients: api.relierComptesEtClients,
  lireComptesClients: api.lireComptesClients,
  envoyerEtiquettes: api.envoyerEtiquettes,
}))
vi.mock('../api/shopify', () => ({ lireClientsShopify: api.lireClientsShopify }))

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Synchro />
    </QueryClientProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

test('« Lancer la liaison » dit ce qui a été relié, avec les journaux', async () => {
  api.relierComptesEtClients.mockResolvedValue({
    success: true, shopifyTotal: 412, supabaseTotal: 500, updated: 3, created: 1, skipped: 408,
    logs: ['Shopify: 412 clients récupérés', 'Croisement: 3 à lier'],
  })
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Lancer la liaison' }))
  expect(await screen.findByText('412 clients lus — 3 reliés, 1 compte créé, 408 déjà à jour.')).toBeInTheDocument()
  expect(screen.getByText('Croisement: 3 à lier')).toBeInTheDocument()
})

test('une liaison en échec montre le message reçu', async () => {
  api.relierComptesEtClients.mockRejectedValue(new Error('Forbidden — admin only'))
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Lancer la liaison' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden — admin only')
})

test('« Poser les étiquettes » envoie des lots sans étiquette heritage- ajoutée et dit la fin', async () => {
  const comptes = Array.from({ length: 30 }, (_, i) => ({ email: `${String(i)}@x.fr`, client: i, provenance: 'app' }))
  api.lireComptesClients.mockResolvedValue(comptes)
  api.lireClientsShopify.mockResolvedValue(comptes.slice(0, 27).map((c) => ({ id: c.client, email: c.email, tags: 'vip', created_at: '' })))
  api.envoyerEtiquettes.mockImplementation((lot: { email: string }[]) => Promise.resolve(lot.map((l) => ({ email: l.email, success: true }))))
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  afficher()
  await utilisateur.click(screen.getByRole('button', { name: 'Poser les étiquettes' }))
  await vi.advanceTimersByTimeAsync(1000)
  expect(await screen.findByText('27 clients traités — 27 mis à jour, 0 erreur, 3 ignorés (déjà étiquetés ou absents de Shopify).')).toBeInTheDocument()
  vi.useRealTimers()
  const lots = api.envoyerEtiquettes.mock.calls.map((c) => c[0] as { tags: string }[])
  expect(lots.map((l) => l.length)).toEqual([25, 2])
  expect(lots.flat().some((e) => e.tags.includes('heritage-'))).toBe(false)
  expect(lots.flat()[0]?.tags).toBe('vip, source:app, app-player')
})

test('les erreurs d’étiquetage sont listées', async () => {
  api.lireComptesClients.mockResolvedValue([{ email: 'a@b.fr', client: 1, provenance: 'app' }])
  api.lireClientsShopify.mockResolvedValue([{ id: 1, email: 'a@b.fr', tags: '', created_at: '' }])
  api.envoyerEtiquettes.mockResolvedValue([{ email: 'a@b.fr', success: false, reason: 'Customer not found' }])
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Poser les étiquettes' }))
  expect(await screen.findByText('a@b.fr — Customer not found')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('a@b.fr — Customer not found')
  expect(screen.getByText('1 client traité — 0 mis à jour, 1 erreur, 0 ignoré (déjà étiquetés ou absents de Shopify).')).toBeInTheDocument()
})

test('une lecture qui échoue avant l’envoi est dite, rien n’est envoyé', async () => {
  api.lireComptesClients.mockResolvedValue([])
  api.lireClientsShopify.mockRejectedValue(new Error('Les fonctions Netlify ne répondent pas (HTTP 404).'))
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Poser les étiquettes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Les fonctions Netlify ne répondent pas')
  expect(api.envoyerEtiquettes).not.toHaveBeenCalled()
})

test('des comptes non créés : une alerte, et les journaux d’échec marqués', async () => {
  api.relierComptesEtClients.mockResolvedValue({
    success: true, shopifyTotal: 10, supabaseTotal: 5, updated: 0, created: 1, skipped: 6, toCreateCount: 4, toUpdateCount: 0,
    logs: ['Creates: 1 profils créés', '❌ Batch 0: 400'],
  })
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Lancer la liaison' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('3 comptes n’ont pas pu être créés — voir les journaux.')
  expect(screen.getByText('❌ Batch 0: 400')).toHaveAttribute('data-echec', 'true')
})

test('des liens refusés : une alerte au singulier, comptés sur ceux à lier', async () => {
  api.relierComptesEtClients.mockResolvedValue({
    success: true, shopifyTotal: 10, supabaseTotal: 5, updated: 2, created: 0, skipped: 6, toCreateCount: 0, toUpdateCount: 3,
    logs: ['Updates: 2 liés avec succès', '❌ Lien u2: 403'],
  })
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Lancer la liaison' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('1 compte n’a pas pu être relié — voir les journaux.')
})
