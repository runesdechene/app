import { render, screen, within } from '@testing-library/react'
import { Pouls } from './Pouls'

const pouls = { nouveaux: 23, reactives: 9, actifs: 312, lieux: 14, visites: 86, enigmes: 241 }
const avant = { nouveaux: 19, reactives: 6, lieux: 8, visites: 77, enigmes: 236 }

test('six tuiles, dans l’ordre de la maquette', () => {
  render(<Pouls pouls={pouls} avant={avant} />)
  expect(screen.getAllByText(/./, { selector: 'span[class*="libelle"]' }).map((e) => e.textContent)).toEqual([
    'Nouveaux comptes', 'Comptes réactivés', 'Actifs', 'Lieux ajoutés', 'Visites sur place', 'Énigmes percées',
  ])
})

test('« Actifs » n’a pas d’écart : la période d’avant n’est pas comparable', () => {
  render(<Pouls pouls={pouls} avant={avant} />)
  const actifs = screen.getByText('Actifs').parentElement
  if (!actifs) throw new Error('tuile absente')
  expect(within(actifs).queryByTestId('ecart')).not.toBeInTheDocument()
})
