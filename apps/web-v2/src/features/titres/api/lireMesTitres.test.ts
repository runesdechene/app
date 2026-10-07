/**
 * QUOI     — la lecture de get_mes_titres (migration 430).
 */
import { expect, test } from 'vitest'
import { lireMesTitres } from './lireMesTitres'

const brut = {
  obtenus: 3,
  total: 20,
  chemins: [
    {
      stat: 'places_visited',
      compteur: 60,
      titres: [
        { id: 25, nom: 'Pèlerin', min: 10, obtenu: true, porte: false },
        { id: 32, nom: 'Errant', min: 150, obtenu: false, porte: false },
      ],
    },
  ],
  // La base d'avant la migration 433 envoie encore cette clé : on ne la lit plus.
  autreEpoque: [{ id: 9, nom: 'Banneret', condition: 'cassée', porte: false }],
}

test('les chemins se lisent', () => {
  const t = lireMesTitres(brut)
  expect(t.obtenus).toBe(3)
  expect(t.chemins[0]?.titres[1]).toEqual({
    id: 32,
    nom: 'Errant',
    min: 150,
    obtenu: false,
    porte: false,
  })
})

test('les titres d’une autre époque ne se lisent plus', () => {
  expect('autreEpoque' in lireMesTitres(brut)).toBe(false)
})

test('un JSON mal formé lève une erreur', () => {
  expect(() => lireMesTitres({ obtenus: 'trois' })).toThrow()
})

test('les cultures deviennent des chemins de connaissance, Polymathe à part', () => {
  const t = lireMesTitres({
    obtenus: 1, total: 41, chemins: [],
    cultures: [{ id: 'byzantine', nom: 'Byzance', icone: null, couleur: null, points: 5, total: 130,
      titres: [{ id: 300, nom: 'Curieuse de Byzance', min: 1, obtenu: true, porte: false }] }],
    polymathe: { id: 199, nom: 'Polymathe', compteur: 0, obtenu: false, porte: false },
  })
  expect(t.cultures[0]).toEqual({ id: 'byzantine', nom: 'Byzance', chemin: { stat: 'connaissance', compteur: 5,
    titres: [{ id: 300, nom: 'Curieuse de Byzance', min: 1, obtenu: true, porte: false }] } })
  expect(t.polymathe).toEqual({ stat: 'polymathe', compteur: 0,
    titres: [{ id: 199, nom: 'Polymathe', min: 3, obtenu: false, porte: false }] })
})

test('une base sans énigmes encore : pas de cultures, pas de Polymathe', () => {
  const t = lireMesTitres({ obtenus: 0, total: 0, chemins: [] })
  expect(t.cultures).toEqual([])
  expect(t.polymathe).toBeNull()
})
