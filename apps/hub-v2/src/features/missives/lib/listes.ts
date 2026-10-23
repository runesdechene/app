/**
 * QUOI     — le nom de chaque liste et qui y entre, tels que le Hub les écrit (maquette 713:2091).
 */
import type { Liste, Role } from '../api/listes'

export const LISTES: Record<Liste, { nom: string; regle: string }> = {
  tous: { nom: 'Tout le monde', regle: 'Tous les comptes' },
  prospects: { nom: 'Prospects', regle: 'Inscrits, aucun Fragment' },
  porteurs: { nom: 'Porteurs', regle: 'Au moins un Fragment' },
  meilleurs: { nom: 'Meilleurs clients', regle: '5 Fragments ou plus' },
  ambassadeurs: { nom: 'Ambassadeurs et égéries', regle: 'Choisis par toi' },
}

export const ROLES: Record<Role, string> = { ambassadeur: 'ambassadeur', egerie: 'égérie' }
