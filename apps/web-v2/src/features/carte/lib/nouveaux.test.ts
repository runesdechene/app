/**
 * QUOI     — les nouveaux lieux : une lumière dorée, un fin anneau d'or qui part de la marque et
 *            s'efface, deux étincelles qui scintillent tour à tour, une taille qui suit le zoom, une
 *            gélule d'encre sous la marque.
 */
import { expect, test } from 'vitest'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import {
  anneauNouveau,
  calqueAnneau,
  calqueAura,
  calqueGelule,
  calquesEtincelles,
  eclatEtincelle,
  filtreAnneau,
  rayonAuZoom,
} from './nouveaux'

const c = { encre: '#494841', halo: '#fffaf2', or: '#dea83d' } as CouleursCarte

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

test('un contour d’or seul, seulement pour les lieux nouveaux', () => {
  expect(calqueAnneau(c, 1)).toMatchObject({
    type: 'circle',
    filter: ['==', ['get', 'nouveau'], true],
    paint: { 'circle-opacity': 0, 'circle-stroke-color': '#dea83d' },
  })
})

test('une lumière dorée floue, deux fois et demie la marque', () => {
  expect(calqueAura(c, 1)).toMatchObject({
    type: 'circle',
    filter: ['==', ['get', 'nouveau'], true],
    paint: { 'circle-color': '#dea83d', 'circle-blur': 1, 'circle-radius': rayonAuZoom(32) },
  })
})

test('deux étincelles d’or, en haut à droite de la marque', () => {
  const etincelles = calquesEtincelles(1)
  expect(etincelles).toHaveLength(2)
  for (const e of etincelles) {
    expect(e).toMatchObject({ type: 'symbol', layout: { 'icon-image': 'etincelle' } })
  }
})

test('les étincelles scintillent tour à tour, sans jamais s’éteindre', () => {
  expect(eclatEtincelle(0)).toBeCloseTo(0.3)
  expect(eclatEtincelle(0.5)).toBe(1)
  // La seconde, une demi-période plus tard, brille quand la première pâlit.
  expect(eclatEtincelle(0 + 0.5)).toBeGreaterThan(eclatEtincelle(0))
})

test('la gélule « NOUVEAU », une seule image, se pose sous la marque (à la place du nom), même de très loin', () => {
  expect('minzoom' in calqueGelule()).toBe(false)
  expect(calqueGelule()).toMatchObject({
    type: 'symbol',
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
