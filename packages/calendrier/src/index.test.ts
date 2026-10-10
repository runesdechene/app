/**
 * QUOI     — les conversions de la spec calendrier : son tableau d'exemples, les bords (pas d'an
 *            zéro, 753 av. J.-C., 1453), les siècles, les balises incomprises.
 */
import { expect, test } from 'vitest'
import {
  anneeCourte,
  anneeEnClair,
  balisesIncomprises,
  CALENDRIERS,
  compteDuCalendrier,
  dateEnClair,
  estCalendrier,
  siecleEnClair,
  texteEnClair,
} from './index'

const dansTous = (texte: string) => CALENDRIERS.map((c) => texteEnClair(texte, c.id))

test('le tableau de la spec, dans l’ordre chrétien, moderne, Rome, Constantinople', () => {
  expect(dansTous('{52 av. J.-C.}')).toEqual([
    '52 av. J.-C.',
    '52 av. è. c.',
    '702 ap. la fondation de Rome',
    '1504 av. la chute de Constantinople',
  ])
  expect(dansTous('{930}')).toEqual([
    '930',
    '930',
    '1683 ap. la fondation de Rome',
    '523 av. la chute de Constantinople',
  ])
  expect(dansTous('{IIIe siècle av. J.-C.}')).toEqual([
    'IIIe siècle av. J.-C.',
    'IIIᵉ siècle av. è. c.',
    'VIᵉ siècle ap. la fondation de Rome',
    'XVIIIᵉ siècle av. la chute de Constantinople',
  ])
  expect(dansTous('{1515}')).toEqual([
    '1515',
    '1515',
    '2268 ap. la fondation de Rome',
    '62 ap. la chute de Constantinople',
  ])
})

test('pas d’an zéro : les bords de Rome et de Constantinople', () => {
  expect(anneeEnClair(-753, 'rome')).toBe('1 ap. la fondation de Rome')
  expect(anneeEnClair(-754, 'rome')).toBe('1 av. la fondation de Rome')
  expect(anneeEnClair(-1, 'rome')).toBe('753 ap. la fondation de Rome')
  expect(anneeEnClair(1, 'rome')).toBe('754 ap. la fondation de Rome')
  expect(anneeEnClair(1453, 'constantinople')).toBe('l’année de la chute de Constantinople')
  expect(anneeEnClair(1454, 'constantinople')).toBe('1 ap. la chute de Constantinople')
  expect(anneeEnClair(1452, 'constantinople')).toBe('1 av. la chute de Constantinople')
})

test('une année de notre ère reste nue, sauf si la balise disait « ap. J.-C. »', () => {
  expect(anneeEnClair(930, 'chretien')).toBe('930')
  expect(anneeEnClair(-52, 'chretien')).toBe('52 av. J.-C.')
  expect(texteEnClair('{930 ap. J.-C.}', 'moderne')).toBe('930 è. c.')
  expect(texteEnClair('{930 ap. J.-C.}', 'chretien')).toBe('930 ap. J.-C.')
})

test('les siècles, des deux côtés de l’an 1', () => {
  expect(texteEnClair('{Iᵉʳ siècle av. J.-C.}', 'moderne')).toBe('Iᵉʳ siècle av. è. c.')
  expect(texteEnClair('{Ier siècle}', 'rome')).toBe('IXᵉ siècle ap. la fondation de Rome')
  expect(siecleEnClair(1150, 'chretien')).toBe('XIIᵉ siècle')
  expect(siecleEnClair(-52, 'chretien')).toBe('Iᵉʳ siècle av. J.-C.')
  expect(siecleEnClair(-52, 'rome')).toBe('VIIIᵉ siècle ap. la fondation de Rome')
  expect(siecleEnClair(1453, 'constantinople')).toBe('Iᵉʳ siècle ap. la chute de Constantinople')
})

test('un texte : ses balises converties, le reste intact', () => {
  expect(texteEnClair('Rien à convertir, 24 runes.', 'rome')).toBe('Rien à convertir, 24 runes.')
  expect(texteEnClair('entre {107 av. J.-C.} et {86 av. J.-C.}', 'rome')).toBe(
    'entre 647 ap. la fondation de Rome et 668 ap. la fondation de Rome',
  )
})

test('une balise incomprise s’affiche telle quelle, et le Hub la voit', () => {
  expect(texteEnClair('au {IIIe millénaire av. J.-C.}', 'rome')).toBe('au IIIe millénaire av. J.-C.')
  expect(balisesIncomprises('au {IIIe millénaire av. J.-C.} puis {52 av. J.-C.}')).toEqual([
    'IIIe millénaire av. J.-C.',
  ])
  expect(balisesIncomprises('en {52 av. J.-C.')).toEqual(['une accolade seule'])
  expect(balisesIncomprises('{0}')).toEqual(['0'])
  expect(balisesIncomprises('{52 av. J.-C.} et {IIIe siècle}')).toEqual([])
})

test('estCalendrier ne reconnaît que les quatre', () => {
  expect(estCalendrier('rome')).toBe(true)
  expect(estCalendrier('gaulois')).toBe(false)
  expect(estCalendrier(null)).toBe(false)
})

test('anneeCourte : le nombre seul, « av. » avant le début du compte', () => {
  expect(anneeCourte(476, 'chretien')).toBe('476')
  expect(anneeCourte(-3300, 'chretien')).toBe('3300 av.')
  expect(anneeCourte(-3300, 'moderne')).toBe('3300 av.')
  expect(anneeCourte(476, 'rome')).toBe('1229')
  expect(anneeCourte(-1200, 'rome')).toBe('447 av.')
  expect(anneeCourte(-1, 'rome')).toBe('753')
  expect(anneeCourte(930, 'constantinople')).toBe('523 av.')
  expect(anneeCourte(1453, 'constantinople')).toBe('0')
  expect(anneeCourte(1600, 'constantinople')).toBe('147')
})

test('compteDuCalendrier : la fin de phrase de la frise', () => {
  expect(compteDuCalendrier('chretien')).toBe('avant et après J.-C.')
  expect(compteDuCalendrier('moderne')).toBe('avant et pendant l’ère commune')
  expect(compteDuCalendrier('rome')).toBe('en années depuis la fondation de Rome')
  expect(compteDuCalendrier('constantinople')).toBe('en années depuis la chute de Constantinople')
})

test('dateEnClair : le jour et le mois inchangés, l’année dans le calendrier', () => {
  const jour = new Date(2026, 9, 11)
  expect(dateEnClair(jour, 'chretien')).toBe('11 octobre 2026')
  expect(dateEnClair(jour, 'moderne')).toBe('11 octobre 2026')
  expect(dateEnClair(jour, 'rome')).toBe('11 octobre 2779 ap. la fondation de Rome')
  expect(dateEnClair(jour, 'constantinople')).toBe('11 octobre 573 ap. la chute de Constantinople')
})

test('dateEnClair : « 1er » pour le premier du mois', () => {
  expect(dateEnClair(new Date(2026, 0, 1), 'chretien')).toBe('1er janvier 2026')
})
