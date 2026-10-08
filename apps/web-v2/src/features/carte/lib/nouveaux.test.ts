/**
 * QUOI     — les nouveaux lieux : une onde qui part de la marque et s'efface, à la couleur de la
 *            nature (l'encre de cire à défaut), une taille qui suit le zoom, une gélule au-dessus.
 */
import { expect, test } from 'vitest'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { calqueGelule, calquesNouveaux, ondeNouveau, rayonAuZoom } from './nouveaux'

const c = { cire: '#a94842', halo: '#fffaf2' } as CouleursCarte

test('l’onde part du bord de la marque, s’élargit et s’efface', () => {
  expect(ondeNouveau(0)).toEqual({ rayon: 13, opacite: 0.5 })
  expect(ondeNouveau(1)).toEqual({ rayon: 29, opacite: 0 })
  expect(ondeNouveau(0.5).opacite).toBeLessThan(ondeNouveau(0).opacite)
})

test('la taille suit le zoom, avec la courbe au premier niveau (exigence de MapLibre)', () => {
  expect(rayonAuZoom(10)).toEqual(['interpolate', ['linear'], ['zoom'], 4, 5, 8, 8, 12, 11.5])
})

test('halo et onde : seulement les lieux nouveaux, à la couleur de leur nature', () => {
  for (const calque of calquesNouveaux(c, 1)) {
    expect(calque).toMatchObject({
      type: 'circle',
      filter: ['==', ['get', 'nouveau'], true],
      paint: { 'circle-color': ['coalesce', ['get', 'couleur'], '#a94842'] },
    })
  }
})

test('la gélule « NOUVEAU » se pose sous la marque (sous la pilule si le lieu en a une), et seulement de près', () => {
  expect(calqueGelule(c)).toMatchObject({
    type: 'symbol',
    minzoom: 9,
    filter: ['==', ['get', 'nouveau'], true],
    layout: { 'text-anchor': 'top' },
  })
})
