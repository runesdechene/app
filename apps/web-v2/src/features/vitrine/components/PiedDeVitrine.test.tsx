/**
 * QUOI     — le bas de la vitrine : la marque, ses liens vers la boutique, et la version.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { VERSION } from '@/shared/lib/version'
import { PiedDeVitrine } from './PiedDeVitrine'

function monter(connecte: boolean) {
  render(
    <MemoryRouter>
      <PiedDeVitrine connecte={connecte} />
    </MemoryRouter>,
  )
}

test('la marque mène à la boutique, à sa mission, au Mouvement et à ses réseaux', () => {
  monter(false)
  const lien = (nom: string) => screen.getByRole('link', { name: nom })
  expect(lien('La boutique')).toHaveAttribute('href', 'https://runesdechene.com')
  expect(lien('Notre mission')).toHaveAttribute(
    'href',
    'https://runesdechene.com/pages/notre-mission',
  )
  expect(lien('Le Mouvement')).toHaveAttribute('href', '/mouvement')
  expect(lien('Instagram')).toHaveAttribute('href', 'https://instagram.com/runesdechene')
  expect(lien('Facebook')).toHaveAttribute('href', 'https://facebook.com/runesdechene')
  expect(screen.getByText(VERSION)).toBeInTheDocument()
})

test('déjà connecté, « Commencer mon périple » et « Se connecter » mènent à la carte', () => {
  monter(true)
  expect(screen.getByRole('link', { name: 'Commencer mon périple' })).toHaveAttribute(
    'href',
    '/carte',
  )
  expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/carte')
})
