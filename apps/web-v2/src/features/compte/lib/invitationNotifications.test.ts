/**
 * QUOI     — quand inviter aux notifications : un téléphone qui le peut, à qui on ne l'a jamais
 *            demandé, que le joueur n'a pas coupé, et pas dans la semaine qui suit « Plus tard ».
 */
import { expect, test } from 'vitest'
import { aInviter, SEMAINE } from './invitationNotifications'

const MAINTENANT = 1_000_000_000_000
const jamais = {
  push: 'possible',
  permission: 'default',
  coupe: false,
  plusTardLe: null,
  maintenant: MAINTENANT,
} as const

test('un téléphone à qui on ne l’a jamais demandé est invité', () => {
  expect(aInviter(jamais)).toBe(true)
})

test('pas d’invitation si le téléphone a déjà répondu, ou ne le peut pas', () => {
  expect(aInviter({ ...jamais, permission: 'granted' })).toBe(false) // retablir s'en charge
  expect(aInviter({ ...jamais, permission: 'denied' })).toBe(false)
  expect(aInviter({ ...jamais, push: 'installer-d-abord' })).toBe(false)
  expect(aInviter({ ...jamais, push: 'impossible' })).toBe(false)
  expect(aInviter({ ...jamais, coupe: true })).toBe(false)
})

test('« Plus tard » la repousse d’une semaine', () => {
  expect(aInviter({ ...jamais, plusTardLe: MAINTENANT - SEMAINE + 1 })).toBe(false)
  expect(aInviter({ ...jamais, plusTardLe: MAINTENANT - SEMAINE })).toBe(true)
})
