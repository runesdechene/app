/**
 * QUOI     — la page « Nouveautés » : la dernière en entier, les précédentes dessous ; sous chaque
 *            note, ses cœurs et son carnet (mig 478) — ouverts sous la dernière, repliés sous les
 *            précédentes, qui ne chargent rien avant qu'on les ouvre.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { Nouveautes } from './Nouveautes'

const api = vi.hoisted(() => ({
  fetchMisesAJour: vi.fn(),
  fetchCarnetDeMiseAJour: vi.fn(),
  ecrireSousMiseAJour: vi.fn(),
  basculerCoeurMotDeMiseAJour: vi.fn(),
  effacerMotDeMiseAJour: vi.fn(),
  fetchCoeursDeMiseAJour: vi.fn(),
  aimerMiseAJour: vi.fn(),
}))
vi.mock('../api/nouveautes', () => api)

const kelpie = { id: 'k', nom: 'Kelpie', avatar: null }

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchCarnetDeMiseAJour.mockResolvedValue({
    total: 1,
    mots: [
      {
        id: 9,
        quand: '2026-10-11T10:00:00Z',
        texte: 'Génial, la frise !',
        qui: kelpie,
        venu: false,
        photos: [],
        coeurs: 2,
        miens: 0,
        aMoi: false,
        reponses: [],
      },
    ],
  })
  api.fetchCoeursDeMiseAJour.mockResolvedValue({ total: 12, miens: 0, gens: [{ ...kelpie, nombre: 12 }] })
  api.ecrireSousMiseAJour.mockResolvedValue(undefined)
  api.basculerCoeurMotDeMiseAJour.mockResolvedValue(undefined)
  api.aimerMiseAJour.mockResolvedValue(undefined)
  api.fetchMisesAJour.mockResolvedValue([
    {
      id: 2,
      titre: 'Filtrer la carte',
      texte: 'Un seul bouton.\n\n- Par nature : plusieurs à la fois.',
      quand: '2026-09-30T10:00:00Z',
      image: 'https://exemple.test/filtres.webp',
      version: 'Pythéas 1.0.12',
      coeurs: 12,
      miens: 0,
      mots: 1,
      aMoi: false,
    },
    {
      id: 1,
      titre: 'Ajouter à distance',
      texte: 'Plus besoin d’y être.',
      quand: '2026-09-28T10:00:00Z',
      image: null,
      version: null,
      coeurs: 4,
      miens: 0,
      mots: 3,
      aMoi: false,
    },
  ])
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Nouveautes />
    </QueryClientProvider>,
  )
}

test('la dernière en entier, sa liste mise en forme ; les précédentes dessous', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: 'Filtrer la carte' })).toBeInTheDocument()
  expect(screen.getByText('30 septembre')).toBeInTheDocument()
  expect(screen.getByText(/· Pythéas 1\.0\.12/)).toBeInTheDocument()
  expect(document.querySelector('img')).toHaveAttribute('src', 'https://exemple.test/filtres.webp')
  expect(screen.getByText('Un seul bouton.')).toBeInTheDocument()
  expect(screen.getByText('Par nature').tagName).toBe('STRONG')
  const precedentes = screen.getByRole('region', { name: 'Précédentes' })
  expect(
    within(precedentes).getByRole('heading', { name: 'Ajouter à distance' }),
  ).toBeInTheDocument()
  expect(precedentes.querySelector('img')).toBeNull()
})

test('aucune mise à jour : on le dit', async () => {
  api.fetchMisesAJour.mockResolvedValue([])
  afficher()
  expect(await screen.findByText('Pas encore de nouveautés')).toBeInTheDocument()
})

test('sous la dernière : ses cœurs à volonté et son carnet, ouverts', async () => {
  afficher()
  const coeur = await screen.findByRole('button', { name: 'Envoyer un cœur (12)' })
  await userEvent.click(coeur)
  await waitFor(() => {
    expect(api.aimerMiseAJour).toHaveBeenCalledWith(2)
  })
  const carnet = screen.getByRole('region', { name: 'Commentaires' })
  expect(await within(carnet).findByText('Génial, la frise !')).toBeInTheDocument()
  await userEvent.click(within(carnet).getByRole('button', { name: 'J’aime ce mot (2)' }))
  await waitFor(() => {
    expect(api.basculerCoeurMotDeMiseAJour.mock.calls[0]?.[0]).toBe(9)
  })
  await userEvent.type(within(carnet).getByRole('textbox', { name: 'Dis ce que tu en penses…' }), 'Bravo')
  await userEvent.click(within(carnet).getByRole('button', { name: 'Envoyer' }))
  await waitFor(() => {
    expect(api.ecrireSousMiseAJour).toHaveBeenCalledWith(2, 'Bravo', [], null)
  })
})

test('une précédente : ses comptes, et son carnet ne se charge qu’ouvert', async () => {
  afficher()
  const precedentes = await screen.findByRole('region', { name: 'Précédentes' })
  expect(within(precedentes).getByText('3 mots')).toBeInTheDocument()
  await screen.findByRole('region', { name: 'Commentaires' })
  expect(api.fetchCarnetDeMiseAJour).not.toHaveBeenCalledWith(1)
  await userEvent.click(within(precedentes).getByRole('button', { name: 'Lire les commentaires' }))
  await waitFor(() => {
    expect(api.fetchCarnetDeMiseAJour).toHaveBeenCalledWith(1)
  })
  expect(within(precedentes).getByRole('region', { name: 'Commentaires' })).toBeInTheDocument()
})

test('sa propre note : on lit ses cœurs sans s’en envoyer', async () => {
  api.fetchMisesAJour.mockResolvedValue([
    { id: 5, titre: 'Ma note', texte: 'Texte.', quand: '2026-10-11T10:00:00Z', image: null, version: null, coeurs: 12, miens: 0, mots: 0, aMoi: true },
  ])
  afficher()
  expect(await screen.findByRole('button', { name: 'Voir les cœurs (12)' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Envoyer un cœur/ })).not.toBeInTheDocument()
})

test('l’équipe efface le mot d’un autre (mig 479)', async () => {
  api.effacerMotDeMiseAJour.mockResolvedValue(undefined)
  api.fetchCarnetDeMiseAJour.mockResolvedValue({
    total: 1,
    mots: [
      { id: 9, quand: '2026-10-11T10:00:00Z', texte: 'Un mot déplacé.', qui: kelpie, venu: false, photos: [], coeurs: 0, miens: 0, aMoi: false, peutEffacer: true, reponses: [] },
    ],
  })
  afficher()
  const carnet = await screen.findByRole('region', { name: 'Commentaires' })
  await within(carnet).findByText('Un mot déplacé.')
  await userEvent.click(within(carnet).getByRole('button', { name: 'Effacer' }))
  await userEvent.click(within(carnet).getByRole('button', { name: 'Effacer ce mot' }))
  await waitFor(() => {
    expect(api.effacerMotDeMiseAJour.mock.calls[0]?.[0]).toBe(9)
  })
})
