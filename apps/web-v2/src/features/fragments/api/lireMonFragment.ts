/**
 * QUOI     — l'état d'un Fragment pour l'Explorateur connecté, lu depuis `mon_fragment` (mig. 578 et
 *            579) : inconnu, scanné ou porté, ses scans, son numéro de Porteur, le nombre de
 *            Porteurs, s'il est le signe de son profil (le skin), ses anecdotes et ce qui reste.
 * POURQUOI — `null` quand le Fragment est masqué.
 */
import type { Rarete } from '@/shared/lib/rang'
import type { EtatFragment } from '@/shared/ui/CarteFragment'
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type AnecdoteTrouvee = { texte: string; rarete: Rarete }

export type MonFragment = {
  etat: EtatFragment
  scans: number
  numero: number | null
  porteurs: number
  signe: boolean
  anecdotes: AnecdoteTrouvee[]
  restantes: number
  raresRestantes: number
}

const ETATS: readonly EtatFragment[] = ['inconnu', 'scanne', 'porte']
const RARETES: readonly Rarete[] = ['commune', 'peu_commune', 'rare']

export function lireRarete(v: unknown): Rarete {
  const rarete = RARETES.find((r) => r === v)
  if (!rarete) throw new Error(`rareté inconnue : ${String(v)}`)
  return rarete
}

export function lireAnecdote(v: unknown): AnecdoteTrouvee {
  const o = objet(v)
  return { texte: chaine(o.texte), rarete: lireRarete(o.rarete) }
}

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
    // Avant la migration 579, ces clés manquent : rien de trouvé, rien qui reste.
    anecdotes: liste(lireAnecdote)(o.anecdotes ?? []),
    restantes: nombre(o.restantes ?? 0),
    raresRestantes: nombre(o.raresRestantes ?? 0),
  }
}
