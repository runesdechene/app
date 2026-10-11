/**
 * QUOI     — une mise à jour se lit avec ses cœurs, les miens, son nombre de mots et si elle est à
 *            moi (mig 478) ; une base d'avant la 478 se lit à zéro.
 */
import { expect, test } from 'vitest'
import { lireMisesAJour } from './nouveautes'

const note = {
  id: 7,
  titre: 'Remonte le temps',
  texte: 'Un texte.',
  quand: '2026-10-11T10:00:00Z',
  image: null,
  version: 'Pythéas 1.16.0',
}

test('ses cœurs, les miens, ses mots, si elle est à moi', () => {
  expect(lireMisesAJour([{ ...note, coeurs: 12, miens: 3, mots: 4, aMoi: true, lue: false }])[0]).toMatchObject({
    lue: false,
    coeurs: 12,
    miens: 3,
    mots: 4,
    aMoi: true,
  })
})

test('avant la 478 : rien encore', () => {
  expect(lireMisesAJour([note])[0]).toMatchObject({ coeurs: 0, miens: 0, mots: 0, aMoi: false, lue: true })
})
