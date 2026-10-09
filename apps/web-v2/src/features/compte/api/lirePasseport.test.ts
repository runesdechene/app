/**
 * QUOI     — la lecture du passeport renvoyé par get_passeport.
 * POURQUOI — un tampon illisible est écarté (le reste s'affiche) ; un passeport illisible ou
 *            `null` (Explorateur désactivé) devient `null`.
 */
import { expect, test } from 'vitest'
import { lirePasseport } from './lirePasseport'

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const TAMPON = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: 'https://x/g.webp',
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-02',
}

test('un passeport complet', () => {
  expect(lirePasseport({ auJour: true, natures: [NATURE], tampons: [TAMPON] })).toEqual({
    auJour: true,
    natures: [NATURE],
    tampons: [TAMPON],
  })
})

test('les champs facultatifs à null', () => {
  const t = { ...TAMPON, imageUrl: null, nature: null, departement: null, pays: null }
  expect(lirePasseport({ auJour: false, natures: [], tampons: [t] })?.tampons).toEqual([t])
})

test('un tampon illisible est écarté, pas le passeport', () => {
  const p = lirePasseport({ auJour: true, natures: [NATURE], tampons: [{ id: 3 }, TAMPON] })
  expect(p?.tampons).toEqual([TAMPON])
})

test('une date mal formée écarte le tampon', () => {
  const p = lirePasseport({ auJour: true, natures: [], tampons: [{ ...TAMPON, quand: 'hier' }] })
  expect(p?.tampons).toEqual([])
})

test('null ou illisible → null', () => {
  expect(lirePasseport(null)).toBeNull()
  expect(lirePasseport({ natures: [], tampons: [] })).toBeNull()
  expect(lirePasseport('x')).toBeNull()
})
