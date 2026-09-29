/**
 * QUOI     — « Modifier la fiche » : les champs partent de la fiche ; enregistrer envoie la fiche
 *            changée et la note, puis revient ; un refus se dit en clair.
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
}))
vi.mock('../api/ajout', () => api)

const fini = vi.fn()

beforeEach(() => {
  fini.mockReset()
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
    photo: null,
  })
})

function monter() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ModifierFiche id="a" onFini={fini} />
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
})

test('rien n’a changé : on le dit, on reste', async () => {
  api.modifierLieu.mockRejectedValue({ message: 'Rien', hint: 'rien' })
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer les changements' }))
  expect(await screen.findByText(/Rien n’a changé/)).toBeInTheDocument()
  expect(fini).not.toHaveBeenCalled()
})
