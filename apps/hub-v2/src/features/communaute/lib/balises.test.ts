import type { Compte } from '../api/comptes'
import { balisesDuCompte } from './balises'

const maintenant = new Date('2026-10-14T12:00:00Z')
const base: Compte = {
  id: 'u1', nom: 'Kelpie', email: 'k@exemple.fr', avatar: null, role: 'user', provenance: 'flyer',
  inscrit: '2026-10-14T09:00:00Z', derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:01:00Z',
  client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2,
}
const textes = (c: Compte) => balisesDuCompte(c, maintenant).map((b) => b.texte)

test('nouveau et porteur', () => {
  expect(textes(base)).toEqual(['Nouveau', 'Porteur'])
})
test('réactivé : entré dans la V2 il y a moins de 15 jours, plus d’un jour après l’inscription', () => {
  expect(textes({ ...base, inscrit: '2025-03-01T00:00:00Z', entree_v2: '2026-10-10T00:00:00Z', fragments: 0 })).toEqual(['Réactivé'])
})
test('réactivé il y a plus de 15 jours : plus de balise', () => {
  expect(textes({ ...base, inscrit: '2025-03-01T00:00:00Z', entree_v2: '2026-09-01T00:00:00Z', fragments: 0 })).toEqual([])
})
test('en sommeil : créé avant la bascule, jamais entré dans la V2', () => {
  expect(textes({ ...base, inscrit: '2024-02-01T00:00:00Z', entree_v2: null, fragments: 1 })).toEqual(['En sommeil', 'Porteur'])
})
test('un compte créé après la bascule sans être entré n’est pas en sommeil', () => {
  expect(textes({ ...base, inscrit: '2026-10-08T00:00:00Z', entree_v2: null, fragments: 0 })).toEqual(['Nouveau'])
})
test('admin', () => {
  expect(textes({ ...base, inscrit: '2024-01-01T00:00:00Z', entree_v2: '2024-01-01T00:00:00Z', role: 'admin', fragments: 22 })).toEqual(['Admin', 'Porteur'])
})
