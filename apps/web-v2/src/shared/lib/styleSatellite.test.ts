/**
 * QUOI     — la vue satellite : les tuiles Esri, et leur attribution.
 */
import { expect, test } from 'vitest'
import { STYLE_SATELLITE } from './styleSatellite'

test('une source raster Esri World Imagery, créditée', () => {
  const source = STYLE_SATELLITE.sources['esri-satellite']
  expect(source).toMatchObject({ type: 'raster', tileSize: 256, attribution: 'Esri, Maxar, Earthstar Geographics' })
  expect(JSON.stringify(source)).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}')
})
