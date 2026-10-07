/**
 * QUOI     — la liste et la fiche d'une Compagnie se lisent ; un rôle inconnu est refusé.
 */
import { expect, test } from 'vitest'
import { lireFicheCompagnie, lireListe } from './lireCompagnies'

const CARTE = {
  id: 'f-lys',
  nom: 'Le Lys de Fer',
  devise: 'Les forteresses de l’Est.',
  couleur: '#5f6f86',
  avatar: null,
  privee: false,
  membres: 35,
  role: 'chef',
  demandee: false,
}

test('la liste se lit', () => {
  const l = lireListe({ porteur: true, miennes: [CARTE], autres: [] })
  expect(l.porteur).toBe(true)
  expect(l.miennes[0]).toMatchObject({ nom: 'Le Lys de Fer', role: 'chef', membres: 35 })
})

test('un rôle inconnu est refusé', () => {
  expect(() =>
    lireListe({ porteur: true, miennes: [{ ...CARTE, role: 'roi' }], autres: [] }),
  ).toThrow()
})

test('la fiche se lit ; disparue, elle vaut null', () => {
  const f = lireFicheCompagnie({
    id: 'f-lys',
    nom: 'Le Lys de Fer',
    devise: null,
    mission: 'Arpenter les forteresses.',
    couleur: '#5f6f86',
    avatar: null,
    privee: true,
    fondeeLe: '2026-06-12T10:00:00Z',
    roles: {
      chefM: 'Seigneur au Lys',
      chefF: 'Dame au Lys',
      officierM: 'Paladin',
      officierF: 'Paladine',
    },
    monRole: null,
    demandee: true,
    nbMembres: 1,
    membres: [{ id: 'u1', nom: 'Uriel', avatar: null, role: 'chef', genre: 'm' }],
    lieux: [{ id: 'l1', nom: 'Château de Joux', par: 'Gautier', quand: '2026-09-28T10:00:00Z' }],
    demandes: [],
  })
  expect(f).toMatchObject({ privee: true, demandee: true, monRole: null })
  expect(f?.membres[0]).toMatchObject({ role: 'chef', genre: 'm' })
  expect(lireFicheCompagnie(null)).toBeNull()
})
