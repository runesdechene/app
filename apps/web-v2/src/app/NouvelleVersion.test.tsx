/**
 * QUOI     — la fenêtre de nouvelle version : rien tant qu'il n'y en a pas ; Recharger ; Plus tard.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { NouvelleVersion } from './NouvelleVersion'

const mise = vi.hoisted(() => {
  let degre: 'prete' | 'forcee' | null = null
  const ecouteurs = new Set<() => void>()
  return {
    nouvelleVersion: {
      lire: () => degre,
      suivre: (f: () => void) => {
        ecouteurs.add(f)
        return () => {
          ecouteurs.delete(f)
        }
      },
    },
    annoncer: (d: 'prete' | 'forcee') => {
      degre = d
      for (const f of ecouteurs) f()
    },
    recharger: vi.fn(() => Promise.resolve()),
  }
})
vi.mock('./miseAJour', () => mise)

test('rien tant qu’aucune version n’est arrivée, puis la fenêtre et Recharger', async () => {
  render(<NouvelleVersion />)
  expect(screen.queryByText('Une nouvelle version d’Explore est arrivée')).toBeNull()
  act(() => {
    mise.annoncer('prete')
  })
  expect(screen.getByText('Une nouvelle version d’Explore est arrivée')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Recharger' }))
  expect(mise.recharger).toHaveBeenCalled()
  // Pendant la mise à jour, le bouton le dit et ne relance rien.
  const bouton = screen.getByRole('button', { name: 'Mise à jour…' })
  expect(bouton).toHaveAttribute('aria-busy', 'true')
  await userEvent.click(bouton)
  expect(mise.recharger).toHaveBeenCalledTimes(1)
})

test('« Plus tard » ferme la fenêtre', async () => {
  mise.annoncer('forcee')
  render(<NouvelleVersion />)
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
  expect(screen.queryByText('Une nouvelle version d’Explore est arrivée')).toBeNull()
})
