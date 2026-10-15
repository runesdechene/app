import { erreurDEnigme, versEnvoi, type Brouillon } from './enigme'

const qcm: Brouillon = { culture: 'nordique', difficulte: 'easy', recit: 'Au nord…', question: 'Qui ?', format: 'qcm',
  choix: ['Odin', ' Thor ', ''], reponse: 'Thor', variantes: '', explication: 'Parce que.', active: true }

test('un QCM valide', () => {
  expect(erreurDEnigme(qcm)).toBeNull()
  expect(versEnvoi(qcm).p_choix).toEqual(['Odin', 'Thor'])
  expect(versEnvoi(qcm).p_variantes).toEqual([])
})
test('la réponse doit être l’un des choix', () => {
  expect(erreurDEnigme({ ...qcm, reponse: 'Loki' })).toBe('La réponse doit être l’un des choix')
})
test('au moins deux choix', () => {
  expect(erreurDEnigme({ ...qcm, choix: ['Thor', ''] })).toBe('Il faut au moins deux choix')
})
test('libre : pas d’accolade, variantes une par ligne', () => {
  const libre: Brouillon = { ...qcm, format: 'free', choix: [], reponse: 'Thor', variantes: 'thor\n  Donar \n' }
  expect(versEnvoi(libre)).toMatchObject({ p_choix: null, p_variantes: ['thor', 'Donar'] })
  expect(erreurDEnigme({ ...libre, variantes: '{52}' })).toBe('Une réponse ou une variante contient une accolade')
})
test('question et réponse obligatoires', () => {
  expect(erreurDEnigme({ ...qcm, question: '  ' })).toBe('La question est vide')
  expect(erreurDEnigme({ ...qcm, reponse: ' ' })).toBe('La réponse est vide')
})
test('une énigme universelle n’envoie pas de culture', () => {
  expect('p_culture' in versEnvoi({ ...qcm, culture: null })).toBe(false)
  expect(versEnvoi(qcm).p_culture).toBe('nordique')
})
