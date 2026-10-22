/**
 * QUOI     — un texte d'Explorateur découpé en texte, liens et mentions Instagram.
 * POURQUOI — les liens deviennent cliquables sans jamais injecter de HTML.
 */
import { decouperLiens } from './liens'

test('du texte seul reste un seul morceau', () => {
  expect(decouperLiens('Chevalier errant')).toEqual([{ type: 'texte', valeur: 'Chevalier errant' }])
})

test('une mention devient un lien vers Instagram', () => {
  expect(decouperLiens('Fondateur de @runesdechene')).toEqual([
    { type: 'texte', valeur: 'Fondateur de ' },
    { type: 'lien', valeur: '@runesdechene', href: 'https://www.instagram.com/runesdechene/' },
  ])
})

test('un lien https devient cliquable', () => {
  expect(decouperLiens('Voir https://runesdechene.com ici')).toEqual([
    { type: 'texte', valeur: 'Voir ' },
    { type: 'lien', valeur: 'runesdechene.com', href: 'https://runesdechene.com' },
    { type: 'texte', valeur: ' ici' },
  ])
})

test('la ponctuation qui finit la phrase reste hors du lien', () => {
  expect(decouperLiens('(voir https://x.fr/a?b=1).')).toEqual([
    { type: 'texte', valeur: '(voir ' },
    { type: 'lien', valeur: 'x.fr', href: 'https://x.fr/a?b=1' },
    { type: 'texte', valeur: ').' },
  ])
})

test('une adresse se lit par son site, sans « www. »', () => {
  expect(decouperLiens('https://www.monuments-nationaux.fr/chateau')).toEqual([
    {
      type: 'lien',
      valeur: 'monuments-nationaux.fr',
      href: 'https://www.monuments-nationaux.fr/chateau',
    },
  ])
})

test('une adresse http ou javascript reste du texte', () => {
  expect(decouperLiens('javascript:alert(1) http://x.fr')).toEqual([
    { type: 'texte', valeur: 'javascript:alert(1) http://x.fr' },
  ])
})

test('une adresse e-mail ou un @ isolé ne sont pas des mentions', () => {
  expect(decouperLiens('Écris à uriel@runesdechene.com, rendez-vous @ 10h')).toEqual([
    { type: 'texte', valeur: 'Écris à uriel@runesdechene.com, rendez-vous @ 10h' },
  ])
})
