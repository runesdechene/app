/**
 * QUOI     — la présentation d'un Explorateur découpée en texte, liens et mentions Instagram.
 * POURQUOI — les liens deviennent cliquables sans jamais injecter de HTML.
 */
import { decouperBio } from './bio'

test('du texte seul reste un seul morceau', () => {
  expect(decouperBio('Chevalier errant')).toEqual([{ type: 'texte', valeur: 'Chevalier errant' }])
})

test('une mention devient un lien vers Instagram', () => {
  expect(decouperBio('Fondateur de @runesdechene')).toEqual([
    { type: 'texte', valeur: 'Fondateur de ' },
    { type: 'lien', valeur: '@runesdechene', href: 'https://www.instagram.com/runesdechene/' },
  ])
})

test('un lien https devient cliquable', () => {
  expect(decouperBio('Voir https://runesdechene.com ici')).toEqual([
    { type: 'texte', valeur: 'Voir ' },
    { type: 'lien', valeur: 'https://runesdechene.com', href: 'https://runesdechene.com' },
    { type: 'texte', valeur: ' ici' },
  ])
})

test('une adresse http ou javascript reste du texte', () => {
  expect(decouperBio('javascript:alert(1) http://x.fr')).toEqual([
    { type: 'texte', valeur: 'javascript:alert(1) http://x.fr' },
  ])
})
