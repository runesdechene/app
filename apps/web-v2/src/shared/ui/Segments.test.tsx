/**
 * QUOI     — Segments : un choix exclusif, lu comme un groupe de boutons radio.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Segments } from './Segments'

const ACCORDS = [
  { id: 'm', libelle: 'Masculin — Chevalier' },
  { id: 'f', libelle: 'Féminin — Chevalière' },
]

test('le choix courant est coché, les autres non', () => {
  render(<Segments libelle="Accord" options={ACCORDS} valeur="m" onChange={vi.fn()} />)
  expect(screen.getByRole('radiogroup', { name: 'Accord' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Masculin/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /Féminin/ })).not.toBeChecked()
})

test('toucher un segment le choisit', async () => {
  const onChange = vi.fn()
  render(<Segments libelle="Accord" options={ACCORDS} valeur="m" onChange={onChange} />)
  await userEvent.click(screen.getByText('Féminin — Chevalière'))
  expect(onChange).toHaveBeenCalledWith('f')
})
