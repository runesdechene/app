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

test('créé avant la bascule mais il y a moins de 15 jours, jamais entré : Nouveau seulement', () => {
  const proche = new Date('2026-10-10T12:00:00Z')
  const c = { ...base, inscrit: '2026-10-05T00:00:00Z', entree_v2: null, fragments: 0 }
  expect(balisesDuCompte(c, proche).map((b) => b.texte)).toEqual(['Nouveau'])
})
test('jamais connecté : créé pour lui (stand, flyer, boutique), jamais ouvert — ni Nouveau ni En sommeil', () => {
  const jamais = { ...base, derniere_visite: null, entree_v2: null }
  expect(textes({ ...jamais, provenance: 'stand' })).toEqual(['Jamais connecté', 'Porteur'])
  expect(textes({ ...jamais, provenance: 'shopify', inscrit: '2025-03-01T00:00:00Z', fragments: 0 })).toEqual(['Jamais connecté'])
})
test('un compte de l’appli s’est forcément connecté : jamais « Jamais connecté »', () => {
  const c = { ...base, provenance: 'app', inscrit: '2025-03-01T00:00:00Z', derniere_visite: null, entree_v2: null, fragments: 0 }
  expect(textes(c)).toEqual(['En sommeil'])
})
test('créé au stand puis ouvert en V1, pas revenu : En sommeil', () => {
  const c = { ...base, provenance: 'stand', inscrit: '2025-03-01T00:00:00Z', derniere_visite: '2025-04-01T00:00:00Z', entree_v2: null, fragments: 0 }
  expect(textes(c)).toEqual(['En sommeil'])
})
test('Nouveau et Réactivé ensemble : inscrit il y a 10 jours, entré 3 jours plus tard', () => {
  const c = { ...base, inscrit: '2026-10-04T00:00:00Z', entree_v2: '2026-10-07T00:00:00Z', fragments: 0 }
  expect(textes(c)).toEqual(['Nouveau', 'Réactivé'])
})
