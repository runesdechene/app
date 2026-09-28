/**
 * QUOI     — la feuille qui monte du bas : se ferme par le voile ou Échap, jamais par son contenu.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Feuille } from './Feuille'
import { RacineDesFeuilles } from './racineDesFeuilles'

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

test('sous une racine, la feuille s’y pose : son voile couvre toute l’app, pas son seul conteneur', () => {
  const racine = document.createElement('div')
  document.body.appendChild(racine)
  render(
    <RacineDesFeuilles value={racine}>
      <section aria-label="tiroir">
        <Feuille titre="Ce lieu" onFermer={vi.fn()}>
          contenu
        </Feuille>
      </section>
    </RacineDesFeuilles>,
  )
  expect(racine).toContainElement(screen.getByRole('dialog', { name: 'Ce lieu' }))
  expect(screen.getByRole('region', { name: 'tiroir' })).not.toContainElement(
    screen.getByRole('dialog', { name: 'Ce lieu' }),
  )
  racine.remove()
})
