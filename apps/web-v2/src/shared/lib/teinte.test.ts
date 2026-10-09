/**
 * QUOI     — la teinte d'une Compagnie : son encre reste lisible sur le parchemin, quelle que soit
 *            sa couleur (le blanc compris), et l'initiale de son avatar se voit sur sa couleur.
 */
import { contraste, ENCRE, FOND, teinteCompagnie } from './teinte'

test('une couleur sombre garde sa nuance, une claire fonce jusqu’à se lire', () => {
  for (const couleur of ['#5f6f86', '#ffffff', '#eaeae6', '#e4c94a', '#000000']) {
    const encre = teinteCompagnie(couleur)['--encre-compagnie']
    expect(contraste(encre, FOND)).toBeGreaterThanOrEqual(4.5)
  }
  // Le bleu-gris du Lys est déjà lisible : son encre n'est pas l'encre noire tout court.
  expect(teinteCompagnie('#5f6f86')['--encre-compagnie']).not.toBe(ENCRE)
})

test('l’initiale : parchemin sur une couleur sombre, encre sur une couleur claire', () => {
  expect(teinteCompagnie('#5f6f86')['--sur-couleur']).toBe('var(--color-fond)')
  expect(teinteCompagnie('#ffffff')['--sur-couleur']).toBe('var(--color-encre)')
})

test('la couleur elle-même passe telle quelle (le blanc est une identité)', () => {
  expect(teinteCompagnie('#ffffff')['--couleur']).toBe('#ffffff')
})
