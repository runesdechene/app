/**
 * QUOI     — le routeur monte, l'adresse inconnue renvoie à l'accueil, et les pages publiques
 *            (flyers, soumission) s'ouvrent sans passer par la porte de l'équipe.
 * POURQUOI — la vraie porte tourne ici, sur un faux Supabase : on vérifie qu'une page publique
 *            ne demande jamais `hub_est_admin`, qu'il y ait une session ou non (spec §3).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { vi } from 'vitest'
import { MENU, ONGLETS } from './coquille/menu'
import { routes } from './router'

const { faux } = vi.hoisted(() => ({
  faux: {
    session: null as { access_token: string } | null,
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
  },
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: faux.session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    rpc: faux.rpc,
    // /soumettre-contenu lit les missions ouvertes, sans compte.
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
  },
}))

vi.mock('@/features/accueil/hooks/useOuverture', () => ({
  useOuverture: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}))

vi.mock('@/features/accueil/hooks/useSanteBoutique', () => ({
  useSanteBoutique: () => ({ shopify: undefined, shopifyErreur: null, fiches: undefined }),
}))

vi.mock('@/features/accueil/hooks/useFil', () => ({
  useFil: () => ({ activites: [], voirPlus: vi.fn(), aDAutres: false, isError: false }),
}))

vi.mock('@/features/communaute/hooks/useComptes', () => ({
  useComptes: () => ({ data: undefined, isError: false }),
  exporterComptes: vi.fn(),
}))

beforeEach(() => {
  faux.session = { access_token: 'jeton' }
  faux.rpc.mockClear()
})

function monter(adresse: string) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('une adresse inconnue renvoie à l’accueil', async () => {
  const router = monter('/inconnue')
  expect(await screen.findByText('Bonjour Uriel')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(faux.rpc).toHaveBeenCalledWith('hub_est_admin')
})

test('/communaute/comptes ouvre l’écran des comptes, pas « bientôt »', async () => {
  monter('/communaute/comptes')
  expect(await screen.findByRole('heading', { name: 'Les comptes' })).toBeInTheDocument()
})

// Chaque adresse du menu et des onglets a sa route écrite (plus de « bientôt »).
function cheminsRoutes(liste: RouteObject[], base = ''): string[] {
  return liste.flatMap((r) => {
    const chemin = r.index ? base || '/' : `${base}/${r.path ?? ''}`.replace(/\/+/g, '/')
    return [chemin, ...cheminsRoutes(r.children ?? [], chemin === '/' ? '' : chemin)]
  })
}

test('chaque adresse du menu et des onglets a sa route', () => {
  const connues = new Set(cheminsRoutes(routes))
  const attendues = [...MENU.flatMap((d) => d.liens), ...ONGLETS].map((l) => l.chemin)
  for (const chemin of attendues) expect(connues, chemin).toContain(chemin)
})

const PAGES_PUBLIQUES = [
  { adresse: '/flyer', titre: /^Runes de Chêne/ },
  { adresse: '/flyer/', titre: /^Runes de Chêne/ },
  { adresse: '/flyercadeau', titre: /un mouvement s’éveille$/ },
  { adresse: '/soumettre-contenu?quete=hoplite', titre: 'Envoyer mes contenus' },
  { adresse: '/soumettre-contenu/', titre: 'Envoyer mes contenus' },
]

describe.each([
  { cas: 'sans session', session: null },
  { cas: 'avec une session admin', session: { access_token: 'jeton' } },
])('$cas', ({ session }) => {
  test.each(PAGES_PUBLIQUES)('$adresse ouvre sa page publique, sans la porte ni la coquille', async ({ adresse, titre }) => {
    faux.session = session
    monter(adresse)
    expect(await screen.findByRole('heading', { name: titre })).toBeInTheDocument()
    expect(faux.rpc).not.toHaveBeenCalledWith('hub_est_admin')
    expect(screen.queryByRole('navigation', { name: 'Menu du Hub' })).not.toBeInTheDocument()
  })
})

test('de /flyer au cadeau : le cadre reste (la même photo), seule la page change', async () => {
  faux.session = null
  monter('/flyer')
  await screen.findByRole('heading', { name: /^Runes de Chêne/ })
  const photo = document.querySelector('[data-photo] img')
  expect(photo).not.toBeNull()
  await userEvent.click(screen.getByRole('link', { name: /Ton cadeau de bienvenue/ }))
  expect(await screen.findByRole('heading', { name: /un mouvement s’éveille$/ })).toBeInTheDocument()
  expect(document.querySelector('[data-photo] img')).toBe(photo)
  expect(document.title).toBe('Ton cadeau — Runes de Chêne')
})
