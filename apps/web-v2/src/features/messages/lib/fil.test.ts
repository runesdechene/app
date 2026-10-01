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
  }
}

function passage(type: Passage['type'], quand: string): Passage {
  return { id: `${type}:u9`, type, quand, qui: KELPIE, moi: false }
}

test('les passages se rangent entre les messages, à leur heure', () => {
  const fil = entremeler(
    [message(1, '2026-10-01T08:00:00Z'), message(2, '2026-10-01T10:00:00Z')],
    [passage('arrivee', '2026-10-01T09:00:00Z')],
  )
  expect(fil.map((l) => l.sorte)).toEqual(['message', 'passage', 'message'])
})

test('un passage plus ancien que le premier message chargé ne s’affiche pas', () => {
  const fil = entremeler(
    [message(1, '2026-10-01T08:00:00Z')],
    [passage('connexion', '2026-09-30T08:00:00Z'), passage('arrivee', '2026-10-01T12:00:00Z')],
  )
  expect(fil.map((l) => l.sorte)).toEqual(['message', 'passage'])
})

test('sans message, rien : un passage ne flotte pas seul', () => {
  expect(entremeler([], [passage('arrivee', '2026-10-01T12:00:00Z')])).toEqual([])
})
