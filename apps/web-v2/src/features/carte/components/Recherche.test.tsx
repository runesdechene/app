import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { Recherche } from './Recherche'

function lieu(l: Partial<LieuCarte>): LieuCarte {
  return {
    id: l.nom ?? 'a', nom: 'Lieu', lat: 44, lng: 7, nature: 'lieu', icone: null, couleur: null,
    etat: 'connu', revendication: null, ...l,
  }
}

test('chercher un lieu par son nom propose le lieu, le toucher y va', async () => {
  const aller = vi.fn()
  render(<Recherche lieux={[lieu({ nom: 'Trophée des Alpes', lat: 43.74, lng: 7.43 })]} onAller={aller} />)
  await userEvent.type(screen.getByRole('searchbox', { name: 'Un lieu, une ville…' }), 'troph')
  await userEvent.click(screen.getByRole('option', { name: 'Trophée des Alpes' }))
  expect(aller).toHaveBeenCalledWith({ lat: 43.74, lng: 7.43 })
})

test('la recherche ignore les accents et la casse', async () => {
  render(<Recherche lieux={[lieu({ nom: 'Église Saint-Jean' })]} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox'), 'eglise')
  expect(screen.getByRole('option', { name: 'Église Saint-Jean' })).toBeInTheDocument()
})

test('dix résultats au plus', async () => {
  const lieux = Array.from({ length: 15 }, (_, i) => lieu({ id: String(i), nom: `Tour ${String(i)}` }))
  render(<Recherche lieux={lieux} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox'), 'tour')
  expect(screen.getAllByRole('option')).toHaveLength(10)
})
