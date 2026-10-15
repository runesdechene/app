/**
 * QUOI     — la phrase de partage d'un lieu, depuis le texte réglé dans le Hub.
 * POURQUOI — pendant le chargement, la phrase d'origine : le bouton ne doit jamais attendre. Le texte change
 *            rarement : une heure de cache.
 */
import { useQuery } from '@tanstack/react-query'
import { lireModeleDePartage, phraseDePartage } from '../api/phraseDePartage'

const UNE_HEURE = 60 * 60 * 1000

export function usePhraseDePartage(nom: string): string {
  const { data } = useQuery({ queryKey: ['modele-de-partage'], queryFn: lireModeleDePartage, staleTime: UNE_HEURE })
  return phraseDePartage(data ?? null, nom)
}
