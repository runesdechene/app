/**
 * QUOI     — le sceau touché : le « ? » de cire devant, le cachet de la culture derrière — à sa
 *            couleur, avec son logo (ou son initiale).
 */
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BORD_DE_CIRE } from '../lib/cachet'
import { SceauQuiSeRetourne } from './SceauQuiSeRetourne'

const byzance = { id: 'byzantine', nom: 'Byzance', icone: null, couleur: '#a93d76' }

test('devant, le sceau « ? » qu’on a touché, au même bord de cire que le cachet', () => {
  const { container } = render(<SceauQuiSeRetourne x={10} y={20} culture={null} onFini={() => undefined} />)
  expect(screen.getByText('?')).toBeInTheDocument()
  expect(container.querySelectorAll(`path[d="${BORD_DE_CIRE}"]`)).toHaveLength(2)
})

test('derrière, le cachet prend la couleur de la culture et porte son initiale', () => {
  const { container } = render(<SceauQuiSeRetourne x={10} y={20} culture={byzance} onFini={() => undefined} />)
  expect(screen.getByText('B')).toBeInTheDocument()
  expect(container.querySelector('[style*="--couleur-culture: #a93d76"]')).not.toBeNull()
})

test('avec un logo, le cachet porte le logo de la culture', () => {
  const { container } = render(
    <SceauQuiSeRetourne x={10} y={20} culture={{ ...byzance, icone: 'https://x/chrisme.png' }} onFini={() => undefined} />,
  )
  expect(container.querySelector('img[src="https://x/chrisme.png"]')).not.toBeNull()
})
