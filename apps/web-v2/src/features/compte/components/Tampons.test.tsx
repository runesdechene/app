/**
 * QUOI     — les deux tampons : nature (compte, encre, pointillés) et photo encrée (date, repli sans photo).
 */
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { TamponNature } from './TamponNature'
import { TamponPhoto } from './TamponPhoto'

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const TAMPON = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: 'https://x/storage/v1/object/public/p/g.webp',
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-02',
}

test('un tampon de nature visitée : son compte et son encre', () => {
  render(<TamponNature nature={NATURE} compte={18} encre="fort" />)
  const t = screen.getByRole('img', { name: 'Châteaux : 18 lieux' })
  expect(t).toHaveAttribute('data-encre', 'fort')
  expect(screen.getByText('×18')).toBeInTheDocument()
})

test('le tampon de coin : visité, mais sans compte', () => {
  render(<TamponNature nature={NATURE} compte={1} encre="fort" taille="coin" />)
  expect(screen.getByRole('img', { name: 'Châteaux : 1 lieu' })).toHaveAttribute(
    'data-taille',
    'coin',
  )
  expect(screen.queryByText(/×/)).not.toBeInTheDocument()
})

test('une nature jamais visitée : en pointillés, sans compte', () => {
  render(<TamponNature nature={NATURE} compte={0} encre={null} />)
  expect(screen.getByRole('img', { name: 'Châteaux : pas encore' })).toHaveAttribute('data-absent')
  expect(screen.queryByText(/×/)).not.toBeInTheDocument()
})

test("un tampon photo : la photo, la date, le nom pour le lecteur d'écran", () => {
  render(<TamponPhoto tampon={TAMPON} nature={NATURE} date="2 oct." />)
  expect(screen.getByRole('img', { name: 'Château de Gourdon, 2 oct.' })).toBeInTheDocument()
  expect(screen.getByText('2 oct.')).toBeInTheDocument()
})

test('sans photo : le disque de la nature', () => {
  const { container } = render(
    <TamponPhoto tampon={{ ...TAMPON, imageUrl: null }} nature={NATURE} date="2 oct." />,
  )
  expect(container.querySelector('img')).toBeNull()
})
