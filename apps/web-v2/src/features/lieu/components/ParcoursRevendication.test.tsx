import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheLieu, Recompense } from '../api/lireLieu'
import { ParcoursRevendication } from './ParcoursRevendication'

const fiche_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useFiche', () => ({ useFiche: fiche_ }))
// Les deux écrans suivants ont leurs propres tests : ici, on ne suit que l'enchaînement.
vi.mock('./PlanteTonEtendard', () => ({
  PlanteTonEtendard: ({ onConquis }: { onConquis: (c: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        onConquis({ nom: 'La Garde du Comté', prisA: null, rang: 1 })
      }}
    >
      planter
    </button>
  ),
}))

const VISITE: Recompense = { rang: 18, gain: 3, niveau: 12, avant: 0.6, apres: 0.64 }
const onFermer = vi.fn()
const onVoirLeLieu = vi.fn()

beforeEach(() => {
  onFermer.mockClear()
  onVoirLeLieu.mockClear()
})

function afficher(fiche: Partial<FicheLieu> = {}, recompense: Recompense = VISITE) {
  fiche_.mockReturnValue({
    fiche: {
      id: 'a',
      nom: 'Château de Coaraze',
      nature: 'lieu',
      photos: [],
      type: { nom: 'Château et fortins', icone: null, couleur: null },
      revendication: null,
      ...fiche,
    },
  })
  render(
    <ParcoursRevendication
      id="a"
      recompense={recompense}
      monNom="Uriel"
      onFermer={onFermer}
      onVoirLeLieu={onVoirLeLieu}
    />,
  )
}

test('la fête de la visite : le rang, et « Revendiquer ce lieu »', () => {
  afficher()
  expect(screen.getByText('Ton 18ᵉ lieu visité !')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revendiquer ce lieu' })).toBeInTheDocument()
})

test('le premier lieu visité', () => {
  afficher({}, { ...VISITE, rang: 1 })
  expect(screen.getByText('Ton 1ᵉʳ lieu visité !')).toBeInTheDocument()
})

test('une revisite ne rapporte rien : elle le dit autrement', () => {
  afficher({}, { ...VISITE, gain: 0 })
  expect(screen.getByText('Te revoilà !')).toBeInTheDocument()
})

test('une curiosité, ou un lieu que je tiens : pas de revendication', () => {
  afficher({ nature: 'curiosite' })
  expect(screen.queryByRole('button', { name: 'Revendiquer ce lieu' })).not.toBeInTheDocument()
})

test('un lieu que je tiens déjà : pas de revendication', () => {
  afficher({
    revendication: { nom: 'Uriel', moi: true, depuis: '2026-10-01', pourCompagnie: null },
  })
  expect(screen.queryByRole('button', { name: 'Revendiquer ce lieu' })).not.toBeInTheDocument()
})

test('revendiquer, planter, et c’est « CONQUIS ! »', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer ce lieu' }))
  await userEvent.click(screen.getByRole('button', { name: 'planter' }))
  expect(screen.getByRole('heading', { name: 'CONQUIS !' })).toBeInTheDocument()
})

test('« Revenir à la carte » ferme le parcours', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Revenir à la carte' }))
  expect(onFermer).toHaveBeenCalledOnce()
})

test('une fiche qui ne se charge pas ferme le parcours (jamais de calque vide)', () => {
  fiche_.mockReturnValue({ fiche: undefined, erreur: true, reessayer: vi.fn() })
  render(
    <ParcoursRevendication
      id="a"
      recompense={VISITE}
      monNom="Uriel"
      onFermer={onFermer}
      onVoirLeLieu={onVoirLeLieu}
    />,
  )
  expect(onFermer).toHaveBeenCalledOnce()
})
