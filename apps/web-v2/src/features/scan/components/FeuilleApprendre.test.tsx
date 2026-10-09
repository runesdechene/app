/**
 * QUOI     — la feuille des admins : le Fragment suggéré, ajouter la vue du viseur, retirer la dernière.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const ajouterVue = vi.hoisted(() => vi.fn(() => Promise.resolve(99)))
const retirerEmpreinte = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('../api/scan', () => ({ ajouterVue, retirerEmpreinte }))
vi.mock('../hooks/useEmpreintes', () => ({
  useFragmentsVisibles: () => [
    { id: 11, nom: 'Hoplite', illustration: null },
    { id: 12, nom: 'Loutre', illustration: null },
  ],
  useEmpreintes: () => ({
    fragments: [
      {
        id: 11,
        nom: 'Hoplite',
        illustration: null,
        empreintes: [
          { id: 5, source: 'illustration', vecteur: [] },
          { id: 7, source: 'vue', vecteur: [] },
          { id: 9, source: 'vue', vecteur: [] },
        ],
      },
    ],
    erreur: false,
  }),
}))

import { FeuilleApprendre } from './FeuilleApprendre'

function ouvrir(suggestion: number | null, vue: number[] | null = [0.1]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FeuilleApprendre suggestion={suggestion} empreinteActuelle={() => vue} />
    </QueryClientProvider>,
  )
}

test('le Fragment que le modèle croit voir est choisi d’office, avec son nombre de vues', () => {
  ouvrir(11)
  expect(screen.getByRole('combobox')).toHaveValue('11')
  expect(screen.getByText(/2 vues apprises/)).toBeInTheDocument()
})

test('ajouter cette vue envoie l’empreinte du viseur pour le Fragment choisi', async () => {
  ouvrir(11)
  await userEvent.selectOptions(screen.getByRole('combobox'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter cette vue' }))
  await waitFor(() => {
    expect(ajouterVue).toHaveBeenCalledWith(12, [0.1])
  })
})

test('retirer la dernière retire la vue la plus récente du Fragment', async () => {
  ouvrir(11)
  await userEvent.click(screen.getByRole('button', { name: 'Retirer la dernière' }))
  await waitFor(() => {
    expect(retirerEmpreinte).toHaveBeenCalledWith(9)
  })
})

test('sans image du viseur encore, on ne peut rien ajouter', () => {
  ouvrir(11, null)
  expect(screen.getByRole('button', { name: 'Ajouter cette vue' })).toBeDisabled()
})
