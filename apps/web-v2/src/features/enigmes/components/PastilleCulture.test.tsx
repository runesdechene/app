/**
 * QUOI     — la pastille d'une culture : son icône prend la couleur de la culture (Uriel, 07/10).
 */
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PastilleCulture } from './PastilleCulture'

test('l’icône se peint à la couleur de la culture : elle sert de masque, plus d’image brute', () => {
  const { container } = render(<PastilleCulture icone="https://x/chrisme.svg" couleur="#a93d76" taille="grande" />)
  expect(container.querySelector('img')).toBeNull()
  const icone = container.querySelector('[style*="--icone"]')
  expect(icone?.getAttribute('style')).toContain('url("https://x/chrisme.svg")')
})
