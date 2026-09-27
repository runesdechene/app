/**
 * QUOI     — les onglets : une liste accessible, l'onglet actif marqué, le compte à côté du libellé.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Onglets } from './Onglets'

const ONGLETS = [
  { id: 'ajoutes', libelle: 'Ajoutés', compte: 2 },
  { id: 'visites', libelle: 'Visités', compte: 18 },
] as const

test('une liste d’onglets, l’actif sélectionné', () => {
  render(<Onglets onglets={ONGLETS} actif="visites" onChange={() => undefined} />)
  expect(screen.getByRole('tablist')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Visités/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: /Ajoutés/ })).toHaveAttribute('aria-selected', 'false')
})

test('le compte s’affiche à côté du libellé', () => {
  render(<Onglets onglets={ONGLETS} actif="ajoutes" onChange={() => undefined} />)
  expect(screen.getByRole('tab', { name: /Visités/ })).toHaveTextContent('18')
})

test('un clic choisit l’onglet', async () => {
  const onChange = vi.fn()
  render(<Onglets onglets={ONGLETS} actif="ajoutes" onChange={onChange} />)
  await userEvent.click(screen.getByRole('tab', { name: /Visités/ }))
  expect(onChange).toHaveBeenCalledWith('visites')
})
