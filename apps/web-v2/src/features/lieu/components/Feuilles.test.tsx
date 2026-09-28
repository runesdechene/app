import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { FeuilleOptions } from './FeuilleOptions'
import { FeuillePartager } from './FeuillePartager'

const FICHE = {
  id: 'a',
  nom: 'Château de Jonjeac',
  lat: 45.9,
  lng: 6.1,
  type: { nom: 'Château et fortins', icone: null, couleur: null },
  photos: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function dans(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/carte/lieu/a'] })
  render(<RouterProvider router={router} />)
  return router
}

test('« Trouver sur la carte » garde la fiche ouverte et centre la carte sur le lieu', async () => {
  const router = dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Trouver sur la carte/ }))
  expect(router.state.location.pathname).toBe('/carte/lieu/a')
  expect(router.state.location.search).toBe('?centre=45.9,6.1')
})

test('« Copier le lien » copie l’adresse de la fiche et le dit', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Copier le lien/ }))
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}${import.meta.env.BASE_URL}carte/lieu/a`,
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
    url: `${window.location.origin}${import.meta.env.BASE_URL}carte/lieu/a`,
  })
})

test('sans partage natif, « Partager ailleurs… » n’apparaît pas', () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Partager ailleurs/ })).toBeNull()
})
