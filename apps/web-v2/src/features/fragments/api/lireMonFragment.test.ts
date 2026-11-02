/**
 * QUOI     — la lecture de `mon_fragment` (migrations 578 et 579) : l'état d'un Fragment pour moi.
 */
import { lireMonFragment } from './lireMonFragment'

test('un Fragment porté, avant la migration 579 : pas encore d’anecdotes', () => {
  expect(
    lireMonFragment({ etat: 'porte', scans: 2, numero: 37, porteurs: 112, signe: true }),
  ).toEqual({
    etat: 'porte',
    scans: 2,
    numero: 37,
    porteurs: 112,
    signe: true,
    anecdotes: [],
    restantes: 0,
    raresRestantes: 0,
  })
})

test('ses anecdotes trouvées et ce qui reste (migration 579)', () => {
  expect(
    lireMonFragment({
      etat: 'scanne',
      scans: 5,
      numero: null,
      porteurs: 112,
      signe: false,
      anecdotes: [{ texte: 'Elle va par trois.', rarete: 'commune' }],
      restantes: 6,
      raresRestantes: 1,
    }),
  ).toMatchObject({
    anecdotes: [{ texte: 'Elle va par trois.', rarete: 'commune' }],
    restantes: 6,
    raresRestantes: 1,
  })
})

test('un Fragment masqué donne null', () => {
  expect(lireMonFragment(null)).toBeNull()
})

test('un état inconnu lève', () => {
  expect(() =>
    lireMonFragment({ etat: 'x', scans: 0, numero: null, porteurs: 0, signe: false }),
  ).toThrow()
})
