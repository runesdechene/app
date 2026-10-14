import { decideEntree } from './decideEntree'

test('en cours de lecture : on attend', () => {
  expect(decideEntree({ statut: 'lecture' })).toBe('attendre')
})
test('sans session : on demande le code', () => {
  expect(decideEntree({ statut: 'pret', session: false, admin: false })).toBe('code')
})
test('connecté mais pas admin : refusé', () => {
  expect(decideEntree({ statut: 'pret', session: true, admin: false })).toBe('refuse')
})
test('admin connecté : on ouvre', () => {
  expect(decideEntree({ statut: 'pret', session: true, admin: true })).toBe('ouvrir')
})
test('erreur réseau : on propose de réessayer', () => {
  expect(decideEntree({ statut: 'erreur' })).toBe('reessayer')
})
