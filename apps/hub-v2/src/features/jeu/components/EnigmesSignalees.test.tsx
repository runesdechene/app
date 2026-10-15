import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { EnigmesSignalees } from './EnigmesSignalees'

const api = vi.hoisted(() => ({ lireSignalementsEnigme: vi.fn(), traiterSignalementEnigme: vi.fn() }))
vi.mock('../api/signalementsEnigme', () => api)

const libre = {
  id: 7, raison: 'reponse_refusee', precision: 'Eudes suffit.', reponseDonnee: 'Eudes', reponseProposee: null,
  quand: '2026-10-14T09:40:00Z',
  enigme: { numero: 12, question: 'Qui fut {roi} en 888 ?', reponse: 'Eudes de Paris', variantes: ['Odon'], format: 'free' as const },
  qui: { id: 'u5', nom: 'Brune' },
}
const qcm = { ...libre, id: 8, enigme: { ...libre.enigme, numero: 13, format: 'qcm' as const }, qui: { id: 'u6', nom: 'Gaspard' } }

function monter(adresse = '/jeu/enigmes-signalees') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/jeu/enigmes-signalees', Component: EnigmesSignalees }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return client
}

test('la file, le premier choisi : question en clair, réponse attendue, sa réponse, la raison lisible', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([libre])
  monter()
  expect(await screen.findByText('Réponse attendue : Eudes de Paris')).toBeInTheDocument()
  expect(screen.getAllByText('Qui fut roi en 888 ?')).not.toHaveLength(0)
  expect(screen.getByText('Sa réponse : Eudes')).toBeInTheDocument()
  expect(screen.getAllByText('Sa réponse aurait dû être acceptée')).not.toHaveLength(0)
  expect(screen.getByText('« Eudes suffit. »')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Modifier l’énigme' })).toHaveAttribute('href', '/jeu/enigmes/12')
})

test('« Accepter » est absent pour un QCM', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([qcm])
  monter()
  expect(await screen.findByRole('button', { name: 'Clore sans suite' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accepter sa réponse' })).not.toBeInTheDocument()
})

test('sans réponse donnée : on le dit, et pas d’« Accepter »', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([{ ...libre, reponseDonnee: null }])
  monter()
  expect(await screen.findByText('N’a pas encore répondu')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accepter sa réponse' })).not.toBeInTheDocument()
})

test('« Accepter » appelle la base, montre les points rendus et rafraîchit', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([libre])
  api.traiterSignalementEnigme.mockResolvedValue({ ok: true, rendus: 2 })
  const client = monter()
  const invalider = vi.spyOn(client, 'invalidateQueries')
  await userEvent.click(await screen.findByRole('button', { name: 'Accepter sa réponse' }))
  expect(api.traiterSignalementEnigme).toHaveBeenCalledWith(7, true)
  expect(await screen.findByText('Réponse acceptée, 2 points rendus.')).toBeInTheDocument()
  for (const cle of ['hub-signalements-enigme', 'hub-ouverture', 'hub-enigme', 'hub-enigmes']) {
    expect(invalider).toHaveBeenCalledWith({ queryKey: [cle] })
  }
})

test('« Clore sans suite » refuse d’accepter', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([libre])
  api.traiterSignalementEnigme.mockResolvedValue({ ok: true, rendus: 0 })
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Clore sans suite' }))
  expect(api.traiterSignalementEnigme).toHaveBeenCalledWith(7, false)
})

test('une erreur de la base s’affiche', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([libre])
  api.traiterSignalementEnigme.mockRejectedValue(new Error('Introuvable'))
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Clore sans suite' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Introuvable')
})

test('la sélection est dans l’adresse', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([libre, qcm])
  monter('/jeu/enigmes-signalees?s=8')
  expect(await screen.findByRole('button', { name: 'Clore sans suite' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accepter sa réponse' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Brune/ }))
  expect(await screen.findByRole('button', { name: 'Accepter sa réponse' })).toBeInTheDocument()
})

test('file vide : on le dit', async () => {
  api.lireSignalementsEnigme.mockResolvedValue([])
  monter()
  expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
})
