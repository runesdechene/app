import { expect, test } from 'vitest'
import { lireCompagnons, lireFiche, lireRecompense } from './lireLieu'

const COMPLET = {
  id: 'a',
  slug: 'chateau-de-jonjeac',
  nom: 'Château de Jonjeac',
  recit: 'Un récit.',
  adresse: 'Jonjeac',
  lat: 45.9,
  lng: 6.1,
  nature: 'lieu',
  photos: [{ url: 'u1', vignette: 'v1' }],
  type: { nom: 'Château et fortins', icone: 'i.svg', couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150 },
  rubriques: { acces: 'Par le sentier', quand: null, bonASavoir: null },
  bivouacTolere: true,
  recitPar: [{ id: 'l', nom: 'Luna', avatar: null }],
  explorateurs: { nombre: 3, derniers: [{ id: 'u', nom: 'Rémy', avatar: null }] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null },
  ajouteLe: '2026-01-01T00:00:00Z',
  ajoutADistance: false,
  moi: { visiteLe: null, envie: true },
}

test('une fiche complète se lit', () => {
  expect(lireFiche(COMPLET)).toMatchObject({
    slug: 'chateau-de-jonjeac',
    nom: 'Château de Jonjeac',
    moi: { envie: true },
    revendication: { nom: 'LES LOUPS' },
  })
})

test('la fiche lit ses rubriques, son bivouac et qui a écrit le récit', () => {
  const f = lireFiche(COMPLET)
  expect(f?.rubriques).toEqual({ acces: 'Par le sentier', quand: null, bonASavoir: null })
  expect(f?.bivouacTolere).toBe(true)
  expect(f?.recitPar.map((p) => p.nom)).toEqual(['Luna'])
})

test('un lieu introuvable ou invisible se lit « null »', () => {
  expect(lireFiche(null)).toBeNull()
})

test('un lieu nu reste lisible : pas de photo, de type, de faits, de revendication, ni d’explorateurs', () => {
  const nu = {
    ...COMPLET,
    photos: [],
    type: null,
    adresse: null,
    revendication: null,
    auteur: null,
    faits: { epoque: null, annee: null },
    explorateurs: { nombre: 0, derniers: [] },
  }
  expect(lireFiche(nu)).toMatchObject({
    photos: [],
    type: null,
    revendication: null,
    explorateurs: { nombre: 0 },
  })
})

test('la fiche dit si le lieu est encore à découvrir', () => {
  expect(lireFiche({ ...COMPLET, moi: { ...COMPLET.moi, decouvert: false } })?.moi.decouvert).toBe(
    false,
  )
})

test('sans l’information (avant la migration 367), le lieu se lit découvert : la fiche s’ouvre', () => {
  expect(lireFiche(COMPLET)?.moi.decouvert).toBe(true)
})

test('la récompense d’une découverte se lit', () => {
  expect(lireRecompense({ rang: 38, gain: 1, niveau: 12, avant: 0.62, apres: 0.64 })).toEqual({
    rang: 38,
    gain: 1,
    niveau: 12,
    avant: 0.62,
    apres: 0.64,
  })
})

test('les compagnons portent leur distance', () => {
  expect(lireCompagnons([{ id: 'b', nom: 'Léa', avatar: null, distance: 120 }])[0]?.distance).toBe(
    120,
  )
})
