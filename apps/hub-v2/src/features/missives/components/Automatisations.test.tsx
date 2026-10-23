import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Automatisations } from './Automatisations'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const SUITES = [
  {
    cle: 'bienvenue', nom: 'Bienvenue', active: true, exige_accord: true, en_cours: 212, finis: 1480, arretes: 37,
    etapes: [
      { id: 1, jour: 0, missive_id: 40, objet: 'Une lettre d’Uriel', envoyes: 1729, ouverts: 1107, clics: 311 },
      { id: 2, jour: 3, missive_id: 41, objet: 'Ce que cache notre logo', envoyes: 1602, ouverts: 929, clics: 176 },
    ],
  },
  { cle: 'stand', nom: 'Bienvenue du stand', active: false, exige_accord: false, en_cours: 0, finis: 0, arretes: 0, etapes: [] },
  { cle: 'apres_achat', nom: 'Après le premier achat', active: false, exige_accord: false, en_cours: 0, finis: 0, arretes: 0, etapes: [] },
]

function monter(erreurs: Record<string, string> = {}) {
  mockRpc.mockImplementation((nom: string) =>
    Promise.resolve(
      erreurs[nom]
        ? { data: null, error: { message: erreurs[nom] } }
        : { data: nom === 'hub_suites' ? SUITES : nom === 'hub_ajouter_etape' ? 42 : null, error: null },
    ),
  )
  const router = createMemoryRouter(
    [{ path: '/missives/automatisations', Component: Automatisations }, { path: '/missives/ecrire/:id', element: <p>Écrire</p> }],
    { initialEntries: ['/missives/automatisations'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const suite = (nom: string) => screen.findByRole('region', { name: nom })

test('affiche les trois suites, avec leur état et leurs chiffres', async () => {
  monter()
  const bienvenue = await suite('Bienvenue')
  expect(within(bienvenue).getByText('Active')).toBeInTheDocument()
  expect(within(bienvenue).getByText(/212 en cours · 1 480 finis · 37 arrêtés par un achat/)).toBeInTheDocument()
  expect(within(bienvenue).getByText(/1 729 envoyés · 64 % ouverts · 18 % clics/)).toBeInTheDocument()
  expect(within(await suite('Bienvenue du stand')).getByText('En pause')).toBeInTheDocument()
  expect(await suite('Après le premier achat')).toBeInTheDocument()
})

test('chaque e-mail mène à Écrire, sous l’id de sa Missive', async () => {
  monter()
  const bienvenue = await suite('Bienvenue')
  const liens = within(bienvenue).getAllByRole('link', { name: 'Écrire' })
  expect(liens.map((l) => l.getAttribute('href'))).toEqual(['/missives/ecrire/40', '/missives/ecrire/41'])
})

test('ajouter un e-mail au jour saisi, puis ouvrir Écrire', async () => {
  const router = monter()
  const bienvenue = await suite('Bienvenue')
  await userEvent.click(within(bienvenue).getByRole('button', { name: '+ Ajouter un e-mail' }))
  const jour = within(bienvenue).getByRole('spinbutton', { name: 'Jour' })
  await userEvent.clear(jour)
  await userEvent.type(jour, '7')
  await userEvent.click(within(bienvenue).getByRole('button', { name: 'Ajouter' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_ajouter_etape', expect.objectContaining({ p_cle: 'bienvenue', p_jour: 7 }))
  await screen.findByText('Écrire')
  expect(router.state.location.pathname).toBe('/missives/ecrire/42')
})

test('changer le jour d’un e-mail', async () => {
  monter()
  const bienvenue = await suite('Bienvenue')
  await userEvent.click(within(bienvenue).getByRole('button', { name: 'Jour 3' }))
  const jour = within(bienvenue).getByRole('spinbutton', { name: 'Jour' })
  await userEvent.clear(jour)
  await userEvent.type(jour, '5{Enter}')
  expect(mockRpc).toHaveBeenCalledWith('hub_regler_etape', { p_id: 2, p_jour: 5 })
})

test('activer une suite sans e-mail : la base refuse et l’écran le dit', async () => {
  monter({ hub_activer_suite: 'Écris d’abord son premier e-mail' })
  const stand = await suite('Bienvenue du stand')
  await userEvent.click(within(stand).getByRole('button', { name: 'Activer' }))
  expect(await within(stand).findByRole('alert')).toHaveTextContent('Écris d’abord son premier e-mail')
})

test('mettre en pause une suite active', async () => {
  monter()
  await userEvent.click(within(await suite('Bienvenue')).getByRole('button', { name: 'Mettre en pause' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_activer_suite', { p_cle: 'bienvenue', p_active: false })
})
