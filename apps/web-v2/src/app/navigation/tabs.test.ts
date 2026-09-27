/**
 * QUOI     — les règles des onglets : quel onglet est actif, que fait un toucher.
 * POURQUOI — conventions mobiles (spec socle §4bis) ; logique pure, testée ici sans navigateur.
 */
import { isTabId, resolveTabPress, tabOf, TABS } from './tabs'

test('cinq onglets, dans l’ordre de la maquette', () => {
  expect(TABS.map((t) => t.label)).toEqual(['Accueil', 'Carte', 'Messages', 'Codex', 'Campement'])
})

test('reconnaît l’onglet à partir du premier segment', () => {
  expect(tabOf('/carte')).toBe('carte')
  expect(tabOf('/carte/compte')).toBe('carte')
  expect(tabOf('/nimporte')).toBeNull()
  expect(tabOf('/')).toBeNull()
})

test('isTabId filtre les valeurs inconnues', () => {
  expect(isTabId('codex')).toBe(true)
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
    resolveTabPress({ active: 'accueil', pressed: 'codex', pathname: '/accueil', memory: {} }),
  ).toEqual({ kind: 'navigate', to: '/codex' })
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
