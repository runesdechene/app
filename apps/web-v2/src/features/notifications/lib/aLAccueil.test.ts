/**
 * QUOI     — la dernière mise à jour se montre sur la page Explore si elle a moins de 14 jours ou
 *            n'est pas encore lue ; sinon, rien.
 */
import { expect, test } from 'vitest'
import type { MiseAJour } from '../api/nouveautes'
import { aMontrerALAccueil } from './aLAccueil'

const maintenant = new Date('2026-10-20T12:00:00Z')
const note = (jours: number, lue: boolean): MiseAJour => ({
  id: 1,
  titre: 'Remonte le temps',
  texte: '',
  quand: new Date(maintenant.getTime() - jours * 86_400_000).toISOString(),
  image: null,
  version: null,
  coeurs: 0,
  miens: 0,
  mots: 0,
  aMoi: false,
  lue,
})

test('récente : elle se montre, lue ou non', () => {
  expect(aMontrerALAccueil([note(3, true)], maintenant)?.id).toBe(1)
  expect(aMontrerALAccueil([note(13, true)], maintenant)?.id).toBe(1)
})

test('ancienne : seulement si elle n’est pas encore lue', () => {
  expect(aMontrerALAccueil([note(15, true)], maintenant)).toBeNull()
  expect(aMontrerALAccueil([note(40, false)], maintenant)?.id).toBe(1)
})

test('aucune note : rien', () => {
  expect(aMontrerALAccueil([], maintenant)).toBeNull()
})
