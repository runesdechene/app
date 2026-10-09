import { expect, test } from 'vitest'
import { estLaSuite } from './suite'

const m = (id: string, quand: string) => ({ auteur: { id }, quand })

test('la même personne, moins de dix minutes après : la suite', () => {
  expect(estLaSuite(m('a', '2026-09-28T09:00:00Z'), m('a', '2026-09-28T09:09:00Z'))).toBe(true)
})

test('une autre personne, un silence, ou le premier message : un nouveau bloc', () => {
  expect(estLaSuite(m('a', '2026-09-28T09:00:00Z'), m('b', '2026-09-28T09:01:00Z'))).toBe(false)
  expect(estLaSuite(m('a', '2026-09-28T09:00:00Z'), m('a', '2026-09-28T09:10:00Z'))).toBe(false)
  expect(estLaSuite(undefined, m('a', '2026-09-28T09:00:00Z'))).toBe(false)
})
