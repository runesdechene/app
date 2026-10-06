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
  autreEpoque: [
    { id: 1, nom: 'Novice', condition: { stat: 'discoveries', min: 0 }, porte: true },
    { id: 9, nom: 'Banneret', condition: 'cassée', porte: false },
  ],
}

test('les chemins et l’autre époque se lisent', () => {
  const t = lireMesTitres(brut)
  expect(t.obtenus).toBe(3)
  expect(t.chemins[0]?.titres[1]).toEqual({
    id: 32,
    nom: 'Errant',
    min: 150,
    obtenu: false,
    porte: false,
  })
  expect(t.autreEpoque[0]).toEqual({
    id: 1,
    nom: 'Novice',
    condition: { stat: 'discoveries', min: 0 },
    porte: true,
  })
})

test('une condition illisible n’empêche pas de lire le titre', () => {
  expect(lireMesTitres(brut).autreEpoque[1]?.condition).toBeNull()
})

test('un JSON mal formé lève une erreur', () => {
  expect(() => lireMesTitres({ obtenus: 'trois' })).toThrow()
})
