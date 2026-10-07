/**
 * QUOI     — la liste blanche du service worker et la pose d'un lien de push sous l'appli.
 */
import { expect, test } from 'vitest'
import { cheminDansLAppli, ecransExplore } from './ecrans'

test('les écrans d’Explore, sous /v2/ comme sous /explore/', () => {
  for (const base of ['/v2/', '/explore/']) {
    for (const ecran of [
      '',
      'accueil',
      'carte/lieu/42',
      'messages',
      'compagnies/compagnie/f-1',
      'compte',
      'bienvenue/carte',
      'da',
    ]) {
      expect(ecransExplore(base).test(base + ecran)).toBe(true)
    }
  }
})

test('tout le reste du domaine va au serveur', () => {
  for (const chemin of [
    '/',
    '/campement',
    '/campement/accueil',
    '/scan',
    '/lieu/chateau-de-joux',
    '/mouvement',
    '/sitemap.xml',
    '/carte',
    '/explore/accueillir',
    '/v2/accueil',
  ]) {
    expect(ecransExplore('/explore/').test(chemin)).toBe(false)
  }
})

test('un lien de push se pose sous la base de l’appli', () => {
  expect(cheminDansLAppli('/accueil/lieu/1', '/explore/')).toBe('/explore/accueil/lieu/1')
  expect(cheminDansLAppli('/accueil/lieu/1', '/v2/')).toBe('/v2/accueil/lieu/1')
  expect(cheminDansLAppli('/messages?canal=x', '/explore/')).toBe('/explore/messages?canal=x')
})
