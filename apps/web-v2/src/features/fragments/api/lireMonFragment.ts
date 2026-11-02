/**
 * QUOI     — l'état d'un Fragment pour l'Explorateur connecté, lu depuis `mon_fragment` (mig. 578) :
 *            inconnu, scanné ou porté, ses scans, son numéro de Porteur, le nombre de Porteurs, et
 *            s'il est le signe de son profil (le skin).
 * POURQUOI — `null` quand le Fragment est masqué.
 */
import type { EtatFragment } from '@/shared/ui/CarteFragment'
import { booleen, nombre, objet, ouNull } from '@/shared/lib/lire'

export type MonFragment = {
  etat: EtatFragment
  scans: number
  numero: number | null
  porteurs: number
  signe: boolean
}

const ETATS: readonly EtatFragment[] = ['inconnu', 'scanne', 'porte']

export function lireMonFragment(v: unknown): MonFragment | null {
  if (v === null) return null
  const o = objet(v)
  const etat = ETATS.find((e) => e === o.etat)
  if (!etat) throw new Error(`état inconnu : ${String(o.etat)}`)
  return {
    etat,
    scans: nombre(o.scans),
    numero: ouNull(nombre)(o.numero),
    porteurs: nombre(o.porteurs),
    signe: booleen(o.signe),
  }
}
