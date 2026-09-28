/**
 * QUOI     — le Registre : les messages des canaux cochés, le préfixe du canal quand plusieurs
 *            sont cochés, et l'écriture dans le canal choisi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { Registre } from './Registre'

const api = vi.hoisted(() => ({
  fetchRegistre: vi.fn(),
  ecrire: vi.fn(),
  ecouterRegistre: vi.fn(() => () => undefined),
}))
vi.mock('../api/registre', () => api)

const URIEL = { id: 'u1', nom: 'Uriel', avatar: null }
const GAUTIER = { id: 'u2', nom: 'Gautier', avatar: null }

beforeEach(() => {
  api.fetchRegistre.mockResolvedValue([
    {
      id: 1,
      canal: 'general',
      texte: 'Il y a du monde ici bas ?',
      quand: '2026-09-28T07:12:00Z',
      auteur: URIEL,
      moi: true,
    },
    {
      id: 2,
      canal: 'bugs',
      texte: 'Je ne peux pas planter un lieu.',
      quand: '2026-09-28T07:15:00Z',
      auteur: GAUTIER,
      moi: false,
    },
  ])
  api.ecrire.mockResolvedValue(undefined)
})

function monter() {
  const router = createMemoryRouter([{ path: '*', element: <Registre /> }], {
    initialEntries: ['/messages'],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('chaque message, et le préfixe du canal des bugs', async () => {
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  expect(await within(registre).findByText(/Il y a du monde ici bas/)).toBeInTheDocument()
  const [, bug] = within(registre).getAllByRole('listitem')
  expect(bug).toHaveTextContent('Gautier [Bug & Suggestions] Je ne peux pas planter un lieu.')
})

test('décocher un canal retire ses messages ; le préfixe « Bug & Suggestions » reste', async () => {
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  await within(registre).findByText(/Il y a du monde ici bas/)
  await userEvent.click(screen.getByRole('button', { name: /Canal général/ }))
  expect(within(registre).queryByText(/Il y a du monde ici bas/)).toBeNull()
  expect(within(registre).getByRole('listitem')).toHaveTextContent('[Bug & Suggestions]')
})

test('on écrit dans le canal choisi ; le champ se vide', async () => {
  monter()
  await screen.findByRole('list', { name: 'Registre' })
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Canal' }), 'bugs')
  await userEvent.type(screen.getByRole('textbox', { name: 'Écrire quelque chose' }), '  Merci !  ')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrire).toHaveBeenCalledWith('bugs', 'Merci !')
  expect(screen.getByRole('textbox', { name: 'Écrire quelque chose' })).toHaveValue('')
})
