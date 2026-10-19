import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { FeuilleJySuisAlle } from './FeuilleJySuisAlle'

const souvenir_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useSouvenir', () => ({ useSouvenir: souvenir_ }))

const declarer = vi.fn(() => Promise.resolve({ motPerdu: false }))
const onFermer = vi.fn()

beforeEach(() => {
  declarer.mockClear()
  onFermer.mockClear()
  souvenir_.mockReturnValue({ declarer, enCours: false, erreur: null })
})

function afficher(genre: 'm' | 'f' = 'm') {
  render(<FeuilleJySuisAlle id="a" genre={genre} onFermer={onFermer} />)
}

test('le titre s’accorde au genre choisi', () => {
  afficher('f')
  expect(screen.getByRole('heading', { name: 'J’y suis allée' })).toBeInTheDocument()
})

test('sans mois, rien ne part ; avec un mois et une année, le souvenir est déclaré puis la feuille se ferme', async () => {
  afficher()
  const ajouter = screen.getByRole('button', { name: 'Ajouter à mon passeport' })
  expect(ajouter).toBeDisabled()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mois' }), '8')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Année' }), '2019')
  await userEvent.type(screen.getByRole('textbox'), '  Sous la pluie  ')
  await userEvent.click(ajouter)
  expect(declarer).toHaveBeenCalledWith({ annee: 2019, mois: 8, mot: 'Sous la pluie', photo: null })
  expect(onFermer).toHaveBeenCalled()
})

test('le mot n’est pas parti : le souvenir reste noté et on le dit', async () => {
  declarer.mockResolvedValueOnce({ motPerdu: true })
  afficher()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mois' }), '8')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Année' }), '2019')
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter à mon passeport' }))
  expect(screen.getByText(/Ton souvenir est dans ton passeport/)).toBeInTheDocument()
  expect(onFermer).not.toHaveBeenCalled()
})

test('un refus de la base s’écrit sous les champs', () => {
  souvenir_.mockReturnValue({
    declarer,
    enCours: false,
    erreur: 'Ce lieu est déjà dans ton passeport.',
  })
  afficher()
  expect(screen.getByRole('alert')).toHaveTextContent('Ce lieu est déjà dans ton passeport.')
})
