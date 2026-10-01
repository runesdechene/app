import { expect, test } from 'vitest'
import { VERSION } from './version'

test('la version : son nom, puis son numéro', () => {
  expect(VERSION).toMatch(/^Pythéas \d+\.\d+\.\d+$/)
})
