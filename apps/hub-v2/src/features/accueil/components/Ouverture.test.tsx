import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { vi } from 'vitest'
import { Ouverture } from './Ouverture'

const useOuverture = vi.fn<(periode: string) => { data: undefined; isError: boolean; refetch: () => void }>(
  () => ({ data: undefined, isError: false, refetch: vi.fn() }),
)
vi.mock('../hooks/useOuverture', () => ({ useOuverture: (periode: string) => useOuverture(periode) }))
vi.mock('../hooks/useSanteBoutique', () => ({
  useSanteBoutique: () => ({ shopify: undefined, shopifyErreur: null, fiches: undefined }),
}))
vi.mock('../hooks/useFil', () => ({
  useFil: () => ({ activites: [], voirPlus: vi.fn(), aDAutres: false, isError: false }),
}))

function Adresse() {
  return <p data-testid="adresse">{useLocation().search}</p>
}

function ouvrir(adresse: string) {
  const router = createMemoryRouter([{ path: '/', element: <><Ouverture /><Adresse /></> }], { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
}

test('par défaut, la semaine', () => {
  ouvrir('/')
  expect(useOuverture).toHaveBeenLastCalledWith('semaine')
})

test('la période de l’adresse est respectée', () => {
  ouvrir('/?periode=mois')
  expect(useOuverture).toHaveBeenLastCalledWith('mois')
})

test('une période inconnue retombe sur la semaine', () => {
  ouvrir('/?periode=7')
  expect(useOuverture).toHaveBeenLastCalledWith('semaine')
})

test('changer de période garde le filtre du fil', async () => {
  ouvrir('/?fil=lieu')
  await userEvent.click(screen.getByLabelText('Ce mois-ci'))
  const adresse = new URLSearchParams(screen.getByTestId('adresse').textContent)
  expect(adresse.get('fil')).toBe('lieu')
  expect(adresse.get('periode')).toBe('mois')
})
