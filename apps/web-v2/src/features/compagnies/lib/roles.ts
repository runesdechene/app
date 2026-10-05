/**
 * QUOI     — le rôle d'un membre dans sa Compagnie, accordé à son genre : « Dame au Lys »,
 *            « Paladin », « Membre ».
 * POURQUOI — la Compagnie nomme ses deux rôles, au masculin et au féminin (Uriel, 05/10) ; chacun
 *            les lit comme ses titres (« Tes titres s'accordent au »).
 */
import type { Role, Roles } from '../api/lireCompagnies'

export function nomDuRole(roles: Roles, role: Role, genre: 'm' | 'f'): string {
  if (role === 'chef') return genre === 'f' ? roles.chefF : roles.chefM
  if (role === 'officier') return genre === 'f' ? roles.officierF : roles.officierM
  return 'Membre'
}
