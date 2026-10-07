/**
 * QUOI     — la clé VAPID en octets, et ce que permet le téléphone (push possible, appli à
 *            installer d'abord sur iPhone, ou rien).
 */
import { expect, test } from 'vitest'
import { cleEnOctets, quelPush } from './push'

test('la clé publique, du base64 « url » vers des octets', () => {
  expect([...cleEnOctets('AQID')]).toEqual([1, 2, 3])
  expect([...cleEnOctets('-_8')]).toEqual([251, 255])
})

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/129'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'

test('ce que permet le téléphone', () => {
  const tout = { aLePush: true, installee: false }
  expect(quelPush({ ...tout, userAgent: ANDROID })).toBe('possible')
  expect(quelPush({ ...tout, userAgent: IPHONE })).toBe('installer-d-abord')
  expect(quelPush({ ...tout, userAgent: IPHONE, installee: true })).toBe('possible')
  expect(quelPush({ aLePush: false, installee: false, userAgent: ANDROID })).toBe('impossible')
  expect(quelPush({ aLePush: false, installee: true, userAgent: IPHONE })).toBe('impossible')
})
