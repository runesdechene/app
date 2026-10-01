import { expect, test } from 'vitest'
import { lireEnergie } from './lireEnergie'

const regle = { gratuitKm: 100, palier1Km: 500, palier2Km: 1500, cout1: 1, cout2: 2, cout3: 3 }

test('la jauge en recharge, puis pleine, avec la règle du moment', () => {
  expect(lireEnergie({ points: 7, max: 10, prochainDans: 1380, parPoint: 3600, regle })).toEqual({
    points: 7,
    max: 10,
    prochainDans: 1380,
    parPoint: 3600,
    regle,
  })
  expect(
    lireEnergie({ points: 10, max: 10, prochainDans: null, parPoint: 3600, regle }).prochainDans,
  ).toBeNull()
})
