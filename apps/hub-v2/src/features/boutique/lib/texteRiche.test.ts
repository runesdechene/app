import { texteRiche } from './texteRiche'
test('le texte riche de Shopify en paragraphes', () => {
  const v = JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ value: 'Un.' }] }, { type: 'paragraph', children: [{ value: 'Deux.' }] }] })
  expect(texteRiche(v)).toBe('Un.\n\nDeux.')
})
test('un texte simple passe tel quel, rien donne rien', () => {
  expect(texteRiche('Déjà simple')).toBe('Déjà simple')
  expect(texteRiche(null)).toBe('')
})
test('un JSON qui n’est pas du texte riche passe tel quel', () => {
  expect(texteRiche('2026')).toBe('2026')
  expect(texteRiche('null')).toBe('null')
})
