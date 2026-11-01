/**
 * QUOI     — les territoires sur la carte : l'anneau remis dans le sens trigonométrique (les
 *            pointillés vont dedans), et chaque territoire versé en contour plus point du nom.
 */
import { expect, test } from 'vitest'
import type { Coordonnees, TerritoireRevendique } from '../api/lireCarte'
import { enGeoJSONTerritoires, sensTrigonometrique } from './territoires'

const direct: Coordonnees[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
]

test('un anneau déjà dans le sens trigonométrique reste tel quel', () => {
  expect(sensTrigonometrique(direct)).toEqual(direct)
})

test('un anneau à l’envers est retourné', () => {
  expect(sensTrigonometrique([...direct].reverse())).toEqual(direct)
})

test('un territoire donne son contour et le point de son nom, avec à qui il est', () => {
  const t: TerritoireRevendique = {
    id: 'lieu-1',
    nom: 'La Garde du Comté',
    moi: true,
    lieux: 3,
    contour: [...direct].reverse(),
    etiquette: [0.5, 0],
  }
  const [contour, nom] = enGeoJSONTerritoires([t]).features
  expect(contour?.geometry).toEqual({ type: 'Polygon', coordinates: [direct] })
  expect(nom?.geometry).toEqual({ type: 'Point', coordinates: [0.5, 0] })
  expect(nom?.properties).toEqual({ nom: 'La Garde du Comté', moi: true })
})
