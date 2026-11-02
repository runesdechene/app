/**
 * QUOI     — le titre que gagne le Porteur d'un Fragment, écrit au Hub.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TitreDuFragment } from './TitreDuFragment'

const api = vi.hoisted(() => ({ lireTitreDuFragment: vi.fn(), ecrireTitreDuFragment: vi.fn() }))
vi.mock('../api/collections', () => api)

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TitreDuFragment fragment={11} />
    </QueryClientProvider>,
  )
}

test('le titre en place se lit, et s’écrit', async () => {
  api.lireTitreDuFragment.mockResolvedValue('Fils de Sparte')
  api.ecrireTitreDuFragment.mockResolvedValue(undefined)
  afficher()
  const champ = await screen.findByDisplayValue('Fils de Sparte')
  await userEvent.clear(champ)
  await userEvent.type(champ, 'Fille de Sparte')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le titre' }))
  expect(api.ecrireTitreDuFragment).toHaveBeenCalledWith(11, 'Fille de Sparte')
  expect(await screen.findByRole('status')).toHaveTextContent('Enregistré.')
})
