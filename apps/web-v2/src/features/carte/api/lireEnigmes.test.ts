/**
 * QUOI     — les lecteurs du JSON des énigmes : en attente, ouverture, verdict.
 */
import { expect, test } from 'vitest'
import { lireEnAttente, lireOuverture, lireVerdict } from './lireEnigmes'

test('en attente : seulement la place', () => {
  expect(lireEnAttente([{ id: 3, lat: 41, lng: 28.9 }])).toEqual([{ id: 3, lat: 41, lng: 28.9 }])
})

test('ouverture : une culture sans icône ni couleur reste lisible', () => {
  const o = lireOuverture({
    culture: { id: 'byzantine', nom: 'Byzantine', icone: null, couleur: null },
    recit: 'Justinien voulait…',
    question: 'Quel monument ?',
    format: 'qcm',
    choix: ['Sainte-Sophie', 'Sainte-Irène'],
    difficulte: 'easy',
  })
  expect(o.culture).toEqual({ id: 'byzantine', nom: 'Byzantine', icone: null, couleur: null })
  expect(o.choix).toEqual(['Sainte-Sophie', 'Sainte-Irène'])
})

test('ouverture : une réponse libre n’a pas de choix, un format inconnu devient libre', () => {
  const base = { culture: { id: 'r', nom: 'Rome', icone: null, couleur: '#c94436' }, recit: '', question: '?' }
  expect(lireOuverture({ ...base, format: 'free', choix: null }).choix).toBeNull()
  expect(lireOuverture({ ...base, format: 'autre', choix: null }).format).toBe('free')
})

test('verdict : le prochain titre peut manquer', () => {
  const v = lireVerdict({
    juste: true, reponse: 'Sainte-Sophie', explication: 'La coupole…', xp: 1, gagnes: 1,
    points: 16, total: 130, nouveauxTitres: ['Apprentie de Byzance'], prochain: null, resteEnAttente: 3,
    niveau: 12, avant: 0.62, apres: 0.64,
  })
  expect(v.prochain).toBeNull()
  expect(v.nouveauxTitres).toEqual(['Apprentie de Byzance'])
  expect(v.niveau).toEqual({ niveau: 12, avant: 0.62, apres: 0.64 })
})
