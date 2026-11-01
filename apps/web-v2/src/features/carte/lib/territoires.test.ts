/**
 * QUOI     — les territoires sur la carte : chaque territoire versé en morceaux (contour et
 *            enclaves) plus le point de son nom.
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

test('un territoire donne ses morceaux et le point de son nom, avec à qui il est', () => {
  const t: TerritoireRevendique = {
    id: 'lieu-1',
    nom: 'La Garde du Comté',
    moi: true,
    lieux: 3,
    morceaux: [[contour]],
    etiquette: [0.5, 0],
  }
  const [forme, nom] = enGeoJSONTerritoires([t]).features
  expect(forme?.geometry).toEqual({ type: 'MultiPolygon', coordinates: [[contour]] })
  expect(nom?.geometry).toEqual({ type: 'Point', coordinates: [0.5, 0] })
  expect(nom?.properties).toEqual({ nom: 'La Garde du Comté', moi: true })
})
