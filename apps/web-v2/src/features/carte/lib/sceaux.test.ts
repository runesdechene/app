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

test('chaque lieu reçoit la marque de son état', () => {
  expect(nomImage({ ...lieu, etat: 'inconnu' }, false)).toBe('bille')
  expect(nomImage({ ...lieu, etat: 'connu' }, false)).toBe('connu-x.svg')
  expect(nomImage(lieu, false)).toBe('visite-x.svg')
  expect(nomImage(lieu, true)).toBe('visite-x.svg-#708d44')
  expect(nomImage({ ...lieu, icone: null }, false)).toBe('visite-defaut')
  expect(nomImage({ ...lieu, nature: 'curiosite' }, false)).toBe('curiosite')
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
  const aDessiner = marquesADessiner(lieux, false, () => false)
  expect([...aDessiner.keys()]).toEqual(['visite-x.svg', 'connu-x.svg'])
})

test('une marque déjà sur la carte ne se redessine pas', () => {
  const dejaLa = (nom: string) => nom === 'visite-x.svg'
  expect([...marquesADessiner([lieu], false, dejaLa).keys()]).toEqual([])
})
