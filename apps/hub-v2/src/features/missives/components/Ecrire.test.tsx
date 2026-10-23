import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, vi } from 'vitest'
import { Ecrire } from './Ecrire'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
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
    | [string, { p: { contenu: { titre: string }; couleurs: Record<string, string>; liste: string | null } }]
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
  expect(screen.getByRole('button', { name: /^Programmer pour 1\s041 personnes$/ })).toBeEnabled()
})
