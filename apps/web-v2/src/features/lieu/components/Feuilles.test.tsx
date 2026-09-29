import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const api = vi.hoisted(() => ({ fetchMoi: vi.fn(), supprimerLieu: vi.fn() }))
vi.mock('../api/lieu', () => api)

import { FeuilleOptions } from './FeuilleOptions'
import { FeuillePartager } from './FeuillePartager'

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
  const router = dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} onSupprime={vi.fn()} />)
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
  dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} onSupprime={vi.fn()} />)
  await screen.findByRole('button', { name: /Trouver sur la carte/ })
  await waitFor(() => {
    expect(api.fetchMoi).toHaveBeenCalled()
  })
  expect(screen.queryByRole('button', { name: /Supprimer ce lieu/ })).not.toBeInTheDocument()
})

test('un admin voit « Supprimer ce lieu »', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'uriel', admin: true })
  dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} onSupprime={vi.fn()} />)
  expect(await screen.findByRole('button', { name: /Supprimer ce lieu/ })).toBeInTheDocument()
})

test('l’auteur supprime son lieu, après confirmation', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'auteur', admin: false })
  const supprime = vi.fn()
  dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} onSupprime={supprime} />)
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
  dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} onSupprime={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Supprimer ce lieu/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Garder le lieu' }))
  expect(await screen.findByRole('button', { name: /Supprimer ce lieu/ })).toBeInTheDocument()
  expect(api.supprimerLieu).not.toHaveBeenCalled()
})
