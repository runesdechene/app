/**
 * QUOI     — le cadre commun des pages publiques : le contenu, et la photo seulement si on la donne.
 */
import { render, screen } from '@testing-library/react'
import { PagePublique } from './PagePublique'

test('sans photo, le cadre ne montre que son contenu', () => {
  const { container } = render(<PagePublique titre="T"><h1>Titre</h1></PagePublique>)
  expect(screen.getByRole('heading', { name: 'Titre' })).toBeInTheDocument()
  expect(container.querySelector('[data-photo]')).toBeNull()
})

test('avec une photo, la carte la pose en fond, sous son contenu', () => {
  render(
    <PagePublique titre="T" disposition="carte" photo={<img alt="Le fond" src="fond.webp" />}>
      <h1>Titre</h1>
    </PagePublique>,
  )
  expect(screen.getByRole('img', { name: 'Le fond' })).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveAttribute('data-disposition', 'carte')
})
