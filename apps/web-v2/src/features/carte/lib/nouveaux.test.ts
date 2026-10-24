/**
 * QUOI     — les nouveaux lieux : une lueur rouge, un fin anneau de cire qui part de la marque et
 *            s'efface, une taille qui suit le zoom, une gélule « NOUVEAU » de près seulement.
 */
import { expect, test } from 'vitest'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import {
  anneauNouveau,
  calqueAnneau,
  calqueGelule,
  calqueLueur,
  filtreAnneau,
  rayonAuZoom,
} from './nouveaux'

const c = { encre: '#494841', halo: '#fffaf2', cire: '#a94842' } as CouleursCarte

test('l’anneau naît transparent, se dessine en s’élargissant, puis s’efface : jamais d’un coup', () => {
  expect(anneauNouveau(0)).toEqual({ rayon: 14, opacite: 0 })
  expect(anneauNouveau(0.5)).toEqual({ rayon: 16, opacite: 0.8 })
  expect(anneauNouveau(1).rayon).toBe(18)
  expect(anneauNouveau(1).opacite).toBeCloseTo(0)
  expect(anneauNouveau(0.1).opacite).toBeLessThan(anneauNouveau(0.3).opacite)
})

test('la taille suit le zoom, avec la courbe au premier niveau (exigence de MapLibre)', () => {
  // La courbe des marques : la moitié de loin, 1,15 de près.
  expect(rayonAuZoom(10)).toEqual(['interpolate', ['linear'], ['zoom'], 4, 5, 8, 8, 12, 11.5])
})

test('un contour de cire seul, seulement pour les lieux nouveaux', () => {
  expect(calqueAnneau(c, 1)).toMatchObject({
    type: 'circle',
    filter: ['==', ['get', 'nouveau'], true],
    paint: { 'circle-opacity': 0, 'circle-stroke-color': '#a94842' },
  })
})

test('une lueur de cire floue sous la marque', () => {
  expect(calqueLueur(c, 1)).toMatchObject({
    type: 'circle',
    filter: ['==', ['get', 'nouveau'], true],
    paint: { 'circle-color': '#a94842', 'circle-blur': 1, 'circle-radius': rayonAuZoom(22) },
  })
})

test('la gélule « NOUVEAU », une seule image sous la marque, seulement de près', () => {
  expect(calqueGelule()).toMatchObject({
    type: 'symbol',
    minzoom: 9,
    filter: ['==', ['get', 'nouveau'], true],
    layout: { 'icon-image': 'gelule-nouveau', 'icon-anchor': 'top' },
  })
})

test('sans lieu à portée, l’anneau ne marque que les lieux neufs', () => {
  expect(filtreAnneau(null)).toEqual(['==', ['get', 'nouveau'], true])
})

test('un lieu à portée reçoit aussi l’anneau', () => {
  expect(filtreAnneau('a')).toEqual([
    'any',
    ['==', ['get', 'nouveau'], true],
    ['==', ['get', 'id'], 'a'],
  ])
})
