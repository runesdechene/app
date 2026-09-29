/**
 * QUOI     — « Modifier la fiche » : les champs partent de la fiche ; enregistrer envoie la fiche
 *            changée et la note, puis revient ; des photos s'ajoutent ; la route sait s'il y a
 *            quelque chose à perdre ; un refus se dit en clair.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ModifierFiche } from './ModifierFiche'

const api = vi.hoisted(() => ({
  fetchNatures: vi.fn(),
  fetchEpoques: vi.fn(),
  fetchFicheAModifier: vi.fn(),
  modifierLieu: vi.fn(),
  ajouterPhotosLieu: vi.fn<(id: string, photos: { grande: Blob }[]) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}))
vi.mock('../api/ajout', () => api)
vi.mock('@/shared/lib/photo', () => ({
  preparerPhoto: () => Promise.resolve({ grande: new Blob(['g']), vignette: new Blob(['v']) }),
}))

const fini = vi.fn()
const modifie = vi.fn()

beforeEach(() => {
  fini.mockReset()
  modifie.mockReset()
  api.ajouterPhotosLieu.mockClear()
  api.modifierLieu.mockReset()
  api.fetchNatures.mockResolvedValue([
    { id: 'chateau', nom: 'Châteaux & fortins', icone: 'c.svg', couleur: '#a9260f' },
  ])
  api.fetchEpoques.mockResolvedValue([{ id: 'late-middle-ages', nom: 'Bas Moyen Âge' }])
  api.fetchFicheAModifier.mockResolvedValue({
    nom: 'Chateau de Jonjeac',
    natures: ['chateau'],
    epoque: null,
    annee: null,
    recit: 'Une tour carrée.',
    photos: [{ url: 'u1', vignette: 'v1' }],
  })
})

function monter() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ModifierFiche id="a" onFini={fini} onModifie={modifie} />
    </QueryClientProvider>,
  )
}

test('les champs partent de la fiche ; enregistrer envoie les changements et revient', async () => {
  api.modifierLieu.mockResolvedValue(undefined)
  monter()
  const champ = await screen.findByRole('textbox', { name: 'Son nom' })
  expect(champ).toHaveValue('Chateau de Jonjeac')
  await userEvent.clear(champ)
  await userEvent.type(champ, 'Château de Jonjeac')
  await userEvent.click(screen.getByRole('button', { name: 'Bas Moyen Âge' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Ce que tu as changé' }), 'accent')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les changements' }))
  expect(api.modifierLieu).toHaveBeenCalledWith(
    'a',
    expect.objectContaining({ nom: 'Château de Jonjeac', epoque: 'late-middle-ages' }),
    'accent',
  )
  expect(fini).toHaveBeenCalled()
  expect(modifie).toHaveBeenCalledWith(true)
})

test('un refus de la base se dit en clair, et on reste', async () => {
  api.modifierLieu.mockRejectedValue({ message: 'Découvre', hint: 'decouvrir' })
  monter()
  await userEvent.type(await screen.findByRole('textbox', { name: 'Son nom' }), ' !')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les changements' }))
  expect(await screen.findByText(/Découvre ce lieu sur la carte/)).toBeInTheDocument()
  expect(fini).not.toHaveBeenCalled()
})

test('des photos s’ajoutent : rattachées au lieu, sans nouvelle version', async () => {
  monter()
  const choisir = await screen.findByLabelText(/Ajouter des photos/)
  await userEvent.upload(choisir, new File(['x'], 'tour.jpg', { type: 'image/jpeg' }))
  expect(await screen.findByRole('button', { name: 'Retirer cette photo' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les changements' }))
  const [lieu, photos] = api.ajouterPhotosLieu.mock.lastCall ?? []
  expect(lieu).toBe('a')
  expect(photos?.map((p) => p.grande instanceof Blob)).toEqual([true])
  expect(api.modifierLieu).not.toHaveBeenCalled()
  expect(fini).toHaveBeenCalled()
})

test('rien de touché : le bouton attend', async () => {
  monter()
  expect(await screen.findByRole('button', { name: 'Enregistrer les changements' })).toBeDisabled()
  expect(modifie).not.toHaveBeenCalledWith(true)
})
