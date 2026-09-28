import { expect, test } from 'vitest'
import { couvrir, forme, Grille, jalons } from './dechirure'

test('un coup de doigt est un cercle cabossé, jamais plus grand que 1,2 fois le rayon', () => {
  const points = forme({ x: 100, y: 100 }, 20, () => 1)
  expect(points).toHaveLength(14)
  for (const p of points) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(24, 5)
})

test('un geste rapide est comblé : un jalon tous les « pas » pixels, jusqu’au point d’arrivée', () => {
  const j = jalons({ x: 0, y: 0 }, { x: 100, y: 0 }, 25)
  expect(j).toHaveLength(4)
  expect(j.at(-1)).toEqual({ x: 100, y: 0 })
})

test('une photo en paysage dans un cadre en portrait garde son milieu', () => {
  const partie = couvrir({ l: 1600, h: 900 }, { l: 390, h: 844 })
  expect(partie.y).toBe(0)
  expect(partie.h).toBe(900)
  expect(partie.l).toBeCloseTo(415.88, 1)
  expect(partie.x).toBeCloseTo(592.06, 1)
})

test('la part grattée monte à mesure qu’on gratte', () => {
  const grille = new Grille(96, 96, 24) // 4 × 4 cases
  expect(grille.part()).toBe(0)
  grille.gratter({ x: 12, y: 12 }, 1) // le centre de la première case
  expect(grille.part()).toBe(1 / 16)
  grille.gratter({ x: 48, y: 48 }, 200)
  expect(grille.part()).toBe(1)
})
