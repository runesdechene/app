import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, vi } from 'vitest'
import { Ecrire, EcrireMissive } from './Ecrire'

const mockRpc = vi.hoisted(() => vi.fn())
// Une Missive déjà enregistrée, rouverte par son adresse : /missives/ecrire/5.
const mockLire = vi.hoisted(() => vi.fn())
// jsdom n'a pas de canvas : la photo « penchée » est un simple Blob, et le dépôt rend une adresse lisible.
vi.mock('../lib/pencher', () => ({ pencher: () => Promise.resolve(new Blob(['photo'])) }))
// jsdom ne sait pas photographier un élément : le titre « photographié » est donné d'avance.
vi.mock('../lib/titres', () => ({
  photographierTitres: () => Promise.resolve({ titre: { src: 'https://stockage.test/titre.png', largeur: 520, hauteur: 230 } }),
}))
vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    storage: {
      from: () => ({
        upload: (chemin: string) => Promise.resolve({ data: { path: chemin }, error: null }),
        getPublicUrl: (chemin: string) => ({ data: { publicUrl: `https://stockage.test/missives/${chemin}` } }),
      }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: mockLire }) }) }),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt' } } }) },
  },
}))

const LISTES = [
  { cle: 'tous', personnes: 4750, avec_accord: 3412, dernier: null },
  { cle: 'prospects', personnes: 3622, avec_accord: 2284, dernier: null },
  { cle: 'porteurs', personnes: 1128, avec_accord: 1041, dernier: null },
  { cle: 'meilleurs', personnes: 86, avec_accord: 81, dernier: null },
  { cle: 'ambassadeurs', personnes: 12, avec_accord: 12, dernier: null },
]

function monter() {
  mockRpc.mockImplementation((nom: string) =>
    Promise.resolve({ data: nom === 'hub_listes' ? LISTES : nom === 'hub_enregistrer_missive' ? 12 : null, error: null }),
  )
  const f = vi.fn(() => Promise.resolve(Response.json({ ok: true })))
  vi.stubGlobal('fetch', f)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Ecrire />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return f
}

// Ce que la Missive enregistrée contient, au dernier enregistrement.
function enregistree() {
  const appel = mockRpc.mock.calls.filter(([nom]) => nom === 'hub_enregistrer_missive').at(-1) as
    | [string, { p: { contenu: { titre: string; photo: { url: string } }; contenu_envoi: { photo: { url: string }; titresEnImages?: Record<string, { src: string }> } | null; couleurs: Record<string, string>; liste: string | null } }]
    | undefined
  return appel?.[1].p
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('choisir « Fragment » dans le modèle affiche le Fragment', async () => {
  monter()
  await userEvent.click(screen.getByRole('button', { name: /Le modèle/ }))
  await userEvent.click(screen.getByRole('option', { name: /Fragment/ }))
  expect(screen.getByText('HÉCATE')).toBeInTheDocument()
})

test('écrire dans le titre change la Missive qui part en essai', async () => {
  const f = monter()
  const titre = document.querySelector<HTMLElement>('[data-zone="titre"]')
  if (!titre) throw new Error('le titre n’est pas modifiable')
  // jsdom ne calcule pas innerText : on le pose, comme le ferait la frappe.
  titre.innerText = 'LA NEIGE EST LÀ'
  fireEvent.blur(titre)
  await userEvent.click(screen.getByRole('button', { name: 'M’envoyer un essai' }))
  await waitFor(() => {
    expect(f).toHaveBeenCalledWith('/.netlify/functions/missives-essai', expect.objectContaining({ method: 'POST' }))
  })
  expect(enregistree()?.contenu.titre).toBe('LA NEIGE EST LÀ')
  // Ce qui part : la photo penchée, préparée à l'instant ; le brouillon garde l'originale, droite.
  expect(enregistree()?.contenu_envoi?.photo.url).toMatch(/^https:\/\/stockage\.test\/missives\//)
  expect(enregistree()?.contenu.photo.url).toMatch(/\/missives\/exemples\//)
  // Et ses titres en Bebas, photographiés : Gmail ignorerait la police.
  expect(enregistree()?.contenu_envoi?.titresEnImages?.titre?.src).toBe('https://stockage.test/titre.png')
})

test('une palette remplit les trois couleurs', async () => {
  monter()
  await userEvent.click(screen.getByRole('radio', { name: 'Hiver' }))
  expect(screen.getByLabelText('Fond')).toHaveValue('#1f2827')
  expect(screen.getByLabelText('Titres')).toHaveValue('#d6bd8c')
  expect(screen.getByLabelText('Rupture')).toHaveValue('#2a4845')
})

test('des couleurs illisibles empêchent de programmer et le disent', async () => {
  monter()
  await userEvent.click(await screen.findByRole('radio', { name: /Porteurs/ }))
  fireEvent.change(screen.getByLabelText('Fond'), { target: { value: '#f5ead6' } })
  fireEvent.change(screen.getByLabelText('Titres'), { target: { value: '#f0e0c0' } })
  expect(screen.getByText(/Le texte deviendrait difficile à lire/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Programmer pour/ })).toBeDisabled()
})

test('« Programmer » annonce combien de personnes la recevront', async () => {
  monter()
  await userEvent.click(await screen.findByRole('radio', { name: /Porteurs/ }))
  // Sans objet, rien ne part.
  expect(screen.getByRole('button', { name: /^Programmer pour 1\s041 personnes$/ })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('L’objet'), 'Le drop de novembre')
  // Les indications « {…} » du modèle et ses photos d'exemple ne partent jamais.
  expect(screen.getByRole('button', { name: /^Programmer pour 1\s041 personnes$/ })).toBeDisabled()
  expect(screen.getByText(/Reste à remplacer : .*\{ville\}/)).toBeInTheDocument()
})

test('quitter une Missive rouverte pour « Écrire » ouvre une lettre neuve, pas la précédente', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null })
  const { EXEMPLES } = await import('@runes/missives')
  mockLire.mockResolvedValue({
    data: { id: 5, modele: 'missive', contenu: { ...EXEMPLES.missive, titre: 'MISSIVE CINQ' }, couleurs: { fond: '#3f3024', titres: '#c49a5a', rupture: '#a94842' }, objet: 'Cinq', apercu: '', liste: 'tous' },
    error: null,
  })
  const router = createMemoryRouter(
    [{ path: '/missives/ecrire', Component: EcrireMissive }, { path: '/missives/ecrire/:id', Component: EcrireMissive }],
    { initialEntries: ['/missives/ecrire/5'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('MISSIVE CINQ')).toBeInTheDocument()
  await router.navigate('/missives/ecrire')
  await waitFor(() => {
    expect(screen.queryByText('MISSIVE CINQ')).not.toBeInTheDocument()
  })
  expect(screen.getByLabelText('L’objet')).toHaveValue('')
})

test('un e-mail de suite n’a ni liste ni Programmer : on l’enregistre tel qu’il partira, ou on le retire', async () => {
  mockRpc.mockResolvedValue({ data: 40, error: null })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ ok: true }))))
  const { EXEMPLES } = await import('@runes/missives')
  mockLire.mockResolvedValue({
    data: {
      // Une lettre déjà écrite : plus aucune indication « {…} » à remplacer.
      id: 40, modele: 'missive', contenu: { ...(JSON.parse(JSON.stringify(EXEMPLES.missive).replace(/\{[^{}"]*\}/g, 'écrit')) as typeof EXEMPLES.missive), titre: 'BIENVENUE' }, couleurs: { fond: '#3f3024', titres: '#c49a5a', rupture: '#a94842' },
      objet: 'Une lettre d’Uriel', apercu: '', liste: null, suite_etapes: { id: 9 },
    },
    error: null,
  })
  const router = createMemoryRouter(
    [{ path: '/missives/ecrire/:id', Component: EcrireMissive }, { path: '/missives/automatisations', element: <p>Les suites</p> }],
    { initialEntries: ['/missives/ecrire/40'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('BIENVENUE')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Programmer/ })).not.toBeInTheDocument()
  expect(screen.queryByText('À qui')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(enregistree()?.contenu_envoi).not.toBeNull() })

  await userEvent.click(screen.getByRole('button', { name: 'Retirer de la suite' }))
  expect(mockRpc).toHaveBeenCalledWith('hub_retirer_etape', { p_id: 9 })
  await screen.findByText('Les suites')
})

test('un e-mail de suite sans objet ne s’enregistre pas : il pourrait partir vide', async () => {
  mockRpc.mockResolvedValue({ data: 41, error: null })
  const { EXEMPLES } = await import('@runes/missives')
  mockLire.mockResolvedValue({
    data: {
      id: 41, modele: 'missive', contenu: { ...EXEMPLES.missive, titre: 'JOUR TROIS' }, couleurs: { fond: '#3f3024', titres: '#c49a5a', rupture: '#a94842' },
      objet: '', apercu: '', liste: null, suite_etapes: { id: 10 },
    },
    error: null,
  })
  const router = createMemoryRouter([{ path: '/missives/ecrire/:id', Component: EcrireMissive }], { initialEntries: ['/missives/ecrire/41'] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('JOUR TROIS')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})
