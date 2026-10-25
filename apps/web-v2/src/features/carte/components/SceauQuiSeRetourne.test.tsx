/**
 * QUOI     — le sceau touché : le sceau de la carte (cire teinte, clé d'or), qui pivote jusqu'à ce que
 *            l'énigme soit là, puis part.
 */
import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SceauQuiSeRetourne } from './SceauQuiSeRetourne'

function monter(prete: boolean) {
  const onOuvrir = vi.fn()
  const onFini = vi.fn()
  const { container } = render(
    <SceauQuiSeRetourne
      x={10}
      y={20}
      couleur="#7a3359"
      prete={prete}
      onOuvrir={onOuvrir}
      onFini={onFini}
    />,
  )
  const sceau = container.firstElementChild ?? container
  return { container, sceau, onOuvrir, onFini }
}

test('la cire et la clé de la carte, la cire teinte à la couleur de la culture', () => {
  const { container } = monter(false)
  expect(container.querySelectorAll('img')).toHaveLength(2)
  expect(container.querySelector('[style*="--couleur-culture: #7a3359"]')).not.toBeNull()
})

test('tant que l’énigme se charge, il continue de pivoter', () => {
  const { sceau, onOuvrir } = monter(false)
  fireEvent.animationIteration(sceau)
  expect(onOuvrir).not.toHaveBeenCalled()
  expect(sceau).not.toHaveAttribute('data-part')
})

test('l’énigme là, il finit son tour, la feuille s’ouvre et il s’efface', () => {
  const { sceau, onOuvrir, onFini } = monter(true)
  fireEvent.animationIteration(sceau)
  expect(onOuvrir).toHaveBeenCalledOnce()
  expect(sceau).toHaveAttribute('data-part')
  fireEvent.animationEnd(sceau)
  expect(onFini).toHaveBeenCalledOnce()
})
