/**
 * QUOI     — tes données : les télécharger en un fichier ; supprimer ton compte, seulement après
 *            avoir écrit « SUPPRIMER », puis retour à la vitrine.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MesDonnees } from './MesDonnees'

const api = vi.hoisted(() => ({
  telechargerMesDonnees: vi.fn(() => Promise.resolve({ compte: { first_name: 'Uriel' } })),
  supprimerMonCompte: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/mesDonnees', () => api)

const allerA = vi.fn()
const creerLien = vi.fn(() => 'blob:mes-donnees')

beforeEach(() => {
  URL.createObjectURL = creerLien
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('location', { assign: allerA })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <MesDonnees />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('télécharger ses données donne un fichier JSON', async () => {
  monter()
  await userEvent.click(screen.getByRole('button', { name: /Télécharger mes données/ }))
  await waitFor(() => {
    expect(api.telechargerMesDonnees).toHaveBeenCalled()
  })
  expect(creerLien).toHaveBeenCalled()
})

test('supprimer son compte demande d’écrire SUPPRIMER, puis ramène à la vitrine', async () => {
  monter()
  await userEvent.click(screen.getByRole('button', { name: /Supprimer mon compte/ }))
  const confirmer = screen.getByRole('button', { name: 'Supprimer définitivement' })
  expect(confirmer).toBeDisabled()
  await userEvent.type(screen.getByLabelText(/Écris SUPPRIMER/), 'SUPPRIMER')
  expect(confirmer).toBeEnabled()
  await userEvent.click(confirmer)
  await waitFor(() => {
    expect(api.supprimerMonCompte).toHaveBeenCalled()
  })
  expect(allerA).toHaveBeenCalledWith('/bienvenue')
})
