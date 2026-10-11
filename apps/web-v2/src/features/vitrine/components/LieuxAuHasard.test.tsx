/**
 * QUOI     — « Quelques lieux de la carte » : chaque lieu mène à sa fiche publique, dit sa
 *            nature, son département et son numéro, et qui l'a ajouté.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import type { LieuAuHasard } from '../api/lireVitrine'
import { LieuxAuHasard } from './LieuxAuHasard'

const FONTFROIDE: LieuAuHasard = {
  id: 'l1',
  nom: 'Abbaye de Fontfroide',
  slug: 'abbaye-de-fontfroide',
  region: 'Aude',
  numero: '11',
  nature: { id: 'n1', nom: 'Sanctuaires', icone: null, couleur: '#6e487f' },
  photo: 'https://exemple.fr/photo.webp',
  auteur: { nom: 'Uriel', avatar: null },
}
const KOURION: LieuAuHasard = {
  ...FONTFROIDE,
  id: 'l2',
  nom: 'Kourion',
  slug: 'kourion',
  region: 'Chypre',
  numero: null,
  nature: null,
  auteur: null,
}

function monter(lieux: LieuAuHasard[]) {
  render(
    <MemoryRouter>
      <LieuxAuHasard lieux={lieux} lieuxSurLaCarte={3504} />
    </MemoryRouter>,
  )
}

test('chaque lieu mène à sa fiche, avec sa nature, son département et qui l’a ajouté', () => {
  monter([FONTFROIDE, KOURION])
  expect(screen.getByRole('link', { name: /Abbaye de Fontfroide/ })).toHaveAttribute(
    'href',
    '/lieu/abbaye-de-fontfroide',
  )
  expect(screen.getByText('Sanctuaires')).toBeInTheDocument()
  expect(screen.getByText('Aude (11)')).toBeInTheDocument()
  expect(screen.getByText('Uriel')).toBeInTheDocument()
  // Hors de France, le pays seul ; sans auteur connu, pas de ligne « Ajouté par ».
  expect(screen.getByText('Chypre')).toBeInTheDocument()
  expect(screen.getAllByText(/Ajouté par/)).toHaveLength(1)
})

test('le lien vers la carte dit combien de lieux elle compte', () => {
  monter([FONTFROIDE])
  expect(screen.getByRole('link', { name: /Voir les 3\s504 lieux sur la carte/ })).toHaveAttribute(
    'href',
    '/bienvenue/carte',
  )
})

test('sans lieux, le bloc ne s’affiche pas', () => {
  monter([])
  expect(screen.queryByText('Quelques lieux de la carte')).not.toBeInTheDocument()
})
