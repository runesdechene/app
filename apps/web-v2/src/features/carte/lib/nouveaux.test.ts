/**
 * QUOI     — les nouveaux lieux : un fin anneau d'encre qui part de la marque et s'efface, une taille
 *            qui suit le zoom, une gélule d'encre sous la marque.
 */
import { expect, test } from 'vitest'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { anneauNouveau, calqueAnneau, calqueGelule, rayonAuZoom } from './nouveaux'

const c = { encre: '#494841', halo: '#fffaf2' } as CouleursCarte

test('l’anneau naît transparent, se dessine en s’élargissant, puis s’efface : jamais d’un coup', () => {
  expect(anneauNouveau(0)).toEqual({ rayon: 14, opacite: 0 })
  expect(anneauNouveau(0.5)).toEqual({ rayon: 18, opacite: 0.8 })
  expect(anneauNouveau(1).rayon).toBe(22)
  expect(anneauNouveau(1).opacite).toBeCloseTo(0)
  expect(anneauNouveau(0.1).opacite).toBeLessThan(anneauNouveau(0.3).opacite)
})

test('la taille suit le zoom, avec la courbe au premier niveau (exigence de MapLibre)', () => {
  // De loin, il garde 80 % de sa taille (les autres lieux tombent à 50 %).
  expect(rayonAuZoom(10)).toEqual(['interpolate', ['linear'], ['zoom'], 4, 8, 8, 10, 12, 11.5])
})

test('un contour d’encre seul, seulement pour les lieux nouveaux', () => {
  expect(calqueAnneau(c, 1)).toMatchObject({
    type: 'circle',
    filter: ['==', ['get', 'nouveau'], true],
    paint: { 'circle-opacity': 0, 'circle-stroke-color': '#494841' },
  })
})

test('la gélule « NOUVEAU », à l’encre, se pose sous la marque, et seulement de près', () => {
  expect(calqueGelule(c)).toMatchObject({
    type: 'symbol',
    minzoom: 9,
    filter: ['==', ['get', 'nouveau'], true],
    layout: { 'text-anchor': 'top' },
    paint: { 'icon-color': '#494841', 'text-color': '#fffaf2' },
  })
})
