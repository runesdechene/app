/**
 * QUOI     — les photos d'un lieu, qu'on fait défiler : au doigt (la bande glisse), ou par les
 *            flèches discrètes de chaque côté ; la photo montrée est celle qu'on choisit.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DefilePhotos } from './DefilePhotos'

const PHOTOS = [
  { url: 'u1', vignette: 'v1' },
  { url: 'u2', vignette: 'v2' },
  { url: 'u3', vignette: 'v3' },
]

function monter(active: number, photos = PHOTOS) {
  const onChoisir = vi.fn()
  render(<DefilePhotos photos={photos} active={active} onChoisir={onChoisir} />)
  return onChoisir
}

test('toutes les photos sont dans la bande ; seule la première se charge d’emblée', () => {
  monter(0)
  const images = screen.getAllByRole('img')
  expect(images).toHaveLength(3)
  expect(images[0]).not.toHaveAttribute('loading', 'lazy')
  expect(images[1]).toHaveAttribute('loading', 'lazy')
})

test('la flèche de droite montre la photo suivante, celle de gauche la précédente', async () => {
  const onChoisir = monter(1)
  await userEvent.click(screen.getByRole('button', { name: 'Photo suivante' }))
  expect(onChoisir).toHaveBeenLastCalledWith(2)
  await userEvent.click(screen.getByRole('button', { name: 'Photo précédente' }))
  expect(onChoisir).toHaveBeenLastCalledWith(0)
})

test('aux deux bouts, la flèche qui ne mène nulle part disparaît', () => {
  monter(0)
  expect(screen.queryByRole('button', { name: 'Photo précédente' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Photo suivante' })).toBeInTheDocument()
})

test('une seule photo : ni flèche, ni défilé', () => {
  monter(0, [{ url: 'u1', vignette: 'v1' }])
  expect(screen.queryByRole('button', { name: /Photo/ })).toBeNull()
})

// La bande, mesurée comme dans un navigateur (jsdom ne mesure rien) : 400 px par photo.
function bandeDe(conteneur: HTMLElement) {
  const bande = conteneur.querySelector('img')?.parentElement
  if (!bande) throw new Error('bande absente')
  Object.defineProperty(bande, 'clientWidth', { value: 400, configurable: true })
  return (gauche: number) => {
    bande.scrollLeft = gauche
    fireEvent.scroll(bande)
  }
}

test('glisser au doigt jusqu’à une photo la montre, une fois la bande posée', async () => {
  vi.useFakeTimers()
  const onChoisir = vi.fn()
  const { container } = render(<DefilePhotos photos={PHOTOS} active={0} onChoisir={onChoisir} />)
  const defiler = bandeDe(container)
  defiler(400)
  expect(onChoisir).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(200))
  expect(onChoisir).toHaveBeenCalledWith(1)
  vi.useRealTimers()
})

test('pendant un glissement demandé (flèche, vignette), les photos traversées ne comptent pas', async () => {
  vi.useFakeTimers()
  const onChoisir = vi.fn()
  const { container, rerender } = render(
    <DefilePhotos photos={PHOTOS} active={0} onChoisir={onChoisir} />,
  )
  const defiler = bandeDe(container)
  rerender(<DefilePhotos photos={PHOTOS} active={2} onChoisir={onChoisir} />)
  defiler(100)
  await act(() => vi.advanceTimersByTimeAsync(200))
  defiler(500)
  await act(() => vi.advanceTimersByTimeAsync(200))
  defiler(800)
  await act(() => vi.advanceTimersByTimeAsync(200))
  expect(onChoisir).not.toHaveBeenCalled()
  vi.useRealTimers()
})
