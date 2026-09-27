/**
 * QUOI     — la feuille qui monte du bas : se ferme par le voile ou Échap, jamais par son contenu.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Feuille } from './Feuille'

function ouvrir(onFermer = vi.fn()) {
  render(
    <Feuille titre="Mon compte" onFermer={onFermer}>
      <button type="button">Mon profil</button>
    </Feuille>,
  )
  return onFermer
}

test('une boîte de dialogue nommée par son titre', () => {
  ouvrir()
  expect(screen.getByRole('dialog', { name: 'Mon compte' })).toBeInTheDocument()
})

test('le voile ferme', async () => {
  const onFermer = ouvrir()
  await userEvent.click(screen.getByTestId('voile'))
  expect(onFermer).toHaveBeenCalledOnce()
})

test('Échap ferme', async () => {
  const onFermer = ouvrir()
  await userEvent.keyboard('{Escape}')
  expect(onFermer).toHaveBeenCalledOnce()
})

test('un clic dans le contenu ne ferme pas', async () => {
  const onFermer = ouvrir()
  await userEvent.click(screen.getByRole('button', { name: 'Mon profil' }))
  expect(onFermer).not.toHaveBeenCalled()
})
