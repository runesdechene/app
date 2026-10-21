import { expect, test } from 'vitest'
import { lieuAPortee, type LieuProche } from './lieuAPortee'

const ICI = { lat: 43.8, lng: 7.3 }
// Un lieu à `m` mètres au nord d'ICI (un degré de latitude ≈ 111 195 m).
const auNord = (m: number) => ICI.lat + m / 111_195

function lieu(id: string, metres: number, autre: Partial<LieuProche> = {}): LieuProche {
  return {
    id,
    nom: `Lieu ${id}`,
    lat: auNord(metres),
    lng: ICI.lng,
    nature: 'lieu',
    revendication: null,
    ...autre,
  }
}

test('sans position, aucun lieu à portée', () => {
  expect(lieuAPortee('inconnue', [lieu('a', 10)])).toBeNull()
  expect(lieuAPortee('refusee', [lieu('a', 10)])).toBeNull()
})

test('le plus proche des lieux à portée', () => {
  expect(lieuAPortee(ICI, [lieu('loin', 120), lieu('pres', 50)])?.lieu.id).toBe('pres')
})

test('à la borne de 200 m, il est à portée ; au-delà, non', () => {
  expect(lieuAPortee(ICI, [lieu('a', 199.9)])?.lieu.id).toBe('a')
  expect(lieuAPortee(ICI, [lieu('a', 201)])).toBeNull()
})

test('la distance est écrite comme sur le bouton de visite', () => {
  expect(lieuAPortee(ICI, [lieu('a', 42)])?.distance).toBe('40 m')
})

test('une curiosité ne se revendique pas : ignorée', () => {
  expect(lieuAPortee(ICI, [lieu('c', 10, { nature: 'curiosite' })])).toBeNull()
})

test('un lieu que je tiens : ignoré', () => {
  expect(lieuAPortee(ICI, [lieu('a', 10, { revendication: { moi: true } })])).toBeNull()
})

test('un lieu tenu par un autre : proposé', () => {
  expect(lieuAPortee(ICI, [lieu('a', 10, { revendication: { moi: false } })])).not.toBeNull()
})
