import { adresseComplete, finirAdresse } from './email'

test('une fin en @ remplace le domaine déjà tapé, ou s’ajoute', () => {
  expect(finirAdresse('lea.dubois', '@gmail.com')).toBe('lea.dubois@gmail.com')
  expect(finirAdresse('lea.dubois@gm', '@gmail.com')).toBe('lea.dubois@gmail.com')
  expect(finirAdresse('lea.dubois@hotmail.fr', '@gmail.com')).toBe('lea.dubois@gmail.com')
})

test('« .com » et « .fr » s’ajoutent au bout', () => {
  expect(finirAdresse('lea@monsite', '.fr')).toBe('lea@monsite.fr')
})

test('une adresse est complète avec une arobase et un domaine pointé', () => {
  expect(adresseComplete('lea.dubois@gmail.com')).toBe(true)
  expect(adresseComplete(' lea@x.fr ')).toBe(true)
  expect(adresseComplete('lea.dubois@gmail')).toBe(false)
  expect(adresseComplete('lea dubois@gmail.com')).toBe(false)
  expect(adresseComplete('Léa')).toBe(false)
})
