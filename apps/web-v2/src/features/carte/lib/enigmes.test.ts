/**
 * QUOI     — les énigmes en GeoJSON, leur calque de sceaux et l'onde qui rayonne dessous.
 */
import { expect, test, vi } from 'vitest'
import { ajouterCalquesEnigmes, toileDesEnigmes, onde, sansLEnigme, tailleDuSceau, CALQUE_ONDES_ENIGMES, CALQUE_SCEAUX_ENIGMES, enGeoJSONEnigmes, SOURCE_ENIGMES } from './enigmes'

test('une énigme devient un point qui ne porte que son id', () => {
  const g = enGeoJSONEnigmes([{ id: 7, lat: 41, lng: 28.9 }])
  expect(g.features[0]?.geometry.coordinates).toEqual([28.9, 41])
  expect(g.features[0]?.properties).toEqual({ id: 7 })
})

test('le sceau « ? » à tous les zooms, sans regroupement : on le touche même dézoomé (Uriel, 07/10)', () => {
  const addSource = vi.fn()
  const addLayer = vi.fn<(c: { id: string; minzoom?: number; maxzoom?: number }) => void>()
  ajouterCalquesEnigmes({ addSource, addLayer }, 1)
  expect(addSource).toHaveBeenCalledWith(SOURCE_ENIGMES, expect.not.objectContaining({ cluster: true }))
  expect(addLayer.mock.calls.map(([c]) => c.id)).toEqual([CALQUE_ONDES_ENIGMES, CALQUE_SCEAUX_ENIGMES])
  const sceaux = addLayer.mock.calls[1]?.[0]
  expect(sceaux?.minzoom).toBeUndefined()
  expect(sceaux?.maxzoom).toBeUndefined()
})

test('sans OffscreenCanvas (iOS avant 16.4) : les sceaux se dessinent sur un canevas ordinaire', () => {
  vi.stubGlobal('OffscreenCanvas', undefined)
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  expect(() => toileDesEnigmes(36)).toThrow('canevas indisponible')
  expect(getContext).toHaveBeenCalledWith('2d')
  getContext.mockRestore()
  vi.unstubAllGlobals()
})

test('une onde rayonne sous les sceaux', () => {
  const addLayer = vi.fn<(c: { id: string; paint?: object }) => void>()
  ajouterCalquesEnigmes({ addSource: vi.fn(), addLayer }, 1)
  expect(addLayer.mock.calls[0]?.[0].id).toBe(CALQUE_ONDES_ENIGMES)
  expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: CALQUE_ONDES_ENIGMES, type: 'circle' }))
  // Changée à chaque image, l'onde ne doit pas glisser en plus (300 ms par défaut) : elle saccaderait.
  expect(addLayer.mock.calls[0]?.[0].paint).toMatchObject({
    'circle-radius-transition': { duration: 0, delay: 0 },
    'circle-opacity-transition': { duration: 0, delay: 0 },
  })
})

test('l’onde part de la marque, s’élargit et s’efface', () => {
  expect(onde(0)).toEqual({ part: 0, opacite: 0.5 })
  expect(onde(0.5).part).toBe(0.5)
  expect(onde(0.5).opacite).toBeLessThan(0.5)
  expect(onde(1).opacite).toBe(0)
})

test('l’énigme touchée quitte la carte le temps qu’elle se retourne au-dessus', () => {
  expect(sansLEnigme(7)).toEqual(['!=', ['get', 'id'], 7])
  expect(sansLEnigme(null)).toBeNull()
})

test('dézoomé, le sceau est tout petit ; il grandit avec le zoom (Uriel, 07/10)', () => {
  expect(tailleDuSceau(1)).toEqual(['interpolate', ['linear'], ['zoom'], 3, 0.4, 6, 1])
})
