/**
 * QUOI     — une carte de lieu du profil ouvre sa fiche, dans l'onglet où l'on se trouve.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { LieuCarte } from './LieuCarte'

const LIEU = {
  id: 'l1',
  nom: 'Abbaye de Montmajour',
  imageUrl: null,
  latitude: null,
  longitude: null,
  categorie: null,
  auteur: null,
}

function depuis(adresse: string) {
  const carte = (
    <ul>
      <LieuCarte lieu={LIEU} position={null} avecAuteur={false} />
    </ul>
  )
  const router = createMemoryRouter([{ path: '*', element: carte }], {
    initialEntries: [adresse],
  })
  render(<RouterProvider router={router} />)
  return router
}

test('depuis l’onglet Compte, la carte ouvre la fiche du lieu', async () => {
  const router = depuis('/compte')
  await userEvent.click(screen.getByRole('link', { name: /Abbaye de Montmajour/ }))
  expect(router.state.location.pathname).toBe('/compte/lieu/l1')
})

test('depuis le profil d’un autre, ouvert dans l’Accueil, la fiche s’ouvre dans l’Accueil', async () => {
  const router = depuis('/accueil/explorateur/u2')
  await userEvent.click(screen.getByRole('link', { name: /Abbaye de Montmajour/ }))
  expect(router.state.location.pathname).toBe('/accueil/lieu/l1')
})

test('la fiche ouverte depuis le profil sait qu’un écran est derrière elle (sa flèche y ramène)', async () => {
  const router = depuis('/compte')
  await userEvent.click(screen.getByRole('link', { name: /Abbaye de Montmajour/ }))
  expect(router.state.location.state).toEqual(VENU_D_UN_ECRAN)
})
