import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { CarteDesCercles } from './CarteDesCercles'

const cercle = { lat: 46.5, lng: 2.25, rayon_km: 200 }
const clic = (lat: number, lng: number) => ({ lngLat: { lat, lng, wrap: () => ({ lat, lng: lng > 180 ? lng - 360 : lng }) } })

test('un clic sur la carte ajoute un cercle de 50 km à cet endroit', () => {
  const onChange = vi.fn()
  render(<CarteDesCercles cercles={[cercle]} eveils={[]} couleur={null} onChange={onChange} />)
  FausseCarte.derniere?.emettre('click', clic(45.5, 3.2))
  expect(onChange).toHaveBeenCalledWith([cercle, { lat: 45.5, lng: 3.2, rayon_km: 50 }])
})

test('la longitude est ramenée dans −180..180, et une latitude hors −80..80 est ignorée', () => {
  const onChange = vi.fn()
  render(<CarteDesCercles cercles={[]} eveils={[]} couleur={null} onChange={onChange} />)
  FausseCarte.derniere?.emettre('click', clic(85, 10))
  expect(onChange).not.toHaveBeenCalled()
  FausseCarte.derniere?.emettre('click', clic(10, 190))
  expect(onChange).toHaveBeenCalledWith([{ lat: 10, lng: -170, rayon_km: 50 }])
})

test('une ligne par cercle : position, curseur de rayon, retrait', async () => {
  const onChange = vi.fn()
  render(<CarteDesCercles cercles={[cercle]} eveils={[]} couleur={null} onChange={onChange} />)
  expect(screen.getByText('46.50, 2.25')).toBeInTheDocument()
  expect(screen.getByLabelText('Rayon du cercle 1')).toHaveValue('200')
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  expect(onChange).toHaveBeenCalledWith([])
})

test('une fois la carte chargée, les cercles et les « ? » sont posés dans leurs sources', () => {
  render(<CarteDesCercles cercles={[cercle]} eveils={[{ lat: 47, lng: 3 }]} couleur={null} onChange={vi.fn()} />)
  const carte = FausseCarte.derniere
  carte?.emettre('load')
  expect(carte?.addSource).toHaveBeenCalledWith('cercles', expect.objectContaining({ type: 'geojson' }))
  expect(carte?.addSource).toHaveBeenCalledWith('eveils', expect.objectContaining({ type: 'geojson' }))
})

test('de nouveaux cercles remplacent les données de la source ; une nouvelle couleur repeint les cercles', () => {
  const { rerender } = render(<CarteDesCercles cercles={[]} eveils={[]} couleur={null} onChange={vi.fn()} />)
  const carte = FausseCarte.derniere
  carte?.emettre('load')
  rerender(<CarteDesCercles cercles={[cercle]} eveils={[]} couleur="#aa0000" onChange={vi.fn()} />)
  expect(carte?.getSource('cercles')).toBeDefined()
  expect(carte?.autresSources.get('cercles')?.setData).toHaveBeenCalledWith(expect.objectContaining({ type: 'FeatureCollection' }))
  expect(carte?.setPaintProperty).toHaveBeenCalledWith('cercles-fond', 'fill-color', '#aa0000')
})
