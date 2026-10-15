import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { CarteDOrigine } from './CarteDOrigine'

const clic = (lat: number, lng: number) => ({ lngLat: { lat, lng, wrap: () => ({ lat, lng }) } })
const points = [
  { id: 1, lat: 41, lng: 12, image: 'https://cdn/a.png', nom: 'Rome' },
  { id: 2, lat: 37, lng: 22, image: null, nom: 'Sparte' },
]

test('un clic sur la carte pose le point', () => {
  const onPoser = vi.fn()
  render(<CarteDOrigine points={points} choisi={1} onPoser={onPoser} />)
  FausseCarte.derniere?.emettre('click', clic(43.1, 5.9))
  expect(onPoser).toHaveBeenCalledWith(43.1, 5.9)
})

test('une latitude hors −80..80 est ignorée', () => {
  const onPoser = vi.fn()
  render(<CarteDOrigine points={points} choisi={1} onPoser={onPoser} />)
  FausseCarte.derniere?.emettre('click', clic(85, 5))
  expect(onPoser).not.toHaveBeenCalled()
})

test('un marqueur par point : image ou initiale, le choisi en avant, retirés au démontage', () => {
  const { unmount } = render(<CarteDOrigine points={points} choisi={2} onPoser={vi.fn()} />)
  const marqueurs = document.querySelectorAll<HTMLElement>('.pastilleDOrigine')
  expect(marqueurs).toHaveLength(2)
  expect(marqueurs[0]?.style.getPropertyValue('--image')).toBe('url("https://cdn/a.png")')
  expect(screen.getByText('S')).toBeInTheDocument()
  expect(document.querySelectorAll('.pastilleDOrigineChoisie')).toHaveLength(1)
  unmount()
  expect(document.querySelectorAll('.pastilleDOrigine')).toHaveLength(0)
})
