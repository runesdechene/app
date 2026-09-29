/**
 * QUOI     — un cœur de plus tombe sur le bon mot, qu'il soit un mot ou une réponse.
 */
import { expect, test } from 'vitest'
import type { Mot } from '../api/lireLieu'
import { coeurDePlus } from './carnet'

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

test('un cœur de plus, sur le mot visé seulement', () => {
  const carnet = { total: 3, mots: [mot(1, [mot(2)]), mot(3)] }
  const apres = coeurDePlus(carnet, 2)
  expect(apres.mots[0]?.coeurs).toBe(2)
  expect(apres.mots[0]?.reponses[0]).toMatchObject({ coeurs: 3, miens: 1 })
  expect(apres.mots[1]?.coeurs).toBe(2)
})
