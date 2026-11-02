/**
 * QUOI     — la fiche d'un Fragment (maquettes C et D, 02/11) : ce que chacun voit, et ce que seul
 *            le Porteur ouvre.
 * POURQUOI — spec du Codex : la préhistoire et le mot de l'artiste pour tous ; l'histoire entière,
 *            le skin et le numéro de Porteur pour qui le porte ; un bloc vide ne s'affiche pas.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import type { Recit } from '../api/lireRecit'
import type { MonFragment } from '../api/lireMonFragment'
import type { Tirage } from '../api/lireTirage'
import { FicheFragment } from './FicheFragment'

const etat = vi.hoisted(() => ({
  recit: undefined as Recit | null | undefined,
  moi: undefined as MonFragment | null | undefined,
}))
vi.mock('../hooks/useRecit', () => ({
  useRecit: () => ({ recit: etat.recit, erreur: false, reessayer: vi.fn() }),
}))
vi.mock('../hooks/useMonFragment', () => ({
  useMonFragment: () => ({ moi: etat.moi, erreur: false }),
}))
const anecdotes = vi.hoisted(() => ({ tirage: null as Tirage | null }))
vi.mock('../hooks/useAnecdotes', () => ({
  useAnecdotes: () => ({
    tirage: anecdotes.tirage,
    creuser: vi.fn(),
    enCours: false,
    plusDEnergie: false,
  }),
}))

const hoplite: Recit = {
  id: 11,
  nom: 'Hoplite',
  heritage: "D'ombre et d'airain",
  illustration: null,
  resume: 'Au Ve siècle av. J.-C., l’hoplite fait la force des cités grecques.',
  histoire: null,
  audio: null,
  narrateur: null,
  origine: null,
  boutique: 'https://runesdechene.com/collections/hoplite',
  artiste: 'Uriel',
  artistePhoto: 'https://x/u.jpg',
  motArtiste: 'Le bouclier m’a pris deux soirées.',
  edition: null,
  editionPrecision: null,
}

function afficher(
  recit: Recit,
  moi: MonFragment,
  equiper = vi.fn(() => Promise.resolve()),
  scan: number | null = null,
) {
  etat.recit = recit
  etat.moi = moi
  render(
    <MemoryRouter initialEntries={['/codex/fragment/11']}>
      <Routes>
        <Route
          path="/codex/fragment/:id"
          element={<FicheFragment id={11} connecte equiper={equiper} scan={scan} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  return equiper
}

const vide = { anecdotes: [], restantes: 3, raresRestantes: 1 }
const porte: MonFragment = {
  etat: 'porte',
  scans: 0,
  numero: 37,
  porteurs: 112,
  signe: false,
  ...vide,
}
const scanne: MonFragment = {
  etat: 'scanne',
  scans: 5,
  numero: null,
  porteurs: 112,
  signe: false,
  ...vide,
}

test('porté : le numéro et son rang, l’histoire entière, le skin à équiper', async () => {
  const equiper = afficher(hoplite, porte)
  // Sous le nom et dans les cadeaux, comme la maquette D.
  expect(screen.getAllByText('Porteur n° 37')).toHaveLength(2)
  expect(screen.getAllByRole('img', { name: 'Peu commune' }).length).toBeGreaterThan(0)
  expect(
    screen.getByRole('link', { name: /Lire toute son histoire, ou l’écouter/ }),
  ).toHaveAttribute('href', '/codex/fragment/11/histoire')
  await userEvent.click(screen.getByRole('button', { name: 'Équiper' }))
  expect(equiper).toHaveBeenCalledWith(11)
})

test('scanné : la suite réservée, ce qu’on gagne en le portant, l’achat', () => {
  afficher(hoplite, scanne)
  expect(screen.getByText('Scanné 5 fois')).toBeInTheDocument()
  expect(
    screen.getByText('La suite, en entier et racontée, est réservée à ceux qui le portent.'),
  ).toBeInTheDocument()
  expect(screen.getByText('En le portant, tu gagnes')).toBeInTheDocument()
  expect(screen.getByText('Tu serais le 113ᵉ Porteur de Hoplite')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Acquérir ce Fragment' })).toHaveAttribute(
    'href',
    'https://runesdechene.com/collections/hoplite',
  )
  expect(screen.queryByRole('button', { name: 'Équiper' })).toBeNull()
})

test('pour tous : la préhistoire et le mot de l’artiste, signé', () => {
  afficher(hoplite, scanne)
  expect(screen.getByText(/l’hoplite fait la force des cités grecques/)).toBeInTheDocument()
  expect(screen.getByText('Le bouclier m’a pris deux soirées.')).toBeInTheDocument()
  expect(screen.getByText('Uriel, l’artiste')).toBeInTheDocument()
  expect(screen.getByText('Dessiné par Uriel')).toBeInTheDocument()
})

test('sans mot de l’artiste ni photo : pas de bloc, pas d’avatar', () => {
  afficher({ ...hoplite, motArtiste: null, artistePhoto: null }, scanne)
  expect(screen.queryByText('Le mot de l’artiste')).toBeNull()
  expect(document.querySelector('img[data-avatar]')).toBeNull()
})

test('un mot long se coupe, « Lire la suite » le déplie', async () => {
  afficher(
    { ...hoplite, motArtiste: 'Un long mot.\n\nUn deuxième paragraphe.\n\nUn troisième.' },
    scanne,
  )
  const suite = screen.getByRole('button', { name: 'Lire la suite' })
  expect(suite).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(suite)
  expect(screen.getByRole('button', { name: 'Replier' })).toHaveAttribute('aria-expanded', 'true')
})

test('depuis le Codex : « Scanner ce motif », jamais « Creuser encore »', () => {
  anecdotes.tirage = null
  afficher(hoplite, scanne)
  expect(screen.getByRole('link', { name: /Scanner ce motif/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Creuser encore/ })).toBeNull()
})

test('après un scan : la nouvelle anecdote et « Creuser encore »', () => {
  anecdotes.tirage = {
    anecdote: { texte: 'La panoplie pesait vingt kilos.', rarete: 'commune' },
    raison: 'gratuite',
    restantes: 2,
    raresRestantes: 1,
    premiereDecouverte: false,
  }
  afficher(hoplite, porte, undefined, 1700000000000)
  expect(screen.getByText('La panoplie pesait vingt kilos.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Creuser encore/ })).toBeInTheDocument()
})
