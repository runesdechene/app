/**
 * QUOI     — la lecture de `mon_codex` (migration 578).
 * POURQUOI — un motif sans collection arrive avec un héritage vide : il se range « Hors
 *            collection », sans titre à gagner ; un état inconnu est une erreur de contrat.
 */
import { lireCodex } from './lireCodex'

const fragment = {
  id: 1,
  nom: 'Hoplite',
  illustration: 'https://x/h.png',
  etat: 'porte',
  scans: 2,
  numero: 19,
  nouveau: false,
  edition: null,
  editionPrecision: null,
}

const codex = (heritage: string | null, titre: string | null, etat = 'porte') => ({
  totaux: { portes: 1, scannes: 0, inconnus: 0, total: 1 },
  collections: [
    {
      heritage,
      couleur: '#995c2e',
      icone: null,
      titre,
      portes: 1,
      total: 1,
      fragments: [{ ...fragment, etat }],
    },
  ],
})

test('une collection et ses Fragments', () => {
  const lu = lireCodex(codex("D'ombre et d'airain", 'Fils de l’Airain'))
  expect(lu.totaux).toEqual({ portes: 1, scannes: 0, inconnus: 0, total: 1 })
  expect(lu.collections[0]).toMatchObject({
    heritage: "D'ombre et d'airain",
    nom: "D'ombre et d'airain",
    couleur: '#995c2e',
    titre: 'Fils de l’Airain',
  })
  expect(lu.collections[0]?.fragments[0]).toMatchObject({ id: 1, etat: 'porte', numero: 19 })
})

test('un héritage vide ou nul : « Hors collection », sans titre', () => {
  for (const heritage of ['', null]) {
    const lu = lireCodex(codex(heritage, 'Ignoré'))
    expect(lu.collections[0]).toMatchObject({ heritage: null, nom: 'Hors collection', titre: null })
  }
})

test('un état inconnu lève', () => {
  expect(() => lireCodex(codex('X', null, 'perdu'))).toThrow()
})
