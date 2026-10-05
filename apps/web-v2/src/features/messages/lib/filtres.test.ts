import { expect, test } from 'vitest'
import { FILTRES_FIXES, garderFiltres, lireFiltres } from './filtres'

const FIXES = [...FILTRES_FIXES]

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
  expect([...lireFiltres(stockage(null), FIXES)]).toEqual(FIXES)
  expect([...lireFiltres(null, FIXES)]).toEqual(FIXES)
})

test('le choix gardé revient, et seulement des filtres connus', () => {
  expect([...lireFiltres(stockage('["general","inconnu","activite"]'), FIXES)]).toEqual([
    'general',
    'activite',
  ])
})

test('un choix illisible ou vide : tous les filtres cochés', () => {
  expect([...lireFiltres(stockage('pas du json'), FIXES)]).toEqual(FIXES)
  expect([...lireFiltres(stockage('[]'), FIXES)]).toEqual(FIXES)
})

test('garder puis relire rend le même choix', () => {
  const s = stockage(null)
  garderFiltres(s, new Set(['bugs']), FIXES)
  expect([...lireFiltres(s, FIXES)]).toEqual(['bugs'])
})

test('une Compagnie quittée sort du choix gardé', () => {
  expect([...lireFiltres(stockage('["general","f-parti"]'), [...FIXES, 'f-lys'])]).toEqual([
    'general',
    'f-lys',
  ])
})

test('une Compagnie rejointe depuis le dernier choix arrive cochée ; une décochée le reste', () => {
  const s = stockage(null)
  garderFiltres(s, new Set(['general']), [...FIXES, 'f-lys'])
  const apres = lireFiltres(s, [...FIXES, 'f-lys', 'f-neuve'])
  expect(apres.has('f-neuve')).toBe(true)
  expect(apres.has('f-lys')).toBe(false)
})
