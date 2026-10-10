/**
 * QUOI     — l'étape « Nom, nature, époque » : le nom s'écrit ; jusqu'à trois natures, numérotées
 *            dans l'ordre du choix (la première est la principale) ; une époque, ou « je ne sais
 *            pas » ; l'année sur demande. Le bouton dit ce qui manque.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { EtapeNom } from './EtapeNom'

vi.mock('../api/ajout', () => ({
  fetchNatures: () =>
    Promise.resolve([
      { id: 'chateau', nom: 'Châteaux & fortins', icone: 'c.svg', couleur: '#a9260f' },
      { id: 'ruines', nom: 'Ruines et vestiges', icone: 'r.svg', couleur: '#745744' },
      { id: 'vue', nom: 'Vue emblématique', icone: 'v.svg', couleur: '#80974e', horsEpoque: true },
      { id: 'grotte', nom: 'Grottes & Cairns', icone: 'g.svg', couleur: '#555353' },
    ]),
  fetchEpoques: () =>
    Promise.resolve([
      { id: 'late-middle-ages', nom: 'Bas Moyen Âge' },
      { id: 'renaissance', nom: 'Renaissance' },
      { id: 'not-applicable', nom: 'Non concerné' },
    ]),
}))

const suivant = vi.fn()
// Le brouillon tel que l'étape l'a laissé, observé à chaque rendu.
const vu = vi.fn<(b: Brouillon) => void>()
const dernier = () => vu.mock.lastCall?.[0]

function Etape() {
  const [b, setB] = useState<Brouillon>({
    ...BROUILLON_VIDE,
    etape: 'nom',
    photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
    point: { latitude: 43.7, longitude: 7.2 },
  })
  vu(b)
  return (
    <EtapeNom
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

beforeEach(() => {
  suivant.mockReset()
})

test('le bouton dit ce qui manque : un nom, puis une nature', async () => {
  monter()
  expect(screen.getByText('Il lui faut un nom')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Son nom' }), 'Château de Colomars')
  expect(screen.getByText('Choisis sa nature')).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: /Châteaux & fortins/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  expect(suivant).toHaveBeenCalled()
  expect(dernier()?.nom).toBe('Château de Colomars')
})

test('trois natures au plus, numérotées dans l’ordre du choix ; en retirer une renumérote', async () => {
  monter()
  const chateau = await screen.findByRole('button', { name: /Châteaux & fortins/ })
  await userEvent.click(screen.getByRole('button', { name: /Ruines et vestiges/ }))
  await userEvent.click(chateau)
  await userEvent.click(screen.getByRole('button', { name: /Vue emblématique/ }))
  expect(dernier()?.natures).toEqual(['ruines', 'chateau', 'vue'])
  expect(screen.getByRole('button', { name: /Grottes & Cairns/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: /Ruines et vestiges/ }))
  expect(dernier()?.natures).toEqual(['chateau', 'vue'])
  expect(chateau).toHaveTextContent('1')
})

test('une époque, ou « je ne sais pas » ; l’année sur demande, avant J.-C. possible', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Bas Moyen Âge' }))
  expect(dernier()?.epoque).toBe('late-middle-ages')
  await userEvent.click(screen.getByRole('button', { name: 'Je ne sais pas' }))
  expect(dernier()?.epoque).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Préciser l’année/ }))
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Année' }), '52')
  await userEvent.click(screen.getByRole('checkbox', { name: 'av. è. c.' }))
  expect(dernier()?.annee).toBe(-52)
})

test('une nature sans époque, choisie en premier, coche « Non concerné » ; une autre en tête le retire', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: /Vue emblématique/ }))
  expect(dernier()?.epoque).toBe('not-applicable')
  // Une nature historique passe en tête : « Non concerné » n'a plus de sens.
  await userEvent.click(screen.getByRole('button', { name: /Châteaux & fortins/ }))
  await userEvent.click(screen.getByRole('button', { name: /Vue emblématique/ }))
  expect(dernier()?.natures).toEqual(['chateau'])
  expect(dernier()?.epoque).toBeNull()
})

test('une époque choisie à la main n’est jamais remplacée', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Renaissance' }))
  await userEvent.click(screen.getByRole('button', { name: /Vue emblématique/ }))
  expect(dernier()?.epoque).toBe('renaissance')
})

test('chaque nature porte sa bille : sa couleur, son icône', async () => {
  monter()
  const chateau = await screen.findByRole('button', { name: 'Châteaux & fortins' })
  const bille = chateau.querySelector<HTMLElement>('[data-bille-type]')
  expect(bille?.style.getPropertyValue('--type')).toBe('#a9260f')
  expect(bille?.innerHTML).toContain('c.svg')
})
