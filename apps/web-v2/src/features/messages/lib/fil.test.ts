import { expect, test } from 'vitest'
import type { Message, Passage } from '../api/lireRegistre'
import { entremeler } from './fil'

const KELPIE = { id: 'u9', nom: 'Kelpie', avatar: null }

function message(id: number, quand: string): Message {
  return {
    id,
    canal: 'general',
    texte: 'bonjour',
    quand,
    auteur: { id: 'u1', nom: 'Uriel', avatar: null },
    moi: false,
    mentions: [],
    mentionneMoi: false,
    coeurs: [],
    aime: false,
  }
}

function passage(type: Passage['type'], quand: string, qui = KELPIE): Passage {
  return { id: `${type}:${qui.id}`, type, quand, qui, moi: false }
}

const ASH = { id: 'u8', nom: 'Ash', avatar: null }
const LUNA = { id: 'u7', nom: 'Luna', avatar: null }
// « Maintenant », pour les tests : le 1er octobre à 13 h.
const MAINTENANT = new Date('2026-10-01T13:00:00Z').getTime()

test('les passages se rangent entre les messages, à leur heure', () => {
  const fil = entremeler(
    [message(1, '2026-10-01T08:00:00Z'), message(2, '2026-10-01T10:00:00Z')],
    [passage('arrivee', '2026-10-01T09:00:00Z')],
    MAINTENANT,
  )
  expect(fil.map((l) => l.sorte)).toEqual(['message', 'arrivee', 'message'])
})

test('un passage plus ancien que le premier message chargé ne s’affiche pas', () => {
  const fil = entremeler(
    [message(1, '2026-10-01T08:00:00Z')],
    [passage('connexion', '2026-09-30T08:00:00Z'), passage('arrivee', '2026-10-01T12:00:00Z')],
    MAINTENANT,
  )
  expect(fil.map((l) => l.sorte)).toEqual(['message', 'arrivee'])
})

test('sans message, rien : un passage ne flotte pas seul', () => {
  expect(entremeler([], [passage('arrivee', '2026-10-01T12:00:00Z')], MAINTENANT)).toEqual([])
})

test('les connexions qui se suivent ne font qu’une ligne ; un message ou une arrivée la coupe', () => {
  const fil = entremeler(
    [message(1, '2026-10-01T08:00:00Z'), message(2, '2026-10-01T11:00:00Z')],
    [
      passage('connexion', '2026-10-01T09:00:00Z', KELPIE),
      passage('connexion', '2026-10-01T09:30:00Z', ASH),
      passage('connexion', '2026-10-01T11:30:00Z', LUNA),
      passage('arrivee', '2026-10-01T12:00:00Z', ASH),
      passage('connexion', '2026-10-01T12:30:00Z', LUNA),
    ],
    MAINTENANT,
  )
  expect(fil.map((l) => l.sorte)).toEqual([
    'message',
    'connexions',
    'message',
    'connexions',
    'arrivee',
    'connexions',
  ])
  const premier = fil[1]
  expect(premier?.sorte === 'connexions' && premier.passages.map((p) => p.qui.nom)).toEqual([
    'Kelpie',
    'Ash',
  ])
  // La ligne d'un groupe prend l'heure de sa dernière connexion.
  expect(premier?.quand).toBe('2026-10-01T09:30:00Z')
})

test('une connexion de plus de 24 heures ne s’affiche plus ; une arrivée, si', () => {
  const fil = entremeler(
    [message(1, '2026-09-29T08:00:00Z')],
    [
      passage('connexion', '2026-09-30T12:00:00Z', KELPIE),
      passage('arrivee', '2026-09-30T12:30:00Z', ASH),
      passage('connexion', '2026-10-01T09:00:00Z', LUNA),
    ],
    MAINTENANT,
  )
  expect(fil.map((l) => l.sorte)).toEqual(['message', 'arrivee', 'connexions'])
})
