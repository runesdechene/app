import { expect, test } from 'vitest'
import { lireAjoutes, lireChemins, lireNouveaute, lireSalut } from './lireAccueil'

const CHEMIN = {
  id: 'visite:l1:u1',
  type: 'visite',
  quand: '2026-09-28T13:41:27Z',
  qui: { id: 'u1', nom: 'Luna', avatar: null },
  lieu: { id: 'l1', nom: 'Pointe du Becquet', region: 'Manche' },
  moi: false,
  saluts: 2,
  salue: false,
}

test('la nouveauté se lit ; sans annonce, rien', () => {
  expect(lireNouveaute({ titre: 'La loutre', image: 'i.jpg', lien: null })).toEqual({
    titre: 'La loutre',
    image: 'i.jpg',
    lien: null,
  })
  expect(lireNouveaute(null)).toBeNull()
})

test('un lieu ajouté prend la forme d’une carte de lieu', () => {
  const [lieu] = lireAjoutes([
    {
      id: 'l1',
      nom: 'Pointe du Becquet',
      imageUrl: null,
      latitude: 49.6,
      longitude: -1.5,
      categorie: { icone: 'i.svg' },
      auteur: { nom: 'Luna', avatarUrl: null },
    },
  ])
  expect(lieu).toMatchObject({ nom: 'Pointe du Becquet', categorie: { icone: 'i.svg' } })
})

test('une ligne du fil se lit ; une arrivée n’a pas de lieu', () => {
  const [visite, arrivee] = lireChemins([
    CHEMIN,
    { ...CHEMIN, id: 'arrivee:u1', type: 'arrivee', lieu: null },
  ])
  expect(visite?.lieu?.region).toBe('Manche')
  expect(arrivee?.lieu).toBeNull()
})

test('un type de ligne inconnu est refusé, pas deviné', () => {
  expect(() => lireChemins([{ ...CHEMIN, type: 'couronne' }])).toThrow()
})

test('un salut rend le nombre et si je salue', () => {
  expect(lireSalut({ saluts: 3, salue: true })).toEqual({ saluts: 3, salue: true })
})
