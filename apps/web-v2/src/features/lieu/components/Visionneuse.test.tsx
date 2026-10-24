/**
 * QUOI     — la visionneuse s'ouvre et se ferme avec la fiche ; la croix, Échap et un glissé assez
 *            long vers le bas demandent à la refermer, un glissé court non.
 * ATTENTION — jsdom ne connaît pas `showModal` : on le simule par l'attribut `open`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, expect, test, vi } from 'vitest'
import { Visionneuse } from './Visionneuse'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
  }
})

const PHOTOS = [
  { url: 'u1', vignette: 'v1' },
  { url: 'u2', vignette: 'v2' },
  { url: 'u3', vignette: 'v3' },
]

function monter(ouverte: boolean) {
  const onFermer = vi.fn()
  const vue = render(
    <Visionneuse
      ouverte={ouverte}
      nom="Château de Jonjeac"
      photos={PHOTOS}
      active={1}
      onChoisir={vi.fn()}
      onFermer={onFermer}
    />,
  )
  const fenetre = vue.container.querySelector('dialog')
  if (!fenetre) throw new Error('dialog absent')
  return { onFermer, fenetre, vue }
}

test('elle s’ouvre et se ferme avec la fiche, et dit où on en est', () => {
  const { fenetre, vue } = monter(false)
  expect(fenetre.open).toBe(false)
  vue.rerender(
    <Visionneuse
      ouverte
      nom="Château de Jonjeac"
      photos={PHOTOS}
      active={1}
      onChoisir={vi.fn()}
      onFermer={vi.fn()}
    />,
  )
  expect(fenetre.open).toBe(true)
  expect(screen.getByText('2 / 3')).toBeInTheDocument()
  expect(screen.getByText('Château de Jonjeac')).toBeInTheDocument()
})

test('la croix et Échap demandent à refermer, sans fermer d’elles-mêmes', async () => {
  const { onFermer, fenetre } = monter(true)
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  fireEvent(fenetre, new Event('cancel', { cancelable: true }))
  expect(onFermer).toHaveBeenCalledTimes(2)
  expect(fenetre.open).toBe(true)
})

function glisser(fenetre: HTMLElement, px: number) {
  fireEvent.pointerDown(fenetre, { pointerType: 'touch', clientY: 100 })
  fireEvent.pointerMove(fenetre, { pointerType: 'touch', clientY: 100 + px })
  fireEvent.pointerUp(fenetre, { pointerType: 'touch', clientY: 100 + px })
}

test('un glissé court vers le bas : la photo remonte ; assez long : elle se referme', () => {
  const { onFermer, fenetre } = monter(true)
  glisser(fenetre, 60)
  expect(onFermer).not.toHaveBeenCalled()
  expect(fenetre.style.getPropertyValue('--tire')).toBe('0px')
  glisser(fenetre, 200)
  expect(onFermer).toHaveBeenCalledOnce()
})
