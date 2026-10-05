/**
 * QUOI     — ceux qui ont enrichi le récit, et la liaison entre leurs noms.
 */
import { expect, test } from 'vitest'
import { enrichisseurs, liaison } from './credit'

const p = (id: string) => ({ id, nom: id.toUpperCase(), avatar: null })

test('ceux qui ont enrichi le récit : tous sauf l’auteur du lieu', () => {
  expect(enrichisseurs([p('luna'), p('matheo'), p('aelis')], 'luna').map((x) => x.id)).toEqual([
    'matheo',
    'aelis',
  ])
  expect(enrichisseurs([p('luna')], 'luna')).toEqual([])
  expect(enrichisseurs([p('matheo')], null).map((x) => x.id)).toEqual(['matheo'])
})

test('les noms se lient : « A », « A et B », « A, B et C »', () => {
  expect([0].map((i) => liaison(i, 1))).toEqual([''])
  expect([0, 1].map((i) => liaison(i, 2))).toEqual(['', ' et '])
  expect([0, 1, 2].map((i) => liaison(i, 3))).toEqual(['', ', ', ' et '])
})
