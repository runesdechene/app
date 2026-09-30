/**
 * QUOI     — les règles des onglets : quel onglet est actif, que fait un toucher.
 * POURQUOI — conventions mobiles (spec socle §4bis) ; logique pure, testée ici sans navigateur.
 */
import { aRetenir, isTabId, resolveTabPress, tabOf, TABS } from './tabs'

test('quatre onglets, dans l’ordre de la maquette', () => {
  expect(TABS.map((t) => t.id)).toEqual(['accueil', 'carte', 'messages', 'compte'])
  expect(isTabId('codex')).toBe(false)
  expect(isTabId('compte')).toBe(true)
})

test('reconnaît l’onglet à partir du premier segment', () => {
  expect(tabOf('/carte')).toBe('carte')
  expect(tabOf('/carte/compte')).toBe('carte')
  expect(tabOf('/nimporte')).toBeNull()
  expect(tabOf('/')).toBeNull()
})

test('isTabId filtre les valeurs inconnues', () => {
  expect(isTabId('messages')).toBe(true)
  expect(isTabId('registre')).toBe(false)
  expect(isTabId(undefined)).toBe(false)
})

test('changer d’onglet rouvre sa dernière adresse', () => {
  expect(
    resolveTabPress({
      active: 'accueil',
      pressed: 'carte',
      pathname: '/accueil',
      memory: { carte: '/carte/compte' },
    }),
  ).toEqual({ kind: 'navigate', to: '/carte/compte' })
})

test('changer d’onglet sans mémoire ouvre sa racine', () => {
  expect(
    resolveTabPress({ active: 'accueil', pressed: 'compte', pathname: '/accueil', memory: {} }),
  ).toEqual({ kind: 'navigate', to: '/compte' })
})

test('toucher l’onglet actif hors de sa racine remonte à la racine', () => {
  expect(
    resolveTabPress({
      active: 'carte',
      pressed: 'carte',
      pathname: '/carte/compte',
      memory: { carte: '/carte/compte' },
    }),
  ).toEqual({ kind: 'navigate', to: '/carte' })
})

test('toucher l’onglet actif à sa racine remonte en haut, sans naviguer', () => {
  expect(
    resolveTabPress({ active: 'carte', pressed: 'carte', pathname: '/carte', memory: {} }),
  ).toEqual({ kind: 'scrollTop' })
})

test('un onglet ne retient pas un passage : la feuille « Ajouter » ni le parcours d’ajout', () => {
  // Retenu, le parcours se rouvrait en revenant sur l'onglet après l'avoir quitté (Uriel, 30/09).
  expect(aRetenir('/accueil/ajouter')).toBe(false)
  expect(aRetenir('/accueil/ajouter/lieu/photo')).toBe(false)
  expect(aRetenir('/accueil/lieu/abc')).toBe(true)
  expect(aRetenir('/carte')).toBe(true)
})
