/**
 * QUOI     — les énigmes en GeoJSON, et leurs deux calques : éclats de loin, sceaux de près.
 */
import { expect, test, vi } from 'vitest'
import { ajouterCalquesEnigmes, toileDesEnigmes, CALQUE_ECLATS, CALQUE_SCEAUX_ENIGMES, enGeoJSONEnigmes, SOURCE_ENIGMES, ZOOM_DES_SCEAUX } from './enigmes'

test('une énigme devient un point qui ne porte que son id', () => {
  const g = enGeoJSONEnigmes([{ id: 7, lat: 41, lng: 28.9 }])
  expect(g.features[0]?.geometry.coordinates).toEqual([28.9, 41])
  expect(g.features[0]?.properties).toEqual({ id: 7 })
})

test('de loin des éclats, de près des sceaux, sans regroupement', () => {
  const addSource = vi.fn()
  const addLayer = vi.fn()
  ajouterCalquesEnigmes({ addSource, addLayer }, 1)
  expect(addSource).toHaveBeenCalledWith(SOURCE_ENIGMES, expect.not.objectContaining({ cluster: true }))
  expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: CALQUE_ECLATS, maxzoom: ZOOM_DES_SCEAUX }))
  expect(addLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: CALQUE_SCEAUX_ENIGMES, minzoom: ZOOM_DES_SCEAUX }),
  )
})

test('sans OffscreenCanvas (iOS avant 16.4) : les sceaux se dessinent sur un canevas ordinaire', () => {
  vi.stubGlobal('OffscreenCanvas', undefined)
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  expect(() => toileDesEnigmes(36)).toThrow('canevas indisponible')
  expect(getContext).toHaveBeenCalledWith('2d')
  getContext.mockRestore()
  vi.unstubAllGlobals()
})
