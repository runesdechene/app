import { expect, test } from 'vitest'
import { explorateur, phraseAttache } from './accord'

test('Explorateur ou Exploratrice, selon le genre choisi', () => {
  expect(explorateur('m')).toBe('Explorateur')
  expect(explorateur('f')).toBe('Exploratrice')
})

test('un département garde son article officiel', () => {
  const alpes = { nom: 'des Alpes-Maritimes', estUnPays: false, silhouette: null }
  expect(phraseAttache(alpes, 'm')).toBe('Noble Explorateur des Alpes-Maritimes')
  expect(phraseAttache(alpes, 'f')).toBe('Noble Exploratrice des Alpes-Maritimes')
})

test('un pays se pose après un point', () => {
  expect(phraseAttache({ nom: 'Italie', estUnPays: true, silhouette: null }, 'm')).toBe(
    'Noble Explorateur · Italie',
  )
})
