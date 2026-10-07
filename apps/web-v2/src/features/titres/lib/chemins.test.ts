/**
 * QUOI     — le nom des chemins, leur compteur en clair, le prochain titre à gagner.
 */
import { expect, test } from 'vitest'
import type { Chemin } from '../api/lireMesTitres'
import { compteurEnClair, nomDuChemin, prochain, progresEnClair } from './chemins'

const titre = (min: number, obtenu: boolean) => ({
  id: min,
  nom: `T${String(min)}`,
  min,
  obtenu,
  porte: false,
})
const chemin = (titres: Chemin['titres'], compteur = 0): Chemin => ({
  stat: 'places_visited',
  compteur,
  titres,
})

test('le prochain est le premier titre pas encore obtenu', () => {
  expect(prochain(chemin([titre(10, true), titre(50, false), titre(150, false)]))?.min).toBe(50)
})

test('tout neuf : le prochain est le premier palier', () => {
  expect(prochain(chemin([titre(10, false), titre(50, false)]))?.min).toBe(10)
})

test('tout gagné : pas de prochain', () => {
  expect(prochain(chemin([titre(10, true), titre(50, true)]))).toBeNull()
})

test('la base décide : un compteur au-delà du seuil ne suffit pas à dire « obtenu »', () => {
  expect(prochain(chemin([titre(10, false)], 12))?.min).toBe(10)
})

test('chaque chemin a son nom et son compteur en clair', () => {
  expect(nomDuChemin('level')).toBe('Le chemin')
  expect(nomDuChemin('places_visited')).toBe('Les visites')
  expect(nomDuChemin('places_added')).toBe('Les lieux ajoutés')
  expect(nomDuChemin('places_enriched')).toBe('Les lieux enrichis')
  expect(compteurEnClair('level', 12)).toBe('niveau 12')
  expect(compteurEnClair('places_visited', 60)).toBe('60 lieux visités')
  expect(compteurEnClair('places_added', 1)).toBe('1 lieu ajouté')
  expect(compteurEnClair('places_enriched', 4)).toBe('4 lieux enrichis')
})

test('la progression se lit d’un trait, le niveau compris', () => {
  expect(progresEnClair('level', 12, 15)).toBe('niveau 12 / 15')
  expect(progresEnClair('places_visited', 60, 150)).toBe('60 / 150 lieux visités')
  expect(progresEnClair('places_enriched', 0, 1)).toBe('0 / 1 lieu enrichi')
})

