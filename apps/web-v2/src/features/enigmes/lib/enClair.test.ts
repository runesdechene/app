/**
 * QUOI     — les phrases de la page « Les énigmes » : le compte, l'encart, la date, le lien vers la carte.
 */
import { expect, test } from 'vitest'
import { encartEnClair, lienVersLaCarte, quandEnClair, resoluesEnClair } from './enClair'

test('résolues au singulier jusqu’à une', () => {
  expect(resoluesEnClair(0)).toBe('énigme résolue')
  expect(resoluesEnClair(1)).toBe('énigme résolue')
  expect(resoluesEnClair(137)).toBe('énigmes résolues')
})

test('l’encart dit ce qui reste, et où ça s’éveille', () => {
  expect(encartEnClair(58, 'Byzance', 'entre la Thrace et l’Asie Mineure')).toEqual({
    titre: 'Encore 58 énigmes à percer',
    phrase:
      'Chaque matin, une énigme de Byzance s’éveille entre la Thrace et l’Asie Mineure. Zoome sur la carte : les sceaux « ? » t’attendent.',
  })
  expect(encartEnClair(1, 'Rome', null).titre).toBe('Encore une énigme à percer')
  expect(encartEnClair(1, 'Rome', null).phrase).toContain('s’éveille quelque part dans sa zone.')
  expect(encartEnClair(0, 'Rome', null)).toEqual({ titre: 'Tout est percé', phrase: 'De nouvelles énigmes viendront.' })
})

test('la date d’une bonne réponse, en mots', () => {
  const maintenant = new Date('2026-10-07T18:00:00')
  expect(quandEnClair('2026-10-07T09:00:00', maintenant)).toBe('aujourd’hui')
  expect(quandEnClair('2026-10-06T22:00:00', maintenant)).toBe('hier')
  expect(quandEnClair('2026-05-03T10:00:00', maintenant)).toBe('3 mai')
  expect(quandEnClair('2025-05-03T10:00:00', maintenant)).toBe('mai 2025')
})

test('le lien vers la carte vole sur le centre de la culture', () => {
  expect(lienVersLaCarte({ lat: 41, lng: 28.9 })).toBe('/carte?zone=41,28.9')
})
