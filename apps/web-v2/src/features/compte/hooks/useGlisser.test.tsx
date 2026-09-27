/**
 * QUOI     — tenir et tirer une rangée à la souris la fait défiler ; un simple clic reste un clic.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { vi } from 'vitest'
import { useGlisser } from './useGlisser'

function Rangee({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLUListElement>(null)
  useGlisser(ref)
  return (
    <ul ref={ref} data-testid="rangee">
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
