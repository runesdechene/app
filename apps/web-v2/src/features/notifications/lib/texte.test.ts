import { expect, test } from 'vitest'
import { blocsDuTexte } from './texte'

test('des paragraphes séparés par une ligne vide, une liste de tirets, la tête d’un point en gras', () => {
  const texte = [
    'Un seul bouton,',
    'et tout se trie.',
    '',
    '- Par nature : plusieurs à la fois.',
    '- Selon ta progression',
    'Et aussi : des marques plus grandes.',
  ].join('\n')

  expect(blocsDuTexte(texte)).toEqual([
    { sorte: 'paragraphe', texte: 'Un seul bouton, et tout se trie.' },
    {
      sorte: 'liste',
      points: [
        { tete: 'Par nature', reste: ' : plusieurs à la fois.' },
        { tete: null, reste: 'Selon ta progression' },
      ],
    },
    { sorte: 'paragraphe', texte: 'Et aussi : des marques plus grandes.' },
  ])
})

test('les retours à la ligne de Windows et les lignes vides en trop ne comptent pas', () => {
  expect(blocsDuTexte('\r\nBonjour\r\n\r\n\r\n- Un point\r\n')).toEqual([
    { sorte: 'paragraphe', texte: 'Bonjour' },
    { sorte: 'liste', points: [{ tete: null, reste: 'Un point' }] },
  ])
})
