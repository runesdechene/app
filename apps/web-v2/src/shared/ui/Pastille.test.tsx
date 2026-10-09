/**
 * QUOI     — la pastille de non-lus : rien à zéro, le nombre jusqu'à 9, « 9+ » au-delà.
 */
import { render, screen } from '@testing-library/react'
import { Pastille } from './Pastille'

test('rien à zéro', () => {
  const { container } = render(<Pastille count={0} />)
  expect(container).toBeEmptyDOMElement()
})

test('le nombre jusqu’à 9, lisible par un lecteur d’écran', () => {
  render(<Pastille count={3} />)
  expect(screen.getByLabelText('3 non lus')).toHaveTextContent('3')
})

test('« 9+ » au-delà de 9', () => {
  render(<Pastille count={12} />)
  expect(screen.getByLabelText('12 non lus')).toHaveTextContent('9+')
})

test('discrète : un point sans nombre, et rien à zéro', () => {
  const { container, rerender } = render(<Pastille count={0} discrete />)
  expect(container).toBeEmptyDOMElement()
  rerender(<Pastille count={4} discrete />)
  expect(screen.getByLabelText('Nouveaux messages')).toHaveTextContent('')
})
