/**
 * QUOI     — le filtre de « Sur les chemins » : chaque ligne a sa famille (Lieux, Gens, Énigmes), on
 *            en éteint une à volonté mais jamais toutes, et le choix est gardé sur l'appareil.
 */
import { expect, test } from 'vitest'
import type { TypeDeChemin } from '../api/lireAccueil'
import { basculerFamille, filtrerChemins, garderFamilles, lireFamilles, TOUTES } from './familles'

const ligne = (type: TypeDeChemin) => ({ id: type, type })

test('chaque ligne a sa famille', () => {
  const fil = (['visite', 'ajout', 'revendication', 'enrichi', 'modifie', 'arrivee', 'fondation', 'adhesion', 'enigme'] as const).map(ligne)
  expect(filtrerChemins(fil, new Set(['lieux'])).map((c) => c.type)).toEqual(['visite', 'ajout', 'revendication', 'enrichi', 'modifie'])
  expect(filtrerChemins(fil, new Set(['gens'])).map((c) => c.type)).toEqual(['arrivee', 'fondation', 'adhesion'])
  expect(filtrerChemins(fil, new Set(['enigmes'])).map((c) => c.type)).toEqual(['enigme'])
  expect(filtrerChemins(fil, TOUTES)).toHaveLength(9)
})

test('on éteint une famille, jamais la dernière', () => {
  const sansEnigmes = basculerFamille(TOUTES, 'enigmes')
  expect([...sansEnigmes]).toEqual(['lieux', 'gens'])
  expect([...basculerFamille(sansEnigmes, 'enigmes')].sort()).toEqual(['enigmes', 'gens', 'lieux'])
  const seule = new Set(['lieux'] as const)
  expect([...basculerFamille(seule, 'lieux')]).toEqual(['lieux'])
})

test('le choix est gardé ; illisible ou absent, tout est allumé', () => {
  const memoire = new Map<string, string>()
  const stockage = {
    getItem: (c: string) => memoire.get(c) ?? null,
    setItem: (c: string, v: string) => {
      memoire.set(c, v)
    },
  }
  expect([...lireFamilles(stockage)].sort()).toEqual(['enigmes', 'gens', 'lieux'])
  garderFamilles(stockage, new Set(['lieux', 'gens']))
  expect([...lireFamilles(stockage)].sort()).toEqual(['gens', 'lieux'])
  memoire.set([...memoire.keys()][0] ?? '', 'pas du json')
  expect([...lireFamilles(stockage)].sort()).toEqual(['enigmes', 'gens', 'lieux'])
  expect([...lireFamilles(null)].sort()).toEqual(['enigmes', 'gens', 'lieux'])
})
