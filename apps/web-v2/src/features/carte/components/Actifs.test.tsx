/**
 * QUOI     — le compteur « X actifs », la feuille « Les actifs autour de toi », la carte d'un
 *            Explorateur (maquettes 362:182, 363:303, 366:236).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { Actif } from '../api/lireActifs'
import { CarteExplorateur } from './CarteExplorateur'
import { CompteurActifs } from './CompteurActifs'
import { FeuilleActifs } from './FeuilleActifs'

const NICE = { latitude: 43.7, longitude: 7.26 }
const ilYa = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

const actif = (id: string, autre: Partial<Actif> = {}): Actif => ({
  id,
  nom: id,
  avatar: null,
  niveau: 17,
  titre: 'Arpenteur',
  signe: null,
  lat: 43.7,
  lng: 7.4,
  brouille: false,
  vuA: ilYa(1),
  enLigne: true,
  ...autre,
})

function avecRouteur(element: React.ReactElement) {
  const router = createMemoryRouter(
    [
      { path: '/carte', element },
      { path: '*', element: null },
    ],
    { initialEntries: ['/carte'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('le compteur dit combien d’actifs, et rien s’il n’y en a pas', async () => {
  const ouvrir = vi.fn()
  const { rerender } = render(<CompteurActifs nombre={7} onOuvrir={ouvrir} />)
  await userEvent.click(screen.getByRole('button', { name: '7 actifs' }))
  expect(ouvrir).toHaveBeenCalled()
  rerender(<CompteurActifs nombre={0} onOuvrir={ouvrir} />)
  expect(screen.queryByRole('button')).toBeNull()
})

test('la feuille : les plus proches d’abord, en ligne ou depuis quand, la distance', async () => {
  const choisir = vi.fn()
  render(
    <FeuilleActifs
      actifs={[
        actif('Loin', { lat: 48.85, lng: 2.35 }),
        actif('Kelpie'),
        actif('Mathéo', { brouille: true, lat: 44.0, lng: 7.26, titre: null }),
        actif('Luna', { enLigne: false, vuA: ilYa(23), lat: 43.9 }),
      ]}
      moi={NICE}
      onChoisir={choisir}
      onFermer={vi.fn()}
    />,
  )
  const feuille = screen.getByRole('dialog', { name: 'Les actifs autour de toi' })
  const lignes = within(feuille).getAllByRole('button', { name: /·/ })
  expect(
    within(feuille)
      .getAllByText(/^(Kelpie|Luna|Mathéo|Loin)$/)
      .map((n) => n.textContent),
  ).toEqual(['Kelpie', 'Luna', 'Mathéo', 'Loin'])
  expect(lignes[0]).toHaveTextContent('En ligne · Arpenteur · niv. 17')
  expect(lignes[0]).toHaveTextContent('11 km')
  expect(lignes[1]).toHaveTextContent(/Il y a 23\smin/)
  expect(lignes[2]).toHaveTextContent('~ 33 km')
  expect(lignes[2]).toHaveTextContent('Pistes brouillées')
  await userEvent.click(lignes[0] as HTMLElement)
  expect(choisir).toHaveBeenCalledWith('Kelpie')
})

test('la carte d’un Explorateur : son signe, son titre, sa distance, et où aller', async () => {
  const router = avecRouteur(
    <CarteExplorateur
      actif={actif('k1', {
        nom: 'Kelpie',
        signe: { nom: 'Hoplite', imageUrl: 'hoplite.png' },
      })}
      moi={NICE}
      onFermer={vi.fn()}
    />,
  )
  const carte = await screen.findByRole('dialog', { name: 'Kelpie' })
  expect(within(carte).getByRole('heading', { name: 'Kelpie' })).toBeInTheDocument()
  expect(carte).toHaveTextContent('Arpenteur · niveau 17')
  expect(carte).toHaveTextContent('sous le signe de l’Hoplite')
  expect(carte).toHaveTextContent('En ligne · à 11 km de toi')
  await userEvent.click(within(carte).getByRole('button', { name: 'Envoyer un murmure' }))
  expect(router.state.location.pathname).toBe('/messages/murmures/k1')
})

test('sans signe, sans titre, sans position : rien d’orphelin', async () => {
  const router = avecRouteur(
    <CarteExplorateur
      actif={actif('a2', { nom: 'Aelis', titre: null, enLigne: false, vuA: ilYa(41) })}
      moi={null}
      onFermer={vi.fn()}
    />,
  )
  const carte = await screen.findByRole('dialog', { name: 'Aelis' })
  expect(carte).toHaveTextContent('Niveau 17')
  expect(carte).not.toHaveTextContent('sous le signe')
  expect(carte).toHaveTextContent(/Il y a 41\smin/)
  expect(carte).not.toHaveTextContent('de toi')
  await userEvent.click(within(carte).getByRole('button', { name: 'Voir le profil' }))
  expect(router.state.location.pathname).toBe('/carte/explorateur/a2')
})
