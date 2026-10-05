/**
 * QUOI     — chaque sorte de notification a sa phrase ; qui et le lieu sont des morceaux à part.
 */
import { expect, test } from 'vitest'
import type { Notification } from '../api/lireNotifications'
import { phraseDe } from './phrase'

const base: Notification = {
  id: 1,
  type: 'like_contribution',
  quand: '2026-09-30T08:00:00Z',
  lu: false,
  qui: { id: 'k', nom: 'Kelpie', avatar: null },
  lieu: { id: 'l', nom: 'Château de Jonjeac' },
  nombre: null,
  extrait: null,
  evenement: null,
}
const texte = (n: Notification) =>
  phraseDe(n)
    .map((m) => m.texte)
    .join('')

test('les cœurs, les récits, les photos : qui, puis le lieu', () => {
  expect(phraseDe(base)).toEqual([
    { texte: 'Kelpie', sorte: 'qui' },
    { texte: ' a envoyé des cœurs à ', sorte: 'texte' },
    { texte: 'Château de Jonjeac', sorte: 'lieu' },
  ])
  expect(texte({ ...base, type: 'coeur_mot' })).toBe('Kelpie a aimé ton mot sur Château de Jonjeac')
  expect(texte({ ...base, type: 'description_edited' })).toBe(
    'Kelpie a enrichi le récit de Château de Jonjeac',
  )
})

test('les paliers comptent, au singulier comme au pluriel', () => {
  expect(texte({ ...base, type: 'exploration', qui: null, nombre: 1 })).toBe(
    '1 Explorateur a foulé Château de Jonjeac aujourd’hui',
  )
  expect(texte({ ...base, type: 'exploration', qui: null, nombre: 4 })).toBe(
    '4 Explorateurs ont foulé Château de Jonjeac aujourd’hui',
  )
  expect(texte({ ...base, type: 'milestone_vues', qui: null, nombre: 100 })).toBe(
    'Ta fiche de Château de Jonjeac a été vue 100 fois',
  )
})

test('une mention cite le message ; un salut dit ce qui est salué', () => {
  expect(texte({ ...base, type: 'mention', lieu: null, extrait: 'tu passes samedi ?' })).toBe(
    'Kelpie t’a mentionné dans le Registre : « tu passes samedi ? »',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'visite' })).toBe(
    'Kelpie a salué ta visite de Château de Jonjeac',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'arrivee', lieu: null })).toBe(
    'Kelpie a salué ton arrivée',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'message', lieu: null })).toBe(
    'Kelpie a aimé ton message',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'connexion', lieu: null })).toBe(
    'Kelpie a salué ton passage',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'revendication', lieu: null })).toBe(
    'Kelpie a salué ta revendication',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'enrichi', lieu: null })).toBe(
    'Kelpie a salué ton récit',
  )
  expect(texte({ ...base, type: 'salut', evenement: 'modifie', lieu: null })).toBe(
    'Kelpie a salué ta modification',
  )
})

test('un lieu disparu, un compte effacé : la phrase tient quand même', () => {
  expect(texte({ ...base, qui: null, lieu: null })).toBe(
    'Quelqu’un a envoyé des cœurs à un lieu disparu',
  )
})
