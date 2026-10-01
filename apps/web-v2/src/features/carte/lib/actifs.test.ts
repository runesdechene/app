import { expect, test } from 'vitest'
import type { Actif } from '../api/lireActifs'
import { cercle, distanceDe, parProximite, zonesEnGeoJSON } from './actifs'

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

test('un cercle fermé, au bon rayon', () => {
  const points = cercle(45, 1, 50)
  expect(points[0]).toEqual(points.at(-1))
  const [lng, lat] = points[0] ?? [0, 0]
  const km = Math.hypot((lat - 45) * 111, (lng - 1) * 111 * Math.cos((45 * Math.PI) / 180))
  expect(Math.round(km)).toBe(50)
})

test('des zones pour les seuls brouillés, qui savent s’ils sont récents', () => {
  const geo = zonesEnGeoJSON([
    actif('a', 45, 1),
    actif('b', 44, 2, { brouille: true, enLigne: false }),
  ])
  expect(geo.features).toHaveLength(1)
  expect(geo.features[0]?.properties).toEqual({ id: 'b', recent: true })
})
