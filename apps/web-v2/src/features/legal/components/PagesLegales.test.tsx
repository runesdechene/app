/**
 * QUOI     — les trois textes légaux s'ouvrent sans compte et disent l'essentiel exigé par la loi.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { Conditions } from './Conditions'
import { Confidentialite } from './Confidentialite'
import { Mentions } from './Mentions'

function monter(page: React.ReactNode) {
  render(<MemoryRouter>{page}</MemoryRouter>)
}

test('les mentions légales nomment l’éditeur, son immatriculation et ses hébergeurs', () => {
  monter(<Mentions />)
  expect(screen.getByText(/SIRET 844 256 537 00011/)).toBeInTheDocument()
  expect(screen.getByText(/06 19 93 43 28/)).toBeInTheDocument()
  expect(screen.getByText(/Netlify, Inc\./)).toBeInTheDocument()
  expect(screen.getByText(/Supabase, Inc\./)).toBeInTheDocument()
})

test('la confidentialité dit les droits, la CNIL et comment supprimer son compte', () => {
  monter(<Confidentialite />)
  expect(screen.getByRole('heading', { name: 'Tes droits' })).toBeInTheDocument()
  expect(screen.getByText(/saisir la CNIL/)).toBeInTheDocument()
  expect(screen.getAllByText(/Supprimer mon compte/).length).toBeGreaterThan(0)
  expect(screen.getByText(/compte client de la boutique runesdechene\.com/)).toBeInTheDocument()
})

test('les conditions reprennent la Charte et la règle des fouilles', () => {
  monter(<Conditions />)
  expect(screen.getByText('Un visage n’est pas un décor')).toBeInTheDocument()
  expect(screen.getByText(/L\. 542-1/)).toBeInTheDocument()
})
