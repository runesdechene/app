import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Conquete as ConqueteFaite } from '../api/lireLieu'
import { Conquete } from './Conquete'

const PRIS = { nom: 'La Garde du Comté', prisA: 'Remy', rang: 4 }

function rendre(conquete: ConqueteFaite = PRIS) {
  const onVoirLeLieu = vi.fn()
  const onFermer = vi.fn()
  render(
    <Conquete
      lieu="Château de Coaraze"
      conquete={conquete}
      onVoirLeLieu={onVoirLeLieu}
      onFermer={onFermer}
    />,
  )
  return { onVoirLeLieu, onFermer }
}

test('le mot, le lieu, à qui on l’a pris, le nom qui flotte, le rang et l’enjeu', () => {
  rendre()
  expect(screen.getByRole('heading', { name: 'CONQUIS !' })).toBeInTheDocument()
  expect(screen.getByText('Château de Coaraze')).toBeInTheDocument()
  expect(screen.getByText('PRIS À REMY')).toBeInTheDocument()
  // Le nom est en gras : la phrase se lit sur le paragraphe entier.
  expect(
    screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent.startsWith('« La Garde du Comté » flotte sur ce lieu'),
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Ton 4ᵉ lieu conquis')).toBeInTheDocument()
  expect(
    screen.getByText('On te préviendra si quelqu’un vient te le reprendre.'),
  ).toBeInTheDocument()
})

test('un lieu que personne ne tenait : pas de « Pris à »', () => {
  rendre({ nom: 'Uriel', prisA: null, rang: 1 })
  expect(screen.queryByText(/PRIS À/)).not.toBeInTheDocument()
  expect(screen.getByText('Ton 1ᵉʳ lieu conquis')).toBeInTheDocument()
})

test('« VOIR LE LIEU » ouvre le lieu, la croix ferme', async () => {
  const { onVoirLeLieu, onFermer } = rendre()
  await userEvent.click(screen.getByRole('button', { name: 'VOIR LE LIEU →' }))
  expect(onVoirLeLieu).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(onFermer).toHaveBeenCalledOnce()
})
