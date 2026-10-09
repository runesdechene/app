/**
 * QUOI     — le rôle d'un membre, accordé à son genre.
 */
import { expect, test } from 'vitest'
import { nomDuRole } from './roles'

const roles = {
  chefM: 'Seigneur au Lys',
  chefF: 'Dame au Lys',
  officierM: 'Paladin',
  officierF: 'Paladine',
}

test('le rôle s’accorde', () => {
  expect(nomDuRole(roles, 'chef', 'f')).toBe('Dame au Lys')
  expect(nomDuRole(roles, 'chef', 'm')).toBe('Seigneur au Lys')
  expect(nomDuRole(roles, 'officier', 'f')).toBe('Paladine')
  expect(nomDuRole(roles, 'membre', 'f')).toBe('Membre')
})
