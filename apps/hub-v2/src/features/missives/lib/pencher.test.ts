import { formatDeSortie, mesuresPenchees } from './pencher'

test('une image 1600×900 penchée de 2,5° sort en 1 200 px de large', () => {
  const m = mesuresPenchees(1600, 900, 2.5)
  expect(m.largeur).toBe(1200)
  // Le dessin déborde de la largeur, pour que ses bords penchés sortent du cadre comme sur la maquette.
  expect(m.dessinLargeur).toBeGreaterThan(1200)
  expect(m.hauteur).toBeGreaterThan(Math.round((1200 * 900) / 1600))
})

test('une petite image droite garde sa taille', () => {
  expect(mesuresPenchees(800, 600, 0)).toEqual({ largeur: 800, hauteur: 600, dessinLargeur: 800, dessinHauteur: 600 })
})

test('une photo détourée posée droite garde sa transparence : le fond de la lettre passe dessous', () => {
  expect(formatDeSortie('image/png', 0)).toBe('image/png')
  expect(formatDeSortie('image/webp', 0)).toBe('image/png')
})

test('une photo pleine, ou penchée sur sa couleur à l’envoi, part en JPEG', () => {
  expect(formatDeSortie('image/jpeg', 0)).toBe('image/jpeg')
  expect(formatDeSortie('image/png', 2.5)).toBe('image/jpeg')
})
