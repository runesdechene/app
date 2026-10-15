import type { Compte } from '../api/comptes'
import { versCsv } from './csv'

const c: Compte = {
  id: 'u1', nom: 'Jean; « le » Bon', email: 'j@x.fr', avatar: null, role: 'user', provenance: 'app',
  inscrit: '2026-10-14T09:00:00Z', derniere_visite: null, entree_v2: null, client: false,
  departement: null, code: null, fragments: 0,
}

test('une ligne d’en-tête puis une ligne par compte, séparées par des points-virgules', () => {
  const lignes = versCsv([c]).split('\r\n')
  expect(lignes[0]).toBe('nom;email;provenance;departement;fragments;inscrit;derniere_visite;role')
  expect(lignes[1]).toBe('"Jean; « le » Bon";j@x.fr;app;;0;2026-10-14T09:00:00Z;;user')
})

test('un guillemet est doublé', () => {
  expect(versCsv([{ ...c, nom: 'Le "Grand"' }]).split('\r\n')[1]?.startsWith('"Le ""Grand"""')).toBe(true)
})

test('une cellule qui ressemble à une formule est neutralisée', () => {
  const ligne = versCsv([{ ...c, nom: '=SOMME(1;2)', email: '-1+1' }]).split('\r\n')[1]
  expect(ligne?.startsWith(`"'=SOMME(1;2)";'-1+1;`)).toBe(true)
})
