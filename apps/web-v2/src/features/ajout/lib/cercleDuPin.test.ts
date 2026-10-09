/**
 * QUOI     — le cercle de 200 m du pin : à l'encre sur le plan ; sur le satellite, un trait clair
 *            bordé d'encre, lisible sur la forêt comme sur les champs ; posé une seule fois par style.
 */
import { expect, test, vi } from 'vitest'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { poserCercleDuPin } from './cercleDuPin'

const couleurs: CouleursCarte = {
  fond: '#ecdcbb',
  eau: '#bfc3ad',
  route: '#9c7c55',
  encre: '#3f3024',
  halo: '#f4e9d1',
  foret: '#b9b58a',
  ombre: '#5a442c8c',
  cire: '#a94842',
}
const PIN = { latitude: 43.7, longitude: 7.2 }

// Une carte minimale : ses calques posés, et le calque « satellite » si la vue l'est.
function carte(satellite = false) {
  const calques = new Set<string>(satellite ? ['satellite'] : [])
  const sources = new Set<string>()
  return {
    addSource: vi.fn((id: string) => sources.add(id)),
    addLayer: vi.fn((c: { id: string }) => calques.add(c.id)),
    getLayer: (id: string) => (calques.has(id) ? { id } : undefined),
    getSource: (id: string) => (sources.has(id) ? { id } : undefined),
  }
}

function calque(c: ReturnType<typeof carte>, id: string): unknown {
  return c.addLayer.mock.calls.map(([l]) => l).find((l) => l.id === id)
}

test('sur le plan : voile et contour pointillé à l’encre', () => {
  const c = carte()
  poserCercleDuPin(c, PIN, couleurs)
  expect(c.addSource).toHaveBeenCalledWith('cercle-du-pin', expect.objectContaining({ type: 'geojson' }))
  expect(calque(c, 'cercle-du-pin-voile')).toMatchObject({ paint: { 'fill-color': couleurs.encre } })
  expect(calque(c, 'cercle-du-pin-contour')).toMatchObject({
    paint: { 'line-color': couleurs.encre, 'line-dasharray': [3, 2] },
  })
  expect(calque(c, 'cercle-du-pin-lisere')).toBeUndefined()
})

test('sur le satellite : un contour clair, bordé d’un liseré d’encre dessous', () => {
  const c = carte(true)
  poserCercleDuPin(c, PIN, couleurs)
  expect(calque(c, 'cercle-du-pin-contour')).toMatchObject({ paint: { 'line-color': couleurs.halo } })
  expect(calque(c, 'cercle-du-pin-lisere')).toMatchObject({ paint: { 'line-color': couleurs.encre } })
  expect(calque(c, 'cercle-du-pin-voile')).toMatchObject({ paint: { 'fill-color': couleurs.halo } })
  const ordre = c.addLayer.mock.calls.map(([l]) => l.id)
  expect(ordre.indexOf('cercle-du-pin-lisere')).toBeLessThan(ordre.indexOf('cercle-du-pin-contour'))
})

test('déjà posé sur ce style : rien de plus', () => {
  const c = carte()
  poserCercleDuPin(c, PIN, couleurs)
  poserCercleDuPin(c, PIN, couleurs)
  expect(c.addSource).toHaveBeenCalledOnce()
  expect(c.addLayer).toHaveBeenCalledTimes(2)
})
