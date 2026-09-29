/**
 * QUOI     — un cœur s'envole à chaque toucher, et disparaît à la fin de son envol.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { useEnvols } from '../hooks/useEnvols'
import { Envols } from './Envols'

function Bouton() {
  const { envols, lancer, finir } = useEnvols()
  return (
    <button type="button" onClick={lancer}>
      Cœur
      <Envols envols={envols} onFin={finir} />
    </button>
  )
}

test('chaque toucher lance un cœur ; il s’efface à la fin de son envol', async () => {
  render(<Bouton />)
  const bouton = screen.getByRole('button', { name: 'Cœur' })
  await userEvent.click(bouton)
  await userEvent.click(bouton)
  const envols = bouton.querySelectorAll('[data-envol]')
  expect(envols).toHaveLength(2)
  fireEvent.animationEnd(envols[0] as Element)
  expect(bouton.querySelectorAll('[data-envol]')).toHaveLength(1)
})
