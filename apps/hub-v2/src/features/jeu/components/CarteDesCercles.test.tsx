import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { CarteDesCercles } from './CarteDesCercles'

const cercle = { lat: 46.5, lng: 2.25, rayon_km: 200 }

test('un clic sur la carte ajoute un cercle de 50 km à cet endroit', () => {
  const onChange = vi.fn()
  render(<CarteDesCercles cercles={[cercle]} eveils={[]} onChange={onChange} />)
  FausseCarte.derniere?.emettre('click', { lngLat: { lat: 45.5, lng: 3.2 } })
  expect(onChange).toHaveBeenCalledWith([cercle, { lat: 45.5, lng: 3.2, rayon_km: 50 }])
})

test('une ligne par cercle : position, curseur de rayon, retrait', async () => {
  const onChange = vi.fn()
  render(<CarteDesCercles cercles={[cercle]} eveils={[]} onChange={onChange} />)
  expect(screen.getByText('46.50, 2.25')).toBeInTheDocument()
  expect(screen.getByLabelText('Rayon du cercle 1')).toHaveValue('200')
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  expect(onChange).toHaveBeenCalledWith([])
})

test('une fois la carte chargée, les cercles et les « ? » sont posés dans leurs sources', () => {
  render(<CarteDesCercles cercles={[cercle]} eveils={[{ lat: 47, lng: 3 }]} onChange={vi.fn()} />)
  const carte = FausseCarte.derniere
  carte?.emettre('load')
  expect(carte?.addSource).toHaveBeenCalledWith('cercles', expect.objectContaining({ type: 'geojson' }))
  expect(carte?.addSource).toHaveBeenCalledWith('eveils', expect.objectContaining({ type: 'geojson' }))
})
