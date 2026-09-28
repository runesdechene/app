import { expect, test } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { melanger, nomImage } from './sceaux'

const lieu: LieuCarte = {
  id: 'a', nom: 'Trophée', lat: 43.7, lng: 7.4, nature: 'lieu', icone: 'x.svg',
  couleur: '#708d44', etat: 'visite', revendication: null,
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
