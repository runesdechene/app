import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { vi } from 'vitest'
import { Ouverture } from './Ouverture'

vi.mock('../hooks/useOuverture', () => ({
  useOuverture: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useFil', () => ({
  useFil: () => ({ activites: [], voirPlus: vi.fn(), aDAutres: false, isError: false }),
}))

function Adresse() {
  return <p data-testid="adresse">{useLocation().search}</p>
}

test('changer de période garde le filtre du fil', async () => {
  const router = createMemoryRouter(
    [{ path: '/', element: <><Ouverture /><Adresse /></> }],
    { initialEntries: ['/?fil=lieu'] },
  )
  render(<RouterProvider router={router} />)
  await userEvent.click(screen.getByLabelText('30 jours'))
  const adresse = new URLSearchParams(screen.getByTestId('adresse').textContent)
  expect(adresse.get('fil')).toBe('lieu')
  expect(adresse.get('periode')).toBe('30')
})
