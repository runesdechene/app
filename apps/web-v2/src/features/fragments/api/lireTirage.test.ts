/**
 * QUOI     — la lecture de `tirer_anecdote` (migration 579).
 */
import { lireTirage } from './lireTirage'

test('une anecdote gratuite', () => {
  expect(
    lireTirage({
      anecdote: { id: 3, texte: 'Une rare.', rarete: 'rare' },
      raison: 'gratuite',
      restantes: 5,
      raresRestantes: 0,
      premiereDecouverte: true,
    }),
  ).toEqual({
    anecdote: { texte: 'Une rare.', rarete: 'rare' },
    raison: 'gratuite',
    restantes: 5,
    raresRestantes: 0,
    premiereDecouverte: true,
  })
})

test('rien de nouveau aujourd’hui', () => {
  expect(
    lireTirage({
      anecdote: null,
      raison: 'deja_aujourdhui',
      restantes: 2,
      raresRestantes: 1,
      premiereDecouverte: false,
    }),
  ).toMatchObject({ anecdote: null, raison: 'deja_aujourdhui' })
})

test('une raison inconnue lève', () => {
  expect(() =>
    lireTirage({
      anecdote: null,
      raison: 'x',
      restantes: 0,
      raresRestantes: 0,
      premiereDecouverte: false,
    }),
  ).toThrow()
})
