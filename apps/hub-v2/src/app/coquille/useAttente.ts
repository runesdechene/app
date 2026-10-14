/**
 * QUOI     — les nombres des files qui attendent, pour les pastilles du menu.
 * POURQUOI — lus dans la même réponse que l'ouverture, sur la semaine (sa période par défaut :
 *            même clé, un seul appel ; l'attente ne dépend pas de la période). Rien tant
 *            qu'elle n'est pas arrivée.
 */
import { useOuverture } from '@/features/accueil/hooks/useOuverture'
import type { CleAttente } from './menu'

export function useAttente(): Partial<Record<CleAttente, number>> {
  const { data } = useOuverture('semaine')
  if (!data) return {}
  const a = data.attente
  return { photos: a.photos, lieux: a.lieux, signalementsLieu: a.signalements_lieu, signalementsEnigme: a.signalements_enigme, achats: a.achats }
}
