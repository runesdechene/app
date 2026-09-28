import { render, screen } from '@testing-library/react'
import { Inscription } from './Inscription'

test('le nom du territoire s’inscrit entre deux fleurons', () => {
  render(<Inscription nom="Comté de Nice" />)
  expect(screen.getByText('Comté de Nice')).toBeInTheDocument()
})

test('sans territoire, rien ne s’inscrit', () => {
  const { container } = render(<Inscription nom={null} />)
  expect(container).toBeEmptyDOMElement()
})
