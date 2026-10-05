import { expect, test } from 'vitest'
import { FILTRES, garderFiltres, lireFiltres } from './filtres'

function stockage(valeur: string | null) {
  const donnees = new Map<string, string>()
  if (valeur !== null) donnees.set('explore-v2:registre:filtres', valeur)
  return {
    getItem: (cle: string) => donnees.get(cle) ?? null,
    setItem: (cle: string, v: string) => {
      donnees.set(cle, v)
    },
  }
}

test('rien de gardé : tous les filtres cochés', () => {
  expect([...lireFiltres(stockage(null))]).toEqual([...FILTRES])
  expect([...lireFiltres(null)]).toEqual([...FILTRES])
})

test('le choix gardé revient, et seulement des filtres connus', () => {
  expect([...lireFiltres(stockage('["general","inconnu","activite"]'))]).toEqual([
    'general',
    'activite',
  ])
})

test('un choix illisible ou vide : tous les filtres cochés', () => {
  expect([...lireFiltres(stockage('pas du json'))]).toEqual([...FILTRES])
  expect([...lireFiltres(stockage('[]'))]).toEqual([...FILTRES])
})

test('garder puis relire rend le même choix', () => {
  const s = stockage(null)
  garderFiltres(s, new Set(['bugs'] as const))
  expect([...lireFiltres(s)]).toEqual(['bugs'])
})
