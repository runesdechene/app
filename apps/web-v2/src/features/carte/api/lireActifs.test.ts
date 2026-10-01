import { expect, test } from 'vitest'
import { lireActifs } from './lireActifs'

test('un Actif complet, puis un Actif sans portrait, sans titre ni signe', () => {
  const complet = {
    id: 'k',
    nom: 'Kelpie',
    avatar: 'k.jpg',
    niveau: 17,
    titre: 'Arpenteur',
    signe: { nom: 'Hoplite', imageUrl: 'h.png' },
    lat: 43.7,
    lng: 7.2,
    brouille: false,
    vuA: '2026-10-01T10:00:00Z',
    enLigne: true,
  }
  const nu = { ...complet, id: 'm', avatar: null, titre: null, signe: null }
  expect(lireActifs([complet, nu])).toEqual([complet, nu])
})
