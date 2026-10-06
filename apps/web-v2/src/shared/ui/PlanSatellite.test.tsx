/**
 * QUOI     — le bouton Plan / Satellite : deux choix, un seul appuyé.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PlanSatellite } from './PlanSatellite'

test('« Satellite » appuyé demande la vue satellite', async () => {
  const onChanger = vi.fn()
  render(<PlanSatellite vue="plan" onChanger={onChanger} />)
  expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Satellite' }))
  expect(onChanger).toHaveBeenCalledWith('satellite')
})
