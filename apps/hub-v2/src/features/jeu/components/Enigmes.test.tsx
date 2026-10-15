import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Enigmes } from './Enigmes'
import { TiroirEnigme } from './TiroirEnigme'

const mockUseEnigmes = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useEnigmes', () => ({
  useEnigmes: mockUseEnigmes,
  useNomsDeCultures: () => ({ data: [{ id: 'nordique', label: 'Nordique', active: true }, { id: 'grec', label: 'Grecque', active: true }] }),
  useEnigme: () => ({ data: null, isPending: false }),
  useEcritureEnigme: vi.fn(),
}))

const liste = {
  total: 2,
  compteurs: { toutes: 120, actives: 100, parCulture: { nordique: 30, grec: 50 } },
  lignes: [
    { id: 7, question: 'En {52 av. J.-C.}, qui ?', culture: 'nordique', difficulte: 'easy', format: 'qcm', active: true, reponse: 'Thor', cree_le: '2026-10-01T00:00:00Z' },
    { id: 8, question: 'Quel dieu ?', culture: null, difficulte: 'hard', format: 'free', active: false, reponse: 'Odin', cree_le: '2026-10-02T00:00:00Z' },
  ],
}

function monter(adresse = '/jeu/enigmes') {
  const router = createMemoryRouter(
    [{ path: '/jeu/enigmes', Component: Enigmes, children: [{ path: 'nouvelle', Component: TiroirEnigme }, { path: ':id', Component: TiroirEnigme }] }],
    { initialEntries: [adresse] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('les lignes : numéro, question en clair, culture, difficulté, état ; le lien garde la recherche', () => {
  mockUseEnigmes.mockReturnValue({ data: liste, isError: false })
  monter('/jeu/enigmes?q=qui')
  expect(screen.getByText('100 énigmes actives sur 120.')).toBeInTheDocument()
  const ligne = screen.getByRole('link', { name: /En 52 av\. J\.-C\., qui \?/ })
  expect(ligne).toHaveAttribute('href', '/jeu/enigmes/7?q=qui')
  expect(ligne).toHaveTextContent('n° 7')
  expect(ligne).toHaveTextContent('Nordique')
  expect(screen.getByRole('link', { name: /Quel dieu/ })).toHaveTextContent('Universelle')
  expect(screen.getByText('Inactive', { selector: '[data-teinte]' })).toBeInTheDocument()
})

test('les deux cultures les plus fournies ont leur tuile', () => {
  mockUseEnigmes.mockReturnValue({ data: liste, isError: false })
  monter()
  expect(screen.getByText('Grecque', { selector: 'span' })).toBeInTheDocument()
  expect(screen.getByText('50')).toBeInTheDocument()
})

test('un filtre va dans l’adresse et lit ses critères', async () => {
  mockUseEnigmes.mockReturnValue({ data: liste, isError: false })
  const router = monter()
  await userEvent.click(screen.getByRole('radio', { name: 'Actives' }))
  expect(router.state.location.search).toBe('?etat=actives')
  expect(mockUseEnigmes).toHaveBeenLastCalledWith(expect.objectContaining({ actives: 'actives', limite: 50, decalage: 0 }))
})

test('« + Nouvelle énigme » garde la recherche', () => {
  mockUseEnigmes.mockReturnValue({ data: liste, isError: false })
  monter('/jeu/enigmes?q=qui')
  expect(screen.getByRole('link', { name: '+ Nouvelle énigme' })).toHaveAttribute('href', '/jeu/enigmes/nouvelle?q=qui')
})

test('une page au-delà de la dernière : l’adresse revient à la dernière page', () => {
  mockUseEnigmes.mockReturnValue({ data: { ...liste, total: 120 }, isError: false })
  const router = monter('/jeu/enigmes?q=x&page=9')
  expect(router.state.location.search).toBe('?q=x&page=3')
})
