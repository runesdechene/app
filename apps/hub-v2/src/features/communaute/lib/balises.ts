/**
 * QUOI     — les balises d'un compte (spec §8, décisions d'Uriel du 14/10 ; « Jamais connecté » et
 *            « En sommeil » recentrée le 16/10). Mêmes règles que les filtres de hub_comptes (mig 523).
 * POURQUOI — fonction pure : chaque règle se teste seule.
 */
import type { Teinte } from '@/shared/ui/Balise'
import type { Compte } from '../api/comptes'

const JOUR = 24 * 3600_000
const QUINZE_JOURS = 15 * JOUR
const BASCULE = Date.parse('2026-10-07T00:00:00+02:00')
const CREES_POUR_EUX = new Set(['stand', 'flyer', 'shopify'])

/** Un compte créé pour quelqu'un (stand, flyer, commande en ligne) qu'il n'a jamais ouvert. */
function jamaisConnecte(c: Compte): boolean {
  return c.provenance !== null && CREES_POUR_EUX.has(c.provenance) && c.derniere_visite === null
}

export function balisesDuCompte(c: Compte, maintenant: Date): { texte: string; teinte: Teinte }[] {
  const t = maintenant.getTime()
  const inscrit = Date.parse(c.inscrit)
  const entree = c.entree_v2 ? Date.parse(c.entree_v2) : null
  const balises: { texte: string; teinte: Teinte }[] = []
  // Un seul état parmi Jamais connecté, Nouveau et En sommeil, dans cet ordre (Uriel, 16/10).
  const jamais = jamaisConnecte(c)
  const nouveau = !jamais && t - inscrit < QUINZE_JOURS
  if (c.role === 'admin') balises.push({ texte: 'Admin', teinte: 'admin' })
  if (jamais) balises.push({ texte: 'Jamais connecté', teinte: 'moderation' })
  if (nouveau) balises.push({ texte: 'Nouveau', teinte: 'nouveau' })
  if (entree !== null && t - entree < QUINZE_JOURS && entree - inscrit > JOUR) balises.push({ texte: 'Réactivé', teinte: 'reactive' })
  if (!jamais && !nouveau && entree === null && inscrit < BASCULE) balises.push({ texte: 'En sommeil', teinte: 'sommeil' })
  if (c.fragments > 0) balises.push({ texte: 'Porteur', teinte: 'porteur' })
  return balises
}
