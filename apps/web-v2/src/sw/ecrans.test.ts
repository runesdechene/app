/**
 * QUOI     — la liste blanche du service worker et la pose d'un lien de push sous l'appli.
 */
import { expect, test } from 'vitest'
import { cheminDansLAppli, ecransExplore } from './ecrans'

test('les écrans d’Explore, sous /v2/ (avant la bascule) comme à la racine', () => {
  for (const base of ['/v2/', '/']) {
    for (const ecran of [
      '',
      'accueil',
      'carte/lieu/42',
      'messages',
      'compagnies/compagnie/f-1',
      'compte',
      'bienvenue/carte',
      'da',
      'scan',
      'scan/fragment/4',
      'scan/fragments',
    ]) {
      expect(ecransExplore(base).test(base + ecran)).toBe(true)
    }
  }
})

test('tout le reste du domaine va au serveur', () => {
  for (const chemin of [
    '/scanner',
    '/modeles/mobilenet_v3_small.tflite',
    '/lieu/chateau-de-joux',
    '/mouvement',
    '/sitemap.xml',
    '/sw.js',
    '/accueillir',
    '/v2/accueil',
    '/v2/sw.js',
  ]) {
    expect(ecransExplore('/').test(chemin)).toBe(false)
  }
})

test('un lien de push se pose sous la base de l’appli', () => {
  expect(cheminDansLAppli('/accueil/lieu/1', '/')).toBe('/accueil/lieu/1')
  expect(cheminDansLAppli('/accueil/lieu/1', '/v2/')).toBe('/v2/accueil/lieu/1')
  expect(cheminDansLAppli('/messages?canal=x', '/')).toBe('/messages?canal=x')
})
