/**
 * QUOI     — la bille d'un type de lieu : un rond dans la couleur du type, l'icône en blanc.
 */
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BilleType } from './BilleType'

test('le rond prend la couleur du type, l’icône en est le pochoir', () => {
  const { container } = render(<BilleType icone="menhir.svg" couleur="#80974e" />)
  const bille = container.querySelector<HTMLElement>('[data-bille-type]')
  const icone = bille?.firstElementChild as HTMLElement | null
  expect(bille?.style.getPropertyValue('--type')).toBe('#80974e')
  expect(icone?.style.getPropertyValue('--icone')).toBe('url(menhir.svg)')
})

test('sans couleur, le rond garde sa teinte par défaut', () => {
  const { container } = render(<BilleType icone="menhir.svg" couleur={null} />)
  const bille = container.querySelector<HTMLElement>('[data-bille-type]')
  expect(bille?.style.getPropertyValue('--type')).toBe('')
})
