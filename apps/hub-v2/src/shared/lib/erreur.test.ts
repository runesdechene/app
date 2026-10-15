import { messageDErreur } from './erreur'

test('une Error donne son message', () => {
  expect(messageDErreur(new Error('HTTP 500'))).toBe('HTTP 500')
})

test('autre chose qu’une Error donne son texte', () => {
  expect(messageDErreur('panne')).toBe('panne')
  expect(messageDErreur(404)).toBe('404')
})
