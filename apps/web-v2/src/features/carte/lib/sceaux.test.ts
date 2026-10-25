import { expect, test } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { marquesADessiner, melanger, nomImage } from './sceaux'

const lieu: LieuCarte = {
  id: 'a',
  nom: 'Trophée',
  lat: 43.7,
  lng: 7.4,
  nature: 'lieu',
  icone: 'x.svg',
  couleur: '#708d44',
  etat: 'visite',
  revendication: null,
  natures: [],
  epoque: null,
  ajoute: false,
  nouveau: false,
}

const CLASSIQUE = { couleurTypes: false, skyrim: false }
const EN_COULEUR = { couleurTypes: true, skyrim: false }

test('chaque lieu reçoit la marque de son état', () => {
  expect(nomImage({ ...lieu, etat: 'inconnu' }, CLASSIQUE)).toBe('bille')
  expect(nomImage({ ...lieu, etat: 'connu' }, CLASSIQUE)).toBe('connu-x.svg')
  expect(nomImage(lieu, CLASSIQUE)).toBe('visite-x.svg')
  expect(nomImage(lieu, EN_COULEUR)).toBe('visite-x.svg-#708d44')
  expect(nomImage({ ...lieu, icone: null }, CLASSIQUE)).toBe('visite-defaut')
  expect(nomImage({ ...lieu, nature: 'curiosite' }, CLASSIQUE)).toBe('curiosite')
})

test('en « Carte Skyrim », seul le lieu connu change de marque', () => {
  const skyrim = { couleurTypes: true, skyrim: true }
  expect(nomImage({ ...lieu, etat: 'connu' }, skyrim)).toBe('encre-x.svg')
  expect(nomImage(lieu, skyrim)).toBe('visite-x.svg-#708d44')
  expect(nomImage({ ...lieu, etat: 'inconnu' }, skyrim)).toBe('bille')
  expect(nomImage({ ...lieu, etat: 'connu', nouveau: true }, skyrim)).toBe('neuf-x.svg')
})

test('un lieu neuf porte le sceau d’encre, son icône ou son « ? »', () => {
  expect(nomImage({ ...lieu, etat: 'connu', nouveau: true }, EN_COULEUR)).toBe('neuf-x.svg')
  expect(nomImage({ ...lieu, etat: 'inconnu', nouveau: true }, EN_COULEUR)).toBe('neuf-inconnu')
})

test('un inconnu neuf a son image à dessiner ; un inconnu ordinaire partage la bille', () => {
  const lieux = [
    { ...lieu, id: 'b', etat: 'inconnu' as const },
    { ...lieu, id: 'c', etat: 'inconnu' as const, nouveau: true },
  ]
  expect([...marquesADessiner(lieux, CLASSIQUE, () => false).keys()]).toEqual(['neuf-inconnu'])
})

test('le mélange de deux couleurs suit la part demandée', () => {
  expect(melanger('#ffffff', '#000000', 1)).toBe('#ffffff')
  expect(melanger('#ffffff', '#000000', 0.5)).toBe('#808080')
})

test('chaque marque ne se dessine qu’une fois, quel que soit le nombre de lieux qui la portent', () => {
  const lieux: LieuCarte[] = [
    lieu,
    { ...lieu, id: 'b' },
    { ...lieu, id: 'c', etat: 'connu' },
    { ...lieu, id: 'd', etat: 'connu' },
    { ...lieu, id: 'e', etat: 'inconnu' },
    { ...lieu, id: 'f', nature: 'curiosite' },
  ]
  const aDessiner = marquesADessiner(lieux, CLASSIQUE, () => false)
  expect([...aDessiner.keys()]).toEqual(['visite-x.svg', 'connu-x.svg'])
})

test('une marque déjà sur la carte ne se redessine pas', () => {
  const dejaLa = (nom: string) => nom === 'visite-x.svg'
  expect([...marquesADessiner([lieu], CLASSIQUE, dejaLa).keys()]).toEqual([])
})
