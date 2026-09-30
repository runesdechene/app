/**
 * QUOI     — le parcours d'entrée, de bout en bout : lire le Préambule, signer la Charte au doigt
 *            maintenu, recevoir un code, entrer, se nommer, être accueilli. Et le client déjà
 *            connu qui se connecte sans avoir signé : il signe, connecté, puis entre.
 * ATTENTION — jsdom n'anime pas : la fin du remplissage du cercle est simulée (`animationEnd`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { retenirLieu } from '@/shared/lib/apresEntree'
import { Onboarding } from './Onboarding'

const api = vi.hoisted(() => ({
  envoyerCode: vi.fn(),
  verifierCode: vi.fn(),
  reclamerFragments: vi.fn(),
  signerCharte: vi.fn(),
  nommer: vi.fn(),
  fetchEntree: vi.fn(),
}))
vi.mock('../api/entree', () => api)

beforeEach(() => {
  api.envoyerCode.mockResolvedValue(undefined)
  api.verifierCode.mockResolvedValue('u9')
  api.reclamerFragments.mockResolvedValue(2)
  api.signerCharte.mockResolvedValue(undefined)
  api.nommer.mockResolvedValue(undefined)
  api.fetchEntree.mockResolvedValue({ nom: null, numero: 4979, fragments: 2, charteSignee: true })
})

// On entre par la vitrine : « Commencer mon périple » mène au Préambule, « Se connecter » à l'e-mail.
function monter(depart: string) {
  const router = createMemoryRouter(
    [
      { path: '/bienvenue/:etape', element: <Onboarding /> },
      { path: '*', element: <p>la carte</p> },
    ],
    { initialEntries: [depart] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

async function signerLaCharte() {
  const cercle = await screen.findByRole('button', { name: /Signer la Charte/ })
  fireEvent.pointerDown(cercle)
  const remplissage = cercle.querySelector('circle:last-of-type')
  if (remplissage) fireEvent.animationEnd(remplissage)
}

test('du Préambule à la bienvenue', async () => {
  const router = monter('/bienvenue/preambule')
  await userEvent.click(await screen.findByRole('button', { name: /Suivant/ }))
  expect(await screen.findByRole('heading', { name: 'La Charte' })).toBeInTheDocument()
  await signerLaCharte()
  expect(router.state.location.pathname).toBe('/bienvenue/email')

  await userEvent.type(screen.getByLabelText('Ton e-mail'), 'claire@exemple.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
  expect(api.envoyerCode).toHaveBeenCalledWith('claire@exemple.fr')
  expect(await screen.findByText('claire@exemple.fr')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Ton code'), '481205')
  expect(api.verifierCode).toHaveBeenCalledWith('claire@exemple.fr', '481205')
  expect(await screen.findByRole('heading', { name: 'Comment on t’appelle ?' })).toBeInTheDocument()
  expect(api.signerCharte).toHaveBeenCalled()
  expect(screen.getByText('Deux Fragments t’attendent')).toBeInTheDocument()

  api.fetchEntree.mockResolvedValue({
    nom: 'Claire M.',
    numero: 4979,
    fragments: 2,
    charteSignee: true,
  })
  await userEvent.type(screen.getByLabelText('Ton nom'), 'Claire M.')
  await userEvent.click(screen.getByRole('button', { name: /Suivant/ }))
  expect(api.nommer).toHaveBeenCalledWith('Claire M.')
  expect(await screen.findByText('Claire M.')).toBeInTheDocument()
  expect(screen.getByText(/Explorateur n°/)).toHaveTextContent('Explorateur n° 4 979')
  expect(screen.getByRole('button', { name: 'Voir mes deux Fragments' })).toBeInTheDocument()
})

test('un client connu se connecte sans avoir signé : il signe, connecté, puis entre', async () => {
  api.fetchEntree.mockResolvedValue({ nom: 'Luna', numero: 812, fragments: 0, charteSignee: false })
  const router = monter('/bienvenue/email')
  await userEvent.type(await screen.findByLabelText('Ton e-mail'), 'luna@exemple.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
  await userEvent.type(await screen.findByLabelText('Ton code'), '123456')
  expect(await screen.findByRole('heading', { name: 'La Charte' })).toBeInTheDocument()
  expect(api.signerCharte).not.toHaveBeenCalled()

  api.fetchEntree.mockResolvedValue({ nom: 'Luna', numero: 812, fragments: 0, charteSignee: true })
  await signerLaCharte()
  expect(api.signerCharte).toHaveBeenCalled()
  await screen.findByText('Luna')
  expect(router.state.location.pathname).toBe('/bienvenue/fin')
})

test('un code refusé le dit', async () => {
  api.verifierCode.mockRejectedValue(new Error('Token has expired or is invalid'))
  monter('/bienvenue/email')
  await userEvent.type(await screen.findByLabelText('Ton e-mail'), 'luna@exemple.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
  await userEvent.type(await screen.findByLabelText('Ton code'), '000000')
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce code ne marche pas')
})

test('venu d’un lieu de la vitrine, « Ouvrir la carte » ouvre ce lieu', async () => {
  retenirLieu('d1')
  const router = monter('/bienvenue/fin')
  await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir la carte' }))
  expect(router.state.location.pathname).toBe('/carte/lieu/d1')
})
