import { expect, test, vi } from 'vitest'
import { presence } from './presence'

test('la dernière connexion, et la région seulement si elle est montrée', () => {
  vi.useFakeTimers({ now: new Date('2026-09-28T20:00:00Z') })
  const avant = '2026-09-25T20:00:00Z'
  expect(presence({ derniereConnexion: avant, region: 'Finistère' })?.replace(/\s/g, ' ')).toBe(
    'Dernière connexion il y a 3 j (Finistère)',
  )
  expect(presence({ derniereConnexion: avant, region: null })?.replace(/\s/g, ' ')).toBe(
    'Dernière connexion il y a 3 j',
  )
  expect(presence({ derniereConnexion: null, region: null })).toBeUndefined()
  vi.useRealTimers()
})
