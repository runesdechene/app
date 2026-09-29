/**
 * QUOI     — mon cœur sur un mot s'allume puis s'éteint, sur le bon mot, réponses comprises.
 */
import { expect, test } from 'vitest'
import type { Mot } from '../api/lireLieu'
import { basculerCoeur } from './carnet'

const mot = (id: number, reponses: Mot[] = []): Mot => ({
  id,
  quand: '2026-09-30T08:00:00Z',
  texte: 'Un mot',
  qui: { id: 'k', nom: 'Kelpie', avatar: null },
  venu: false,
  photos: [],
  coeurs: 2,
  miens: 0,
  aMoi: false,
  reponses,
})

test('un cœur s’allume puis s’éteint, sur le mot visé seulement', () => {
  const carnet = { total: 3, mots: [mot(1, [mot(2)]), mot(3)] }
  const allume = basculerCoeur(carnet, 2)
  expect(allume.mots[0]?.reponses[0]).toMatchObject({ coeurs: 3, miens: 1 })
  expect(allume.mots[1]?.coeurs).toBe(2)
  const eteint = basculerCoeur(allume, 2)
  expect(eteint.mots[0]?.reponses[0]).toMatchObject({ coeurs: 2, miens: 0 })
})
