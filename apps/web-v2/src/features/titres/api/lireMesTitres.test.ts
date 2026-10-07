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

test('les connaissances ne sont pas des titres : « Tous les titres » ignore cultures et Polymathe (mig 452)', () => {
  const t = lireMesTitres({
    obtenus: 1, total: 4, chemins: [],
    cultures: [{ id: 'byzantine', nom: 'Byzance', icone: null, couleur: null, points: 5, total: 130, titres: [] }],
    polymathe: { id: 199, nom: 'Polymathe', compteur: 0, obtenu: false, porte: false },
  })
  expect(t).toEqual({ obtenus: 1, total: 4, chemins: [] })
})
