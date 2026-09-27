/**
 * QUOI     — la table de vérité de la garde d'accès.
 * POURQUOI — c'est la seule logique de la garde ; elle est pure, donc testée à fond ici.
 */
import { decideAccess } from './decideAccess'

test('attend pendant le chargement', () => {
  expect(decideAccess({ status: 'loading' })).toBe('wait')
})

test('propose de réessayer sur erreur réseau, sans éjecter', () => {
  expect(decideAccess({ status: 'error' })).toBe('retry')
})

test('renvoie vers la V1 sans session', () => {
  expect(decideAccess({ status: 'ready', hasSession: false, hasAccess: false })).toBe('leave')
})

test('renvoie vers la V1 avec session mais sans accès', () => {
  expect(decideAccess({ status: 'ready', hasSession: true, hasAccess: false })).toBe('leave')
})

test('laisse entrer un compte autorisé', () => {
  expect(decideAccess({ status: 'ready', hasSession: true, hasAccess: true })).toBe('allow')
})

test('ne laisse jamais entrer sans session, même si l’accès dit oui', () => {
  expect(decideAccess({ status: 'ready', hasSession: false, hasAccess: true })).toBe('leave')
})
