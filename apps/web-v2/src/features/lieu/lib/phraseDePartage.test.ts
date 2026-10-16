import { expect, test } from 'vitest'
import { phraseDePartage } from './phraseDePartage'

const REPLI = 'J’ai trouvé Abbaye de Fontenay sur Runes de Chêne EXPLORE - tu connais ?'

test.each([[null], [''], ['   '], ['Un trésor t’attend.']])(
  'le modèle %j donne la phrase de repli',
  (modele) => {
    expect(phraseDePartage(modele, 'Abbaye de Fontenay')).toBe(REPLI)
  },
)

test('{name} devient le nom du lieu, partout où il apparaît', () => {
  expect(phraseDePartage('{name} ! Viens voir {name}.', 'Jonjeac')).toBe(
    'Jonjeac ! Viens voir Jonjeac.',
  )
})

test("un nom avec $& ou $' reste tel quel", () => {
  expect(phraseDePartage('Viens voir {name} !', "Fort $& $' Lac")).toBe(
    "Viens voir Fort $& $' Lac !",
  )
})
