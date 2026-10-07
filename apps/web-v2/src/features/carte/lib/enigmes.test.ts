/**
 * QUOI     — les énigmes en GeoJSON, leurs deux calques (éclats de loin, sceaux de près) et l'onde qui
 *            rayonne dessous.
 */
import { expect, test, vi } from 'vitest'
import { ajouterCalquesEnigmes, toileDesEnigmes, onde, CALQUE_ONDES_ENIGMES, CALQUE_ECLATS, CALQUE_SCEAUX_ENIGMES, enGeoJSONEnigmes, SOURCE_ENIGMES, ZOOM_DES_SCEAUX } from './enigmes'

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

test('une onde rayonne sous les éclats et les sceaux', () => {
  const addLayer = vi.fn<(c: { id: string }) => void>()
  ajouterCalquesEnigmes({ addSource: vi.fn(), addLayer }, 1)
  expect(addLayer.mock.calls[0]?.[0].id).toBe(CALQUE_ONDES_ENIGMES)
  expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: CALQUE_ONDES_ENIGMES, type: 'circle' }))
})

test('l’onde part de la marque, s’élargit et s’efface', () => {
  expect(onde(0)).toEqual({ part: 0, opacite: 0.5 })
  expect(onde(0.5).part).toBe(0.5)
  expect(onde(0.5).opacite).toBeLessThan(0.5)
  expect(onde(1).opacite).toBe(0)
})
