/**
 * QUOI     — l'écart entre deux textes, en morceaux pareils / ajoutés / retirés.
 */
import { expect, test } from 'vitest'
import { ecart } from './ecart'

const texte = (morceaux: { texte: string }[]) => morceaux.map((m) => m.texte).join('')

test('un ajout, un retrait, et ce qui ne change pas', () => {
  const m = ecart('Il reste presque rien.', 'Il reste une tour.')
  expect(m.filter((x) => x.genre === 'retire').map((x) => x.texte.trim())).toEqual(['presque rien'])
  expect(m.filter((x) => x.genre === 'ajoute').map((x) => x.texte.trim())).toEqual(['une tour'])
  // Le texte d'avant se relit sans les ajouts, celui d'après sans les retraits.
  expect(texte(m.filter((x) => x.genre !== 'ajoute'))).toBe('Il reste presque rien.')
  expect(texte(m.filter((x) => x.genre !== 'retire'))).toBe('Il reste une tour.')
})

test('une rubrique qui apparaît, une qui disparaît', () => {
  expect(ecart('', 'Par le sentier')).toEqual([{ texte: 'Par le sentier', genre: 'ajoute' }])
  expect(ecart('Pas de feu', '')).toEqual([{ texte: 'Pas de feu', genre: 'retire' }])
})
