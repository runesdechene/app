import { expect, test } from 'vitest'
import { adresseCourte } from './adresse'

test('une adresse de géocodeur se réduit à la rue et à la commune', () => {
  expect(
    adresseCourte(
      "167, Avenue de la Colle d'Ampouns, Berre-les-Alpes, Nice, Alpes-Maritimes, Provence-Alpes-Côte d'Azur, France métropolitaine, 06390, France",
    ),
  ).toBe("167 Avenue de la Colle d'Ampouns, Berre-les-Alpes")
})

test('les adresses déjà courtes gardent leur forme', () => {
  expect(adresseCourte('Château de Jonjeac, 74450 Jonjeac, France')).toBe(
    'Château de Jonjeac, 74450 Jonjeac',
  )
})

test('« Unnamed Road » ne dit rien : on le retire', () => {
  expect(adresseCourte('Unnamed Road, 12020 Canosio CN, Italy')).toBe('12020 Canosio CN')
})
