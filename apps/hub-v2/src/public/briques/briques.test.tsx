/**
 * QUOI     — les briques des pages publiques : le champ a son nom accessible, la case se coche
 *            par son texte, l'erreur s'annonce.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bouton, LienBouton } from './Bouton'
import { CaseACocher } from './CaseACocher'
import { Champ } from './Champ'
import { MessageDErreur } from './MessageDErreur'

test('le bouton ne soumet pas par défaut', () => {
  render(<Bouton>Recevoir mon cadeau</Bouton>)
  expect(screen.getByRole('button', { name: 'Recevoir mon cadeau' })).toHaveAttribute('type', 'button')
})

test('le lien-bouton mène à son adresse', () => {
  render(<LienBouton href="https://runesdechene.com">J’en profite sur la boutique</LienBouton>)
  expect(screen.getByRole('link', { name: 'J’en profite sur la boutique' })).toHaveAttribute('href', 'https://runesdechene.com')
})

test('le champ du flyer cadeau porte son libellé', async () => {
  render(<Champ libelle="Ton e-mail" type="email" placeholder="ton@email.fr" />)
  const champ = screen.getByRole('textbox', { name: 'Ton e-mail' })
  await userEvent.type(champ, 'claire@exemple.fr')
  expect(champ).toHaveValue('claire@exemple.fr')
})

test('la case se coche en touchant son texte', async () => {
  render(<CaseACocher>Je veux recevoir les nouvelles</CaseACocher>)
  const caseACocher = screen.getByRole('checkbox', { name: 'Je veux recevoir les nouvelles' })
  await userEvent.click(screen.getByText('Je veux recevoir les nouvelles'))
  expect(caseACocher).toBeChecked()
})

test('le message d’erreur s’annonce', () => {
  render(<MessageDErreur>Trop de tentatives, réessaie dans un moment.</MessageDErreur>)
  expect(screen.getByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans un moment.')
})
