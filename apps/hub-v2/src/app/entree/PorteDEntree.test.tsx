import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { EtatEntree } from './decideEntree'
import { PorteDEntree } from './PorteDEntree'

const mockUseEntree = vi.hoisted(() => vi.fn())
vi.mock('./useEntree', () => ({ useEntree: mockUseEntree }))

function avec(etat: EtatEntree) {
  mockUseEntree.mockReturnValue({ etat, relire: vi.fn() })
}

test('un joueur connecté voit que le Hub est réservé, et peut se déconnecter', () => {
  avec({ statut: 'pret', session: true, admin: false })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByText('Ce Hub est réservé à l’équipe.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  expect(screen.queryByText('Coquille')).not.toBeInTheDocument()
})

test('un admin connecté entre', () => {
  avec({ statut: 'pret', session: true, admin: true })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByText('Coquille')).toBeInTheDocument()
})

test('sans session, on demande l’e-mail', () => {
  avec({ statut: 'pret', session: false, admin: false })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByLabelText('Ton e-mail')).toBeInTheDocument()
})

test('en erreur, on propose de réessayer', () => {
  avec({ statut: 'erreur' })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
