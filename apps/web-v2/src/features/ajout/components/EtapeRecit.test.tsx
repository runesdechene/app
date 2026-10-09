/**
 * QUOI     — l'étape « Récit » : le récit s'écrit ; une piste glisse son amorce à la suite ; le
 *            bouton attend quelques mots.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { EtapeRecit } from './EtapeRecit'

vi.mock('../api/ajout', () => ({
  fetchNatures: () =>
    Promise.resolve([
      { id: 'chateau', nom: 'Châteaux & fortins', icone: null, couleur: '#a9260f' },
    ]),
}))

const suivant = vi.fn()
const vu = vi.fn<(b: Brouillon) => void>()
const dernier = () => vu.mock.lastCall?.[0]

function Etape() {
  const [b, setB] = useState<Brouillon>({
    ...BROUILLON_VIDE,
    etape: 'recit',
    photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
    point: { latitude: 43.7, longitude: 7.2 },
    nom: 'Château de Colomars',
    natures: ['chateau'],
  })
  vu(b)
  return (
    <EtapeRecit
      brouillon={b}
      changer={(m) => {
        setB((avant) => ({ ...avant, ...m }))
      }}
      onSuivant={suivant}
    />
  )
}

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Etape />
    </QueryClientProvider>,
  )
}

test('la fiche en petit rappelle de quel lieu on parle', async () => {
  monter()
  expect(screen.getByText('Château de Colomars')).toBeInTheDocument()
  expect(await screen.findByText('Châteaux & fortins')).toBeInTheDocument()
})

test('on écrit ; une piste glisse son amorce à la suite ; le bouton attend quelques mots', async () => {
  monter()
  expect(screen.getByText('Quelques mots, au moins')).toBeInTheDocument()
  const carnet = screen.getByRole('textbox', { name: 'Le récit' })
  await userEvent.type(carnet, 'Une tour carrée.')
  await userEvent.click(screen.getByRole('button', { name: /Comment y accéder/ }))
  expect(dernier()?.recit).toBe('Une tour carrée.\n\nPour y aller, ')
  await userEvent.click(screen.getByRole('button', { name: 'Voir la fiche' }))
  expect(suivant).toHaveBeenCalled()
})
