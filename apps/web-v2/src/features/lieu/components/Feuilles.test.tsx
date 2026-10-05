import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const api = vi.hoisted(() => ({
  fetchMoi: vi.fn(),
  supprimerLieu: vi.fn(),
  fetchCoeurs: vi.fn(),
  fetchHistoire: vi.fn(),
  revenirAVersion: vi.fn(() => Promise.resolve()),
  fetchVersion: vi.fn(),
  signalerLieu: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/lieu', () => api)

import { FeuilleCoeurs } from './FeuilleCoeurs'
import { FeuilleHistoire } from './FeuilleHistoire'
import { FeuilleOptions } from './FeuilleOptions'
import { FeuillePartager } from './FeuillePartager'
import { FeuilleSignaler } from './FeuilleSignaler'

const FICHE = {
  id: 'a',
  slug: 'chateau-de-jonjeac' as string | null,
  nom: 'Château de Jonjeac',
  lat: 45.9,
  lng: 6.1,
  type: { nom: 'Château et fortins', icone: null, couleur: null },
  photos: [],
  auteur: { id: 'auteur', nom: 'Kelpie', avatar: null } as {
    id: string
    nom: string
    avatar: string | null
  } | null,
}

beforeEach(() => {
  api.fetchMoi.mockResolvedValue({ id: 'quelqu-un', admin: false })
  api.supprimerLieu.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function dans(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/carte/lieu/a'] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('« Trouver sur la carte » garde la fiche ouverte et centre la carte sur le lieu', async () => {
  const router = dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={vi.fn()}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Trouver sur la carte/ }))
  expect(router.state.location.pathname).toBe('/carte/lieu/a')
  expect(router.state.location.search).toBe('?centre=45.9,6.1')
})

test('« Copier le lien » copie la phrase et le lien lisible du lieu, et le dit', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Copier le lien/ }))
  expect(writeText).toHaveBeenCalledWith(
    'J’ai trouvé Château de Jonjeac sur Runes de Chêne EXPLORE - tu connais ?\nhttps://app.runesdechene.com/lieu/chateau-de-jonjeac',
  )
  expect(await screen.findByText('Lien copié')).toBeInTheDocument()
})

test('avec le partage natif, « Partager ailleurs… » l’ouvre', async () => {
  const share = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Partager ailleurs/ }))
  expect(share).toHaveBeenCalledWith({
    title: 'Château de Jonjeac',
    text: 'J’ai trouvé Château de Jonjeac sur Runes de Chêne EXPLORE - tu connais ?',
    url: 'https://app.runesdechene.com/lieu/chateau-de-jonjeac',
  })
})

test('sans partage natif, « Partager ailleurs… » n’apparaît pas', () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Partager ailleurs/ })).toBeNull()
})

test('un lieu sans page publique se partage par l’adresse de sa fiche', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  dans(<FeuillePartager fiche={{ ...FICHE, slug: null }} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Copier le lien/ }))
  expect(writeText).toHaveBeenCalledWith(
    `J’ai trouvé Château de Jonjeac sur Runes de Chêne EXPLORE - tu connais ?
${window.location.origin}${import.meta.env.BASE_URL}carte/lieu/a`,
  )
})

test('supprimer : seulement pour qui l’a ajouté, ou un admin', async () => {
  dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={vi.fn()}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  await screen.findByRole('button', { name: /Trouver sur la carte/ })
  await waitFor(() => {
    expect(api.fetchMoi).toHaveBeenCalled()
  })
  expect(screen.queryByRole('button', { name: /Supprimer ce lieu/ })).not.toBeInTheDocument()
})

test('un admin voit « Supprimer ce lieu »', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'uriel', admin: true })
  dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={vi.fn()}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  expect(await screen.findByRole('button', { name: /Supprimer ce lieu/ })).toBeInTheDocument()
})

test('l’auteur supprime son lieu, après confirmation', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'auteur', admin: false })
  const supprime = vi.fn()
  dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={supprime}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  await userEvent.click(await screen.findByRole('button', { name: /Supprimer ce lieu/ }))
  expect(api.supprimerLieu).not.toHaveBeenCalled()
  expect(screen.getByText(/C’est définitif/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
  await waitFor(() => {
    expect(supprime).toHaveBeenCalled()
  })
  expect(api.supprimerLieu).toHaveBeenCalledWith('a', expect.anything())
})

test('« Garder le lieu » revient aux options sans rien supprimer', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'auteur', admin: false })
  dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={vi.fn()}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  await userEvent.click(await screen.findByRole('button', { name: /Supprimer ce lieu/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Garder le lieu' }))
  expect(await screen.findByRole('button', { name: /Supprimer ce lieu/ })).toBeInTheDocument()
  expect(api.supprimerLieu).not.toHaveBeenCalled()
})

test('« Les cœurs » : qui en a envoyé, et combien, les plus généreux d’abord', async () => {
  api.fetchCoeurs.mockResolvedValue({
    total: 29,
    miens: 0,
    gens: [
      { id: 'k', nom: 'Kelpie', avatar: null, nombre: 18 },
      { id: 'l', nom: 'Luna', avatar: null, nombre: 11 },
    ],
  })
  dans(<FeuilleCoeurs id="a" onFermer={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: 'Les cœurs · 29' })).toBeInTheDocument()
  const lignes = screen.getAllByRole('listitem')
  expect(lignes[0]).toHaveTextContent('Kelpie')
  expect(lignes[0]).toHaveTextContent('18')
  expect(lignes[1]).toHaveTextContent('Luna')
})

test('« Modifier la fiche » mène à l’écran de modification du lieu', async () => {
  const router = dans(
    <FeuilleOptions
      fiche={FICHE}
      onFermer={vi.fn()}
      onSupprime={vi.fn()}
      onHistoire={vi.fn()}
      onSignaler={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Modifier la fiche/ }))
  expect(router.state.location.pathname).toBe('/carte/lieu/a/modifier')
})

test('« L’histoire de la fiche » : chaque version en mots ; on en touche une, on la voit, on y revient', async () => {
  api.fetchHistoire.mockResolvedValue([
    {
      id: 3,
      quand: '2026-09-23T10:00:00Z',
      origine: false,
      champs: ['recit'],
      note: null,
      qui: { id: 'a', nom: 'Aelis', avatar: null },
    },
    {
      id: 1,
      quand: '2026-08-17T10:00:00Z',
      origine: true,
      champs: [],
      note: null,
      qui: { id: 'l', nom: 'Luna', avatar: null },
    },
  ])
  dans(<FeuilleHistoire id="a" onFermer={vi.fn()} />)
  expect(await screen.findByText(/a enrichi le récit/)).toBeInTheDocument()
  expect(screen.getByText('Actuelle')).toBeInTheDocument()
  expect(screen.getByText(/a ajouté le lieu/)).toBeInTheDocument()
  api.fetchVersion.mockResolvedValue({
    id: 1,
    quand: '2026-08-17T10:00:00Z',
    note: null,
    qui: { id: 'l', nom: 'Luna', avatar: null },
    champs: [],
  })
  await userEvent.click(screen.getByRole('button', { name: /Luna a ajouté le lieu/ }))
  expect(api.fetchVersion).toHaveBeenCalledWith(1)
  await userEvent.click(await screen.findByRole('button', { name: 'Revenir à cette version' }))
  expect(api.revenirAVersion).toHaveBeenCalledWith(1, expect.anything())
  // Revenu, la feuille rend la liste.
  expect(await screen.findByText('Actuelle')).toBeInTheDocument()
})

test('une version sans texte changé dit ce qu’elle a changé : « a changé le nom »', async () => {
  api.fetchHistoire.mockResolvedValue([
    {
      id: 5,
      quand: '2026-09-24T10:00:00Z',
      origine: false,
      champs: ['recit'],
      note: null,
      qui: { id: 'a', nom: 'Aelis', avatar: null },
    },
    {
      id: 4,
      quand: '2026-09-23T10:00:00Z',
      origine: false,
      champs: ['nom'],
      note: null,
      qui: { id: 'm', nom: 'Mathéo', avatar: null },
    },
  ])
  api.fetchVersion.mockResolvedValue({
    id: 4,
    quand: '2026-09-23T10:00:00Z',
    note: null,
    qui: { id: 'm', nom: 'Mathéo', avatar: null },
    champs: [],
  })
  dans(<FeuilleHistoire id="a" onFermer={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Mathéo a changé le nom/ }))
  expect(await screen.findByText(/a changé le nom/)).toBeInTheDocument()
  expect(screen.queryByText('Actuelle')).not.toBeInTheDocument()
})

test('le focus suit : la version ouverte le donne à « ‹ L’histoire », le retour à sa ligne', async () => {
  api.fetchHistoire.mockResolvedValue([
    {
      id: 5,
      quand: '2026-09-24T10:00:00Z',
      origine: false,
      champs: ['recit'],
      note: null,
      qui: { id: 'a', nom: 'Aelis', avatar: null },
    },
    {
      id: 4,
      quand: '2026-09-23T10:00:00Z',
      origine: false,
      champs: ['nom'],
      note: null,
      qui: { id: 'm', nom: 'Mathéo', avatar: null },
    },
  ])
  api.fetchVersion.mockResolvedValue({
    id: 4,
    quand: '2026-09-23T10:00:00Z',
    note: null,
    qui: { id: 'm', nom: 'Mathéo', avatar: null },
    champs: [],
  })
  dans(<FeuilleHistoire id="a" onFermer={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Mathéo a changé le nom/ }))
  const retour = screen.getByRole('button', { name: '‹ L’histoire' })
  expect(retour).toHaveFocus()
  await userEvent.click(retour)
  expect(screen.getByRole('button', { name: /Mathéo a changé le nom/ })).toHaveFocus()
})

test('« Signaler » : une raison, un mot, puis un merci', async () => {
  dans(<FeuilleSignaler id="a" onFermer={vi.fn()} />)
  const envoyer = screen.getByRole('button', { name: 'Envoyer le signalement' })
  expect(envoyer).toBeDisabled()
  await userEvent.click(screen.getByRole('radio', { name: 'C’est un doublon d’un autre lieu' }))
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Un mot de plus' }),
    'le château d’à côté',
  )
  await userEvent.click(envoyer)
  expect(api.signalerLieu).toHaveBeenCalledWith('a', 'doublon', 'le château d’à côté')
  expect(await screen.findByText('Merci')).toBeInTheDocument()
})
