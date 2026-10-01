import { expect, test } from 'vitest'
import { lireEnergie } from './lireEnergie'

test('la jauge en recharge, puis pleine', () => {
  expect(lireEnergie({ points: 7, max: 10, prochainDans: 1380, parPoint: 3600 })).toEqual({
    points: 7,
    max: 10,
    prochainDans: 1380,
    parPoint: 3600,
  })
  expect(
    lireEnergie({ points: 10, max: 10, prochainDans: null, parPoint: 3600 }).prochainDans,
  ).toBeNull()
})
