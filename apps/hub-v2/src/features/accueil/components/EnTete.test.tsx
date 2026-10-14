import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { EnTete } from './EnTete'

function avec(nouveaux: number, visites: number) {
  render(<EnTete periode="7" onPeriode={vi.fn()} pouls={{ nouveaux, reactives: 0, lieux: 0, visites, enigmes: 0, actifs: 0 }} maintenant={new Date(2026, 9, 14)} />)
}

test('au pluriel', () => {
  avec(3, 5)
  expect(screen.getByText('3 nouveaux Explorateurs, 5 visites sur place.')).toBeInTheDocument()
})

test('au singulier', () => {
  avec(1, 1)
  expect(screen.getByText('1 nouvel Explorateur, 1 visite sur place.')).toBeInTheDocument()
})
