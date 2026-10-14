import { resumeDesEcoutes } from './ecoutes'

const ligne = (ecoutes: number, completions: number, progression: number | null, mesurables: number, derniere: string | null) =>
  ({ illustration_handle: 'h', ecoutes, completions, taux: null, progression, mesurables, ecoutes_motif: 0, ecoutes_produit: 0, derniere_ecoute: derniere })

test('rien écouté : pas de taux, pas de quoi trancher', () => {
  expect(resumeDesEcoutes([])).toMatchObject({ ecoutes: 0, taux: null, progression: null, assez: false, derniere: null })
})
test('le taux sur toutes les écoutes, à un chiffre après la virgule', () => {
  expect(resumeDesEcoutes([ligne(20, 7, null, 0, null), ligne(10, 3, null, 0, null)])).toMatchObject({ ecoutes: 30, taux: 33.3, assez: true })
})
test('la progression pèse chaque Fragment par ses écoutes mesurées', () => {
  expect(resumeDesEcoutes([ligne(4, 0, 50, 3, null), ligne(1, 0, 100, 1, null)]).progression).toBe(62.5)
})
test('la dernière écoute est la plus récente', () => {
  expect(resumeDesEcoutes([ligne(1, 0, null, 0, '2026-10-01T00:00:00Z'), ligne(1, 0, null, 0, '2026-10-12T00:00:00Z')]).derniere).toBe('2026-10-12T00:00:00Z')
})
