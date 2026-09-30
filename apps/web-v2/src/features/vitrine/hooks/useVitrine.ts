/**
 * QUOI     — les lectures de la vitrine : les chiffres, les natures, la recherche, l'activité,
 *            l'aperçu d'un lieu.
 * POURQUOI — la recherche attend que la frappe se pose (300 ms) avant de demander : taper
 *            « dolmen » ne lance pas six recherches. Les résultats précédents restent affichés
 *            pendant la suivante, la liste ne clignote pas.
 */
import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  chercher,
  fetchActivite,
  fetchApercu,
  fetchChiffres,
  fetchConnecte,
  fetchNatures,
} from '../api/vitrine'

export function useChiffres() {
  return useQuery({ queryKey: ['vitrine', 'chiffres'], queryFn: fetchChiffres, staleTime: 60_000 })
    .data
}

// Déjà connecté ? « Commencer mon périple » et « Se connecter » mènent alors à la carte.
export function useConnecte() {
  return useQuery({ queryKey: ['vitrine', 'connecte'], queryFn: fetchConnecte }).data ?? false
}

export function useNatures() {
  return (
    useQuery({ queryKey: ['vitrine', 'natures'], queryFn: fetchNatures, staleTime: Infinity })
      .data ?? []
  )
}

export function useActivite() {
  return (
    useQuery({ queryKey: ['vitrine', 'activite'], queryFn: fetchActivite, staleTime: 60_000 })
      .data ?? []
  )
}

// Une valeur qui ne change qu'une fois la frappe posée.
function usePose<T>(valeur: T, delai: number) {
  const [posee, setPosee] = useState(valeur)
  useEffect(() => {
    const minuteur = setTimeout(() => {
      setPosee(valeur)
    }, delai)
    return () => {
      clearTimeout(minuteur)
    }
  }, [valeur, delai])
  return posee
}

export function useRecherche(texte: string, nature: string | null) {
  const pose = usePose(texte.trim(), 300)
  const actif = pose.length >= 2 || nature !== null
  const query = useQuery({
    queryKey: ['vitrine', 'recherche', pose, nature],
    queryFn: () => chercher(pose, nature),
    enabled: actif,
    placeholderData: keepPreviousData,
  })
  return actif ? (query.data ?? null) : null
}

export function useApercu(id: string) {
  const query = useQuery({ queryKey: ['vitrine', 'apercu', id], queryFn: () => fetchApercu(id) })
  return { apercu: query.data, erreur: query.isError }
}
