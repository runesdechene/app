import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Balise } from './Balise'
import { ChoixSegmente } from './ChoixSegmente'
import { LigneATraiter } from './LigneATraiter'
import { Tuile } from './Tuile'

test('une tuile sans écart ne montre que la valeur', () => {
  render(<Tuile libelle="Actifs" valeur="312" />)
  expect(screen.getByText('312')).toBeInTheDocument()
  expect(screen.queryByTestId('ecart')).not.toBeInTheDocument()
})

test('une tuile qui baisse le dit', () => {
  render(<Tuile libelle="Lieux ajoutés" valeur="14" ecart={{ texte: '−4 %', sens: 'baisse' }} />)
  expect(screen.getByTestId('ecart')).toHaveAttribute('data-sens', 'baisse')
})

test('une balise porte sa teinte', () => {
  render(<Balise texte="Porteur" teinte="porteur" />)
  expect(screen.getByText('Porteur')).toHaveAttribute('data-teinte', 'porteur')
})

test('le choix segmenté rend la valeur choisie', async () => {
  const onChoix = vi.fn()
  render(
    <ChoixSegmente
      nom="Période"
      options={[{ valeur: '7', libelle: '7 jours' }, { valeur: '30', libelle: '30 jours' }]}
      choisi="7"
      onChoix={onChoix}
    />,
  )
  expect(screen.getByRole('radio', { name: '7 jours' })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: '30 jours' }))
  expect(onChoix).toHaveBeenCalledWith('30')
})

test('une ligne à traiter mène à son écran', () => {
  render(
    <MemoryRouter>
      <LigneATraiter nombre={12} titre="Photos et avis à valider" detail="Le plus ancien attend depuis 3 jours" vers="/boutique/photos" />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: /Photos et avis à valider/ })).toHaveAttribute('href', '/boutique/photos')
})
