/**
 * QUOI     — les phrases de la feuille d'une énigme : gains, connaissance, prochain titre, pied, erreur.
 */
import { expect, test } from 'vitest'
import type { Verdict } from '../api/lireEnigmes'
import { connaissanceEnClair, gainsEnClair, messageErreur, MOTS_DE_FETE, motDeFete, piedEnClair, prochainEnClair } from './enigmeEnClair'

const verdict = (v: Partial<Verdict>): Verdict => ({
  juste: true, reponse: 'Sainte-Sophie', explication: '', xp: 1, gagnes: 2, points: 16, total: 130,
  nouveauxTitres: [], prochain: { nom: 'Lettrée de Byzance', seuil: 20 }, resteEnAttente: 3,
  niveau: { niveau: 12, avant: 0.6, apres: 0.62 }, ...v,
})

test('les gains : l’XP puis la connaissance, rien quand c’est faux', () => {
  expect(gainsEnClair(verdict({}), 'Byzance')).toEqual(['+1 XP', '+2 connaissance · Byzance'])
  expect(gainsEnClair(verdict({ juste: false, xp: 0, gagnes: 0 }), 'Byzance')).toEqual([])
})

test('la connaissance en pourcentage, arrondi vers le bas', () => {
  expect(connaissanceEnClair(16, 130, 'Byzance')).toBe('Byzance : tu en connais 12 %.')
  expect(connaissanceEnClair(0, 0, 'Byzance')).toBe('Byzance : tu en connais 0 %.')
})

test('le prochain titre, ou tous gagnés', () => {
  expect(prochainEnClair(verdict({}), 'Byzance')).toBe('Encore 4 points pour « Lettrée de Byzance ».')
  expect(prochainEnClair(verdict({ points: 19 }), 'Byzance')).toBe('Encore 1 point pour « Lettrée de Byzance ».')
  expect(prochainEnClair(verdict({ prochain: null }), 'Byzance')).toBe('Tous les titres de Byzance sont à toi.')
})

test('le pied dit ce qui attend encore', () => {
  expect(piedEnClair(0)).toBe('C’était le dernier « ? » qui t’attendait. D’autres s’éveillent chaque matin.')
  expect(piedEnClair(1)).toBe('Un autre « ? » t’attend sur la carte.')
  expect(piedEnClair(3)).toBe('3 autres « ? » t’attendent sur la carte.')
})

test('une énigme rendormie se dit, le reste aussi', () => {
  expect(messageErreur({ code: 'P0002' })).toBe('Cette énigme s’est rendormie.')
  expect(messageErreur(new Error('réseau'))).toBe('La réponse n’est pas partie. Réessaie.')
})

test('le mot de la fête se tire dans la liste, à chaque fois un de ses mots', () => {
  expect(MOTS_DE_FETE).toContain('Bien vu !')
  expect(motDeFete(0)).toBe(MOTS_DE_FETE[0])
  expect(motDeFete(0.9999)).toBe(MOTS_DE_FETE[MOTS_DE_FETE.length - 1])
})
