/**
 * QUOI     — un message du Registre se lit, celui d'une Compagnie aussi (mig 422).
 */
import { expect, test } from 'vitest'
import { lireRegistre } from './lireRegistre'

const MESSAGE = {
  id: 1,
  canal: 'general',
  texte: 'Bonjour',
  quand: '2026-10-05T08:00:00Z',
  auteur: { id: 'u1', nom: 'Uriel', avatar: null },
  moi: false,
  mentions: [],
  mentionneMoi: false,
  coeurs: [],
  aime: false,
}

test('un message du canal général se lit, sans nom ni couleur de canal', () => {
  expect(lireRegistre([MESSAGE])[0]).toMatchObject({
    canal: 'general',
    canalNom: null,
    canalCouleur: null,
  })
})

test('un message de Compagnie se lit, avec le nom et la couleur de son canal', () => {
  const [m] = lireRegistre([
    { ...MESSAGE, canal: 'f-abc', canalNom: 'Le Lys de Fer', canalCouleur: '#5f6f86' },
  ])
  expect(m).toMatchObject({ canal: 'f-abc', canalNom: 'Le Lys de Fer', canalCouleur: '#5f6f86' })
})
