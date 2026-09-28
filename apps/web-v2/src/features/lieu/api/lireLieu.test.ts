import { expect, test } from 'vitest'
import { lireCompagnons, lireFiche } from './lireLieu'

const COMPLET = {
  id: 'a', nom: 'Château de Jonjeac', recit: 'Un récit.', adresse: 'Jonjeac', lat: 45.9, lng: 6.1,
  nature: 'lieu', photos: [{ url: 'u1', vignette: 'v1' }],
  type: { nom: 'Château et fortins', icone: 'i.svg', couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150, saison: null, acces: 'easy', bivouac: null },
  explorateurs: { nombre: 3, derniers: [{ id: 'u', nom: 'Rémy', avatar: null }] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null }, ajouteLe: '2026-01-01T00:00:00Z',
  enrichiPar: null, moi: { visiteLe: null, envie: true },
}

test('une fiche complète se lit', () => {
  expect(lireFiche(COMPLET)).toMatchObject({ nom: 'Château de Jonjeac', moi: { envie: true }, revendication: { nom: 'LES LOUPS' } })
})

test('un lieu introuvable ou invisible se lit « null »', () => {
  expect(lireFiche(null)).toBeNull()
})

test('un lieu nu reste lisible : pas de photo, de type, de faits, de revendication, ni d’explorateurs', () => {
  const nu = { ...COMPLET, photos: [], type: null, adresse: null, revendication: null, auteur: null,
    faits: { epoque: null, annee: null, saison: null, acces: null, bivouac: null },
    explorateurs: { nombre: 0, derniers: [] } }
  expect(lireFiche(nu)).toMatchObject({ photos: [], type: null, revendication: null, explorateurs: { nombre: 0 } })
})

test('les compagnons portent leur distance', () => {
  expect(lireCompagnons([{ id: 'b', nom: 'Léa', avatar: null, distance: 120 }])[0]?.distance).toBe(120)
})
