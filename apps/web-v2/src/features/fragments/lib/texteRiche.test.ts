import { expect, test } from 'vitest'
import { lireTexteRiche } from './texteRiche'

const riche = (children: unknown[]) => JSON.stringify({ type: 'root', children })

test('un paragraphe garde son italique et son gras', () => {
  const valeur = riche([
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Son nom vient de l’' },
        { type: 'text', value: 'hoplon', italic: true },
        { type: 'text', value: ' : c’est inexact.', bold: true },
      ],
    },
  ])
  expect(lireTexteRiche(valeur)).toEqual([
    [
      { texte: 'Son nom vient de l’', gras: false, italique: false },
      { texte: 'hoplon', gras: false, italique: true },
      { texte: ' : c’est inexact.', gras: true, italique: false },
    ],
  ])
})

test('une liste donne un bloc par élément ; les paragraphes vides disparaissent', () => {
  const valeur = riche([
    { type: 'paragraph', children: [{ type: 'text', value: '' }] },
    {
      type: 'list',
      children: [
        { type: 'list-item', children: [{ type: 'text', value: 'Un' }] },
        { type: 'list-item', children: [{ type: 'text', value: 'Deux' }] },
      ],
    },
  ])
  expect(lireTexteRiche(valeur).map((b) => b.map((s) => s.texte).join(''))).toEqual(['Un', 'Deux'])
})

test('un texte simple devient un bloc par paragraphe ; rien donne rien', () => {
  expect(lireTexteRiche('Premier.\n\nSecond.')).toHaveLength(2)
  expect(lireTexteRiche(null)).toEqual([])
})
