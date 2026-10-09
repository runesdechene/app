/**
 * QUOI     — la vue satellite : les tuiles Esri, et leur attribution.
 */
import type { Map as CarteMapLibre } from 'maplibre-gl'
import { expect, test, vi } from 'vitest'
import type { CouleursCarte } from './couleursCarte'
import { FOND } from './styleCarte'
import { appliquerVue, estSatellite, STYLE_SATELLITE } from './styleSatellite'

const couleurs = {} as CouleursCarte

function fausseCarte() {
  const setStyle = vi.fn()
  return { setStyle, carte: { setStyle } as unknown as CarteMapLibre }
}

test('une source raster Esri World Imagery, créditée', () => {
  const source = STYLE_SATELLITE.sources['esri-satellite']
  expect(source).toMatchObject({ type: 'raster', tileSize: 256, attribution: 'Esri, Maxar, Earthstar Geographics' })
  expect(JSON.stringify(source)).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}')
})

test('le satellite remplace le style en entier (diff: false)', () => {
  const { setStyle, carte } = fausseCarte()
  appliquerVue(carte, 'satellite', couleurs)
  expect(setStyle).toHaveBeenCalledExactlyOnceWith(STYLE_SATELLITE, { diff: false })
})

test('le plan recharge le fond parchemin en entier (diff: false)', () => {
  const { setStyle, carte } = fausseCarte()
  appliquerVue(carte, 'plan', couleurs)
  expect(setStyle).toHaveBeenCalledExactlyOnceWith(FOND, expect.objectContaining({ diff: false }))
})

test('la vue satellite se lit sur la carte : son calque d’imagerie est là', () => {
  expect(estSatellite({ getLayer: (id: string) => (id === 'satellite' ? { id } : undefined) })).toBe(true)
  expect(estSatellite({ getLayer: () => undefined })).toBe(false)
})
