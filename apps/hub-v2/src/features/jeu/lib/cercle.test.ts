import { cercleEnPolygone } from './cercle'

test('un cercle est approché par 64 points, anneau fermé, [lng, lat]', () => {
  const anneau = cercleEnPolygone({ lat: 46, lng: 2, rayon_km: 100 })
  expect(anneau).toHaveLength(65)
  expect(anneau[64]).toEqual(anneau[0])
})

test('le point du nord est à rayon / 111,32 degrés au-dessus du centre', () => {
  const anneau = cercleEnPolygone({ lat: 46, lng: 2, rayon_km: 111.32 })
  const nord = anneau.reduce((a, p) => (p[1] > a[1] ? p : a))
  expect(nord[1]).toBeCloseTo(47, 3)
  expect(nord[0]).toBeCloseTo(2, 3)
})
