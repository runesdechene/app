import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Compagnon } from '../api/lireLieu'
import { FenetreRevendication } from './FenetreRevendication'

const revendication_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useRevendication', () => ({ useRevendication: revendication_ }))

const revendiquer = vi.fn(() => Promise.resolve())
const onFermer = vi.fn()

beforeEach(() => {
  revendiquer.mockClear()
  onFermer.mockClear()
})

function afficher({
  compagnons,
  noms,
  erreur = null,
}: {
  compagnons: Compagnon[]
  noms: string[]
  erreur?: string | null
}) {
  revendication_.mockReturnValue({ compagnons, noms, revendiquer, enCours: false, erreur })
  render(
    <FenetreRevendication fiche={{ id: 'a', nom: 'Château de Jonjeac' }} onFermer={onFermer} />,
  )
}

const REMY: Compagnon = { id: 'b', nom: 'Rémy', avatar: null, distance: 40 }

test('seul : « Revendiquer » n’envoie ni compagnon ni nom', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  expect(screen.getByText('Personne d’autre n’est ici en ce moment')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Seul' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(revendiquer).toHaveBeenCalledWith([], null)
})

test('en expédition : je coche un compagnon présent et je choisis un nom passé', async () => {
  afficher({ compagnons: [REMY], noms: ['Les Loups'] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  expect(screen.getByText('à 40 m')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: /Rémy/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Les Loups' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(revendiquer).toHaveBeenCalledWith(['b'], 'Les Loups')
})

test('en expédition sans nom : « Revendiquer » attend un nom', async () => {
  afficher({ compagnons: [REMY], noms: [] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  await userEvent.click(screen.getByRole('checkbox', { name: /Rémy/ }))
  expect(screen.getByRole('button', { name: 'Revendiquer' })).toBeDisabled()
})

test('« Passer cette étape » ferme sans revendiquer (la visite est déjà marquée)', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Passer cette étape' }))
  expect(onFermer).toHaveBeenCalled()
  expect(revendiquer).not.toHaveBeenCalled()
})

test('réussite : la fenêtre se ferme', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(onFermer).toHaveBeenCalled()
})

test('échec : le message est écrit, la fenêtre reste', async () => {
  revendiquer.mockRejectedValueOnce(new Error('Visite trop ancienne'))
  afficher({
    compagnons: [],
    noms: [],
    erreur: 'Ta visite date de plus de 30 minutes : marque-la à nouveau sur place.',
  })
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Ta visite date de plus de 30 minutes')
  expect(onFermer).not.toHaveBeenCalled()
})

test('un compagnon coché qui s’en va ne bloque pas la revendication', async () => {
  revendication_.mockReturnValue({
    compagnons: [REMY],
    noms: [],
    revendiquer,
    enCours: false,
    erreur: null,
  })
  const fiche = { id: 'a', nom: 'Château de Jonjeac' }
  const { rerender } = render(<FenetreRevendication fiche={fiche} onFermer={onFermer} />)
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  await userEvent.click(screen.getByRole('checkbox', { name: /Rémy/ }))
  // La relecture suivante ne le voit plus : il est parti.
  revendication_.mockReturnValue({
    compagnons: [],
    noms: [],
    revendiquer,
    enCours: false,
    erreur: null,
  })
  rerender(<FenetreRevendication fiche={fiche} onFermer={onFermer} />)
  const bouton = screen.getByRole('button', { name: 'Revendiquer' })
  expect(bouton).toBeEnabled()
  await userEvent.click(bouton)
  expect(revendiquer).toHaveBeenCalledWith([], null)
})
