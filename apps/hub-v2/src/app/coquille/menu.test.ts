import { MENU, ONGLETS } from './menu'

test('chaque adresse du menu est unique', () => {
  const chemins = MENU.flatMap((d) => d.liens.map((l) => l.chemin))
  expect(new Set(chemins).size).toBe(chemins.length)
})

test('le menu suit les domaines de la spec', () => {
  expect(MENU.map((d) => d.titre)).toEqual([null, 'Communauté', 'Le jeu', 'Fragments et boutique', 'Parler aux joueurs', 'Réglages'])
})

test('chaque onglet du téléphone mène à une adresse du menu', () => {
  const chemins = new Set(MENU.flatMap((d) => d.liens.map((l) => l.chemin)))
  for (const onglet of ONGLETS) expect(chemins.has(onglet.chemin)).toBe(true)
})
