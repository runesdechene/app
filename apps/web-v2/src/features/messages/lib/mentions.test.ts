import { expect, test } from 'vitest'
import { decouper, insererMention, mentionEnCours } from './mentions'

test('une mention en cours : un @ en début ou après une espace, jusqu’au curseur', () => {
  expect(mentionEnCours('Salut @Gau', 10)).toEqual({ debut: 6, recherche: 'Gau' })
  expect(mentionEnCours('@', 1)).toEqual({ debut: 0, recherche: '' })
  expect(mentionEnCours('mon@mail', 8)).toBeNull()
  expect(mentionEnCours('Salut @Gautier ça va', 20)).toBeNull()
})

test('choisir une mention remplace ce qui est tapé par « @Nom », et place le curseur après', () => {
  expect(insererMention('Salut @Gau !', 10, 'Gautier de Bilskimir')).toEqual({
    texte: 'Salut @Gautier de Bilskimir !',
    curseur: 28,
  })
  expect(insererMention('@Lu', 3, 'Luna')).toEqual({ texte: '@Luna ', curseur: 6 })
})

test('un message se découpe : le texte, et les personnes mentionnées', () => {
  const gautier = { id: 'u2', nom: 'Gautier de Bilskimir' }
  expect(decouper('@Gautier de Bilskimir tu as vu ?', [gautier])).toEqual([
    { mention: gautier },
    { texte: ' tu as vu ?' },
  ])
  expect(decouper('Sans mention', [])).toEqual([{ texte: 'Sans mention' }])
})
