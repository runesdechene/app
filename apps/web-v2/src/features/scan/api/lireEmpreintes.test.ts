/**
 * QUOI     — la lecture du JSON de `empreintes_du_scan` (migration 474).
 */
import { expect, test } from 'vitest'
import { lireEmpreintes } from './lireEmpreintes'

test('un Fragment et ses empreintes', () => {
  expect(
    lireEmpreintes([
      {
        id: 11,
        nom: 'Hoplite',
        illustration: 'https://x/h.png',
        empreintes: [{ id: 3, source: 'vue', vecteur: [0.1, 0.2] }],
      },
    ]),
  ).toEqual([
    {
      id: 11,
      nom: 'Hoplite',
      illustration: 'https://x/h.png',
      empreintes: [{ id: 3, source: 'vue', vecteur: [0.1, 0.2] }],
    },
  ])
})

test('une illustration absente reste null ; une liste vide reste vide', () => {
  expect(
    lireEmpreintes([{ id: 1, nom: 'A', illustration: null, empreintes: [] }])[0]?.illustration,
  ).toBeNull()
  expect(lireEmpreintes([])).toEqual([])
})

test('une source inconnue est refusée', () => {
  expect(() =>
    lireEmpreintes([
      {
        id: 1,
        nom: 'A',
        illustration: null,
        empreintes: [{ id: 1, source: 'mockup', vecteur: [] }],
      },
    ]),
  ).toThrow()
})
