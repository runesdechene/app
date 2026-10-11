/**
 * QUOI     — la forme de ce que la vitrine lit : chaque champ prouvé, une sorte inconnue refusée.
 */
import { expect, test } from 'vitest'
import {
  lireActivite,
  lireApercu,
  lireChiffres,
  lireLieuxAuHasard,
  lireResultats,
} from './lireVitrine'
import { phraseActivite } from '../lib/activite'

test('les chiffres de l’accueil', () => {
  expect(lireChiffres([{ total_places: 3473, total_users: 4750 }])).toEqual({
    lieux: 3473,
    explorateurs: 4750,
  })
  expect(() => lireChiffres([])).toThrow()
})

test('une recherche : le total et les lieux trouvés', () => {
  const r = lireResultats({
    total: 37,
    lieux: [
      {
        id: 'd1',
        nom: 'Dolmen de la Chevresse',
        region: 'Nièvre',
        nature: { id: 'n', nom: 'Dolmens & mégalithes', icone: 'i.svg', couleur: '#8c3166' },
        vignette: null,
      },
    ],
  })
  expect(r.total).toBe(37)
  expect(r.lieux[0]?.region).toBe('Nièvre')
  expect(r.lieux[0]?.nature?.icone).toBe('i.svg')
})

test('l’activité se dit anonyme ; une sorte inconnue est refusée', () => {
  const [a] = lireActivite([
    { sorte: 'visite', quand: '2026-09-30T08:00:00Z', lieu: { id: 'x', nom: 'Fort des Têtes' } },
  ])
  expect(a && phraseActivite(a)).toEqual({
    debut: 'Un Compagnon vient de visiter ',
    lieu: 'Fort des Têtes',
  })
  expect(() => lireActivite([{ sorte: 'vol', quand: 'x', lieu: { id: 'y', nom: 'y' } }])).toThrow()
})

test('un aperçu : null pour un lieu qui n’est pas public', () => {
  expect(lireApercu(null)).toBeNull()
  expect(
    lireApercu({
      id: 'd1',
      nom: 'Dolmen',
      region: null,
      nature: null,
      epoque: null,
      photo: null,
      photos: 0,
      explorateurs: 3,
      extrait: 'Un début…',
      suite: true,
    })?.suite,
  ).toBe(true)
})

test('des lieux au hasard : le département et son numéro, qui l’a ajouté', () => {
  const [lieu, sansAuteur] = lireLieuxAuHasard([
    {
      id: 'l1',
      nom: 'Abbaye de Fontfroide',
      slug: 'abbaye-de-fontfroide',
      region: 'Aude',
      numero: '11',
      nature: { id: 'n1', nom: 'Sanctuaires', icone: null, couleur: '#6e487f' },
      photo: 'https://exemple.fr/photo.webp',
      auteur: { nom: 'Uriel', avatar: null },
    },
    {
      id: 'l2',
      nom: 'Kourion',
      slug: 'kourion',
      region: 'Chypre',
      numero: null,
      nature: null,
      photo: 'https://exemple.fr/k.webp',
      auteur: null,
    },
  ])
  expect(lieu).toEqual({
    id: 'l1',
    nom: 'Abbaye de Fontfroide',
    slug: 'abbaye-de-fontfroide',
    region: 'Aude',
    numero: '11',
    nature: { id: 'n1', nom: 'Sanctuaires', icone: null, couleur: '#6e487f' },
    photo: 'https://exemple.fr/photo.webp',
    auteur: { nom: 'Uriel', avatar: null },
  })
  expect(sansAuteur?.auteur).toBeNull()
  expect(sansAuteur?.numero).toBeNull()
})
