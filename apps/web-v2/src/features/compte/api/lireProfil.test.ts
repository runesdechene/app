/**
 * QUOI     — la lecture du profil renvoyé par get_profil_explorateur : tout ou rien.
 * POURQUOI — un profil à moitié lu afficherait des trous ; on préfère « introuvable ».
 */
import { lireProfil } from './lireProfil'

const COMPLET = {
  id: 'u1',
  nom: 'Uriel',
  avatarUrl: null,
  niveau: 12,
  titres: [{ id: 1, nom: 'Chevalier errant', condition: { stat: 'places_visited', min: 50 } }],
  bio: 'Chevalier errant',
  instagram: 'uriel.runesdechene',
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: true,
  role: 'admin',
  attache: {
    texte: 'Noble représentant des Alpes-Maritimes',
    silhouette: { d: 'M 0 0 L 1 0 1 -1 Z', viewBox: '0 -1 1 1' },
  },
  fragments: [{ id: 3, nom: 'Hoplite', imageUrl: 'https://x/h.webp' }],
  ajoutes: [
    {
      id: 'p1',
      nom: 'Dolmen',
      imageUrl: null,
      latitude: 43.7,
      longitude: 7.26,
      categorie: { icone: 'https://x/dolmen.svg', couleur: '#8c3166' },
      auteur: { id: 'u1', nom: 'Uriel', avatarUrl: null },
    },
  ],
  nbVisites: 4,
  envies: null,
  signe: { id: 3, nom: 'Hoplite', imageUrl: 'https://x/h.webp' },
  fragmentsADecouvrir: 5,
  compagnies: [],
  connaissances: [
    { culture: { id: 'byzantine', nom: 'Byzance', couleur: '#a93d76', icone: null }, titre: 'Sage de Byzance', rang: 6, enigmes: 36 },
  ],
  polymathe: null,
  estMoi: true,
}

test('un profil complet est lu tel quel', () => {
  expect(lireProfil(COMPLET)).toEqual(COMPLET)
})

test('null (Explorateur inconnu) → null', () => {
  expect(lireProfil(null)).toBeNull()
})

test('un champ manquant → null', () => {
  const sansNiveau: Partial<typeof COMPLET> = { ...COMPLET }
  delete sansNiveau.niveau
  expect(lireProfil(sansNiveau)).toBeNull()
})

test('un champ du mauvais type → null', () => {
  expect(lireProfil({ ...COMPLET, niveau: '12' })).toBeNull()
  expect(lireProfil({ ...COMPLET, ajoutes: [{ id: 1, nom: 'x', imageUrl: null }] })).toBeNull()
})

test('un rôle inconnu ne donne aucun badge', () => {
  expect(lireProfil({ ...COMPLET, role: 'user' })?.role).toBeNull()
})

test('les envies masquées restent null, montrées elles sont une liste', () => {
  expect(lireProfil(COMPLET)?.envies).toBeNull()
  expect(lireProfil({ ...COMPLET, envies: [] })?.envies).toEqual([])
})

test('une condition de titre illisible devient null, le titre reste', () => {
  const p = lireProfil({
    ...COMPLET,
    titres: [{ id: 1, nom: 'Chevalier errant', condition: 'bizarre' }],
  })
  expect(p?.titres[0]?.condition).toBeNull()
})

test('pas de signe : null', () => {
  expect(lireProfil({ ...COMPLET, signe: null })?.signe).toBeNull()
})

test('une carte sans coordonnées, catégorie ni auteur reste lisible', () => {
  const p = lireProfil({ ...COMPLET, ajoutes: [{ id: 'p2', nom: 'Abbaye', imageUrl: null }] })
  expect(p?.ajoutes[0]).toEqual({
    id: 'p2',
    nom: 'Abbaye',
    imageUrl: null,
    latitude: null,
    longitude: null,
    categorie: null,
    auteur: null,
  })
})

test('le nombre de lieux visités ; absent (profil en cache d’avant la 431) → 0', () => {
  expect(lireProfil(COMPLET)?.nbVisites).toBe(4)
  expect(lireProfil({ ...COMPLET, nbVisites: undefined })?.nbVisites).toBe(0)
})

test('ses Compagnies se lisent ; absentes, aucune', () => {
  const p = lireProfil({
    ...COMPLET,
    compagnies: [{ id: 'f-lys', nom: 'Le Lys de Fer', couleur: '#5f6f86' }],
  })
  expect(p?.compagnies).toEqual([{ id: 'f-lys', nom: 'Le Lys de Fer', couleur: '#5f6f86' }])
  expect(lireProfil({ ...COMPLET, compagnies: undefined })?.compagnies).toEqual([])
})

test('avant la migration 452, ni connaissances ni Polymathe', () => {
  const ancien: Record<string, unknown> = { ...COMPLET }
  delete ancien.connaissances
  delete ancien.polymathe
  const p = lireProfil(ancien)
  expect(p?.connaissances).toEqual([])
  expect(p?.polymathe).toBeNull()
})
