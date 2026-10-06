import { expect, test, vi } from 'vitest'
import type { Actif } from '../api/lireActifs'
import { ajouterZones, distanceDe, parProximite, ZONES, zonesEnGeoJSON } from './actifs'

const actif = (id: string, lat: number, lng: number, autre: Partial<Actif> = {}): Actif => ({
  id,
  nom: id,
  avatar: null,
  niveau: 1,
  titre: null,
  signe: null,
  lat,
  lng,
  brouille: false,
  vuA: '2026-10-01T10:00:00Z',
  enLigne: true,
  ...autre,
})

const NICE = { latitude: 43.7, longitude: 7.26 }

test('les plus proches d’abord ; sans position, l’ordre de la base', () => {
  const loin = actif('loin', 48.85, 2.35)
  const pres = actif('pres', 43.6, 7.0)
  expect(parProximite([loin, pres], NICE).map((a) => a.id)).toEqual(['pres', 'loin'])
  expect(parProximite([loin, pres], null).map((a) => a.id)).toEqual(['loin', 'pres'])
})

test('la distance : exacte, approchée si brouillée, rien sans position', () => {
  expect(distanceDe(actif('a', 43.7, 7.4), NICE)).toBe('11 km')
  expect(distanceDe(actif('b', 44.0, 7.26, { brouille: true }), NICE)).toBe('~ 33 km')
  expect(distanceDe(actif('c', 44, 7), null)).toBeNull()
})

test('des zones pour les seuls brouillés, qui savent s’ils sont récents', () => {
  const geo = zonesEnGeoJSON([
    actif('a', 45, 1),
    actif('b', 44, 2, { brouille: true, enLigne: false }),
  ])
  expect(geo.features).toHaveLength(1)
  expect(geo.features[0]?.properties).toEqual({ id: 'b', recent: true })
})

test('les zones se posent sous les lieux : un voile et un contour', () => {
  const map = { addSource: vi.fn(), addLayer: vi.fn<(calque: unknown, avant?: string) => void>() }
  ajouterZones(map, '#9c7c55', 'billes')
  expect(map.addSource).toHaveBeenCalledWith(ZONES, expect.objectContaining({ type: 'geojson' }))
  expect(map.addLayer.mock.calls.map((c) => c[1])).toEqual(['billes', 'billes'])
})
