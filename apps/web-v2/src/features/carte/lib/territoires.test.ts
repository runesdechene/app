/**
 * QUOI     — la forme des territoires : chaque territoire versé en morceaux (contour et enclaves).
 */
import { expect, test } from 'vitest'
import type { Coordonnees, TerritoireRevendique } from '../api/lireCarte'
import { enGeoJSONTerritoires } from './territoires'

const contour: Coordonnees[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
]

test('un territoire donne ses morceaux, et s’il est à moi', () => {
  const t: TerritoireRevendique = {
    id: 'lieu-1',
    nom: 'La Garde du Comté',
    moi: true,
    lieux: 3,
    morceaux: [[contour]],
    ancre: [0.5, 1],
    ids: ['lieu-1'],
    compagnons: 0,
    joueur: { id: 'u1', nom: 'Uriel', avatar: null, niveau: 23, titre: null, signe: null },
  }
  const [forme] = enGeoJSONTerritoires([t]).features
  expect(forme?.geometry).toEqual({ type: 'MultiPolygon', coordinates: [[contour]] })
  expect(forme?.properties).toEqual({ moi: true })
})
