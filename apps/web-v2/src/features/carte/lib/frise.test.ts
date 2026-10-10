/**
 * QUOI     — la frise des époques : de l'ensemble choisi à la plage et retour, les bornes et la
 *            phrase d'en-tête dans le calendrier du joueur.
 */
import { expect, test } from 'vitest'
import type { EpoqueFiltre } from '../api/lireCarte'
import { auRepos, bornes, enTete, ensembleDe, epoquesDatees, plageDe } from './frise'

const e = (id: string, nom: string, debut: number | null, fin: number | null): EpoqueFiltre => ({
  id,
  nom,
  debut,
  fin,
})
const EPOQUES = [
  e('prehistory', 'Préhistoire', null, -3300),
  e('classical-antiquity', 'Antiquité classique', -500, 476),
  e('early-middle-ages', 'Haut Moyen Âge', 476, 1000),
  e('renaissance', 'Renaissance', 1453, 1600),
  e('digital-era', 'Ère digitale', 2020, null),
  e('not-applicable', 'Non concerné', null, null),
  e('unknown', 'Indéfinie', null, null),
]
const FRISE = epoquesDatees(EPOQUES)

test('la frise ne garde que les époques datées, dans leur ordre', () => {
  expect(FRISE.map((x) => x.id)).toEqual([
    'prehistory',
    'classical-antiquity',
    'early-middle-ages',
    'renaissance',
    'digital-era',
  ])
})

test('au repos : un ensemble vide, les poignées aux deux bouts', () => {
  expect(plageDe(FRISE, new Set())).toEqual({ de: 0, a: 4 })
  expect(ensembleDe(FRISE, { de: 0, a: 4 }).size).toBe(0)
  expect(auRepos(FRISE, { de: 0, a: 4 })).toBe(true)
})

test('une plage : les époques de l’une à l’autre, et retour', () => {
  const choix = ensembleDe(FRISE, { de: 2, a: 3 })
  expect([...choix]).toEqual(['early-middle-ages', 'renaissance'])
  expect(plageDe(FRISE, choix)).toEqual({ de: 2, a: 3 })
})

test('une seule époque est une plage', () => {
  expect([...ensembleDe(FRISE, { de: 1, a: 1 })]).toEqual(['classical-antiquity'])
  expect(enTete(FRISE, { de: 1, a: 1 }, 'chretien').titre).toBe('Antiquité classique')
})

test('les bornes suivent le calendrier ; une borne ouverte n’a pas d’année', () => {
  expect(bornes(FRISE, { de: 2, a: 3 }, 'chretien')).toEqual({ debut: '476', fin: '1600' })
  expect(bornes(FRISE, { de: 2, a: 3 }, 'rome')).toEqual({ debut: '1229', fin: '2353' })
  expect(bornes(FRISE, { de: 0, a: 4 }, 'rome')).toEqual({ debut: null, fin: null })
})

test('l’en-tête : au repos, une plage, des bornes ouvertes', () => {
  expect(enTete(FRISE, { de: 0, a: 4 }, 'rome')).toEqual({
    titre: 'Toutes les époques',
    detail: 'Glisse les poignées pour remonter le temps',
  })
  expect(enTete(FRISE, { de: 2, a: 3 }, 'rome')).toEqual({
    titre: 'Haut Moyen Âge → Renaissance',
    detail: 'de 1229 à 2353 — en années depuis la fondation de Rome',
  })
  expect(enTete(FRISE, { de: 0, a: 2 }, 'chretien').detail).toBe(
    'des origines à 1000 — avant et après J.-C.',
  )
  expect(enTete(FRISE, { de: 3, a: 4 }, 'chretien').detail).toBe(
    'de 1453 à aujourd’hui — avant et après J.-C.',
  )
})
