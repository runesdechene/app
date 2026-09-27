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
  attache: 'Noble représentant des Alpes-Maritimes',
  fragments: [{ id: 3, nom: 'Hoplite', imageUrl: 'https://x/h.webp' }],
  ajoutes: [{ id: 'p1', nom: 'Dolmen', imageUrl: null }],
  visites: [],
  envies: null,
  signe: { id: 3, nom: 'Hoplite', imageUrl: 'https://x/h.webp' },
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
