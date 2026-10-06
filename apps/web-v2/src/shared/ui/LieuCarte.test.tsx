/**
 * QUOI     — la carte d'un lieu : par défaut la distance ; dans le passeport, une pastille de
 *            date à gauche et un tampon par-dessus le coin. Une carte de lieu du profil ouvre
 *            sa fiche, dans l'onglet où l'on se trouve.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { LieuCarte, type LieuDeCarte } from './LieuCarte'

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

test("depuis l'onglet Compte, la carte ouvre la fiche du lieu", async () => {
  const router = depuis('/compte')
  await userEvent.click(screen.getByRole('link', { name: /Abbaye de Montmajour/ }))
  expect(router.state.location.pathname).toBe('/compte/lieu/l1')
})

test("depuis le profil d'un autre, ouvert dans l'Accueil, la fiche s'ouvre dans l'Accueil", async () => {
  const router = depuis('/accueil/explorateur/u2')
  await userEvent.click(screen.getByRole('link', { name: /Abbaye de Montmajour/ }))
  expect(router.state.location.pathname).toBe('/accueil/lieu/l1')
})

const LIEU_PASSEPORT: LieuDeCarte = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: null,
  latitude: 43.72,
  longitude: 6.97,
  categorie: null,
  auteur: null,
}

function afficher(props: Partial<Parameters<typeof LieuCarte>[0]> = {}) {
  render(
    <MemoryRouter initialEntries={['/compte']}>
      <ul>
        <LieuCarte lieu={LIEU_PASSEPORT} position={null} avecAuteur={false} {...props} />
      </ul>
    </MemoryRouter>,
  )
}

test("la pastille et le coin s'affichent", () => {
  afficher({ pastille: '2 oct.', coin: <span>tampon</span> })
  expect(screen.getByText('2 oct.')).toBeInTheDocument()
  expect(screen.getByText('tampon')).toBeInTheDocument()
})

test('sans elles, rien de plus', () => {
  afficher()
  expect(screen.queryByText('2 oct.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Château de Gourdon/ })).toHaveAttribute(
    'href',
    '/compte/lieu/p1',
  )
})
