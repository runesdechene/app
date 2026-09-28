/**
 * QUOI     — tenir et tirer une rangée à la souris la fait défiler ; un simple clic reste un clic ;
 *            une rangée qui n'apparaît qu'après coup (données chargées) glisse aussi.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { useGlisser } from './useGlisser'

function Rangee({ onClick, visible = true }: { onClick: () => void; visible?: boolean }) {
  const glisser = useGlisser()
  if (!visible) return null
  return (
    <ul ref={glisser} data-testid="rangee">
      <li>
        <button type="button" onClick={onClick}>
          Carte
        </button>
      </li>
    </ul>
  )
}

test('tirer vers la gauche fait défiler vers la droite', () => {
  render(<Rangee onClick={() => undefined} />)
  const rangee = screen.getByTestId('rangee')
  rangee.scrollLeft = 100
  fireEvent.pointerDown(rangee, { pointerType: 'mouse', button: 0, clientX: 300 })
  fireEvent.pointerMove(rangee, { pointerType: 'mouse', clientX: 240 })
  expect(rangee.scrollLeft).toBe(160)
})

test('une rangée qui apparaît après le premier rendu glisse aussi', () => {
  const { rerender } = render(<Rangee onClick={() => undefined} visible={false} />)
  rerender(<Rangee onClick={() => undefined} visible />)
  const rangee = screen.getByTestId('rangee')
  rangee.scrollLeft = 100
  fireEvent.pointerDown(rangee, { pointerType: 'mouse', button: 0, clientX: 300 })
  fireEvent.pointerMove(rangee, { pointerType: 'mouse', clientX: 240 })
  expect(rangee.scrollLeft).toBe(160)
})

test('après un glissé, le clic sur une carte est ignoré', () => {
  const onClick = vi.fn()
  render(<Rangee onClick={onClick} />)
  const rangee = screen.getByTestId('rangee')
  fireEvent.pointerDown(rangee, { pointerType: 'mouse', button: 0, clientX: 300 })
  fireEvent.pointerMove(rangee, { pointerType: 'mouse', clientX: 200 })
  fireEvent.pointerUp(rangee, { pointerType: 'mouse' })
  fireEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(onClick).not.toHaveBeenCalled()
})

test('un simple clic reste un clic', async () => {
  const onClick = vi.fn()
  render(<Rangee onClick={onClick} />)
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(onClick).toHaveBeenCalledOnce()
})
