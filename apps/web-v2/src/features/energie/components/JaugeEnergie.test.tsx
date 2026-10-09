/**
 * QUOI     — la jauge d'énergie de la carte : ses points, son maximum, le prochain point ; la
 *            toucher explique la règle.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { JaugeEnergie } from './JaugeEnergie'

const api = vi.hoisted(() => ({ fetchEnergie: vi.fn() }))
vi.mock('../api/energie', () => api)

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JaugeEnergie />
    </QueryClientProvider>,
  )
}

test('en recharge : les points, le maximum, le prochain point', async () => {
  api.fetchEnergie.mockResolvedValue({
    points: 7,
    max: 10,
    prochainDans: 1380,
    parPoint: 1800,
    regle: {
      gratuitKm: 80,
      palier1Km: 150,
      palier2Km: 400,
      palier3Km: 1200,
      cout1: 1,
      cout2: 2,
      cout3: 3,
      cout4: 5,
    },
  })
  afficher()
  const jauge = await screen.findByRole('button', { name: /énergie/i })
  expect(jauge).toHaveTextContent('7')
  expect(jauge).toHaveTextContent('/ 10')
  expect(jauge).toHaveTextContent('+1 dans 23 min')
})

test('pleine : pas de compte à rebours', async () => {
  api.fetchEnergie.mockResolvedValue({
    points: 10,
    max: 10,
    prochainDans: null,
    parPoint: 1800,
    regle: {
      gratuitKm: 80,
      palier1Km: 150,
      palier2Km: 400,
      palier3Km: 1200,
      cout1: 1,
      cout2: 2,
      cout3: 3,
      cout4: 5,
    },
  })
  afficher()
  const jauge = await screen.findByRole('button', { name: /énergie/i })
  expect(jauge).toHaveTextContent('/ 10')
  expect(jauge).not.toHaveTextContent('+1')
})

test('la toucher explique la règle', async () => {
  api.fetchEnergie.mockResolvedValue({
    points: 7,
    max: 10,
    prochainDans: 1380,
    parPoint: 1800,
    regle: {
      gratuitKm: 80,
      palier1Km: 150,
      palier2Km: 400,
      palier3Km: 1200,
      cout1: 1,
      cout2: 2,
      cout3: 3,
      cout4: 5,
    },
  })
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /énergie/i }))
  const feuille = screen.getByRole('dialog', { name: 'L’énergie' })
  expect(feuille).toHaveTextContent('gratuit à moins de 80 km')
  expect(feuille).toHaveTextContent('2 jusqu’à 400 km, 3 jusqu’à 1 200 km, 5 au-delà')
  expect(feuille).toHaveTextContent('Un point revient toutes les 30 min')
  expect(feuille).toHaveTextContent('ajoute un point à ta jauge')
})
