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

test('un territoire donne ses morceaux, et son nom posé sur sa bordure', () => {
  const t: TerritoireRevendique = {
    id: 'lieu-1',
    nom: 'La Garde du Comté',
    moi: true,
    lieux: 3,
    morceaux: [[contour]],
    ancre: [0.5, 1],
    ids: ['lieu-1'],
  }
  const [forme, nom] = enGeoJSONTerritoires([t]).features
  expect(forme?.geometry).toEqual({ type: 'MultiPolygon', coordinates: [[contour]] })
  expect(nom?.geometry).toEqual({ type: 'Point', coordinates: [0.5, 1] })
  expect(nom?.properties).toEqual({ id: 'lieu-1', nom: 'La Garde du Comté', moi: true })
})
