import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Attente } from './Attente'

const attente = { photos: 12, photos_depuis: '2026-10-11T09:00:00Z', lieux: 0, signalements_lieu: 2, signalements_enigme: 0, achats: 4 }

test('seules les files non vides ont leur ligne', () => {
  render(<MemoryRouter><Attente attente={attente} maintenant={new Date('2026-10-14T12:00:00Z')} /></MemoryRouter>)
  expect(screen.getByText('Photos et avis à valider')).toBeInTheDocument()
  expect(screen.getByText('Le plus ancien attend depuis 3 jours')).toBeInTheDocument()
  expect(screen.queryByText('Lieux à modérer')).not.toBeInTheDocument()
  expect(screen.queryByText('Énigmes signalées')).not.toBeInTheDocument()
})

test('rien n’attend : on le dit', () => {
  const vide = { photos: 0, photos_depuis: null, lieux: 0, signalements_lieu: 0, signalements_enigme: 0, achats: 0 }
  render(<MemoryRouter><Attente attente={vide} maintenant={new Date()} /></MemoryRouter>)
  expect(screen.getByText('Rien ne t’attend. Belle journée.')).toBeInTheDocument()
})
