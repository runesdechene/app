/**
 * QUOI     — les lectures du parcours (natures, époques, lieux voisins, l'endroit en mots) et le
 *            geste final : poser le lieu.
 * POURQUOI — poser le lieu envoie d'abord les photos (une à une), puis crée le lieu avec la
 *            position du téléphone si elle est déjà accordée : la base décide alors si la visite
 *            compte (200 m). Ensuite la carte, l'Accueil et le profil se relisent : le lieu y est.
 * ATTENTION — l'endroit (Nominatim) n'est demandé qu'une fois la carte posée, arrondi à une
 *            dizaine de mètres : glisser la carte ne déclenche pas une rafale de questions.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Point } from '@/shared/lib/distance'
import { positionSiAutorisee } from '@/shared/lib/position'
import { ajouterLieu, envoyerPhotos, fetchEpoques, fetchNatures, fetchVoisins } from '../api/ajout'
import { endroitDe } from '../lib/adresse'
import type { Brouillon } from '../lib/brouillon'

export function useNatures() {
  return (
    useQuery({ queryKey: ['ajout', 'natures'], queryFn: fetchNatures, staleTime: Infinity }).data ??
    []
  )
}

export function useEpoques() {
  return (
    useQuery({ queryKey: ['ajout', 'epoques'], queryFn: fetchEpoques, staleTime: Infinity }).data ??
    []
  )
}

function cle(point: Point | null) {
  return point ? [point.latitude.toFixed(4), point.longitude.toFixed(4)] : [null, null]
}

export function useVoisins(point: Point | null) {
  const query = useQuery({
    queryKey: ['ajout', 'voisins', ...cle(point)],
    queryFn: () => (point ? fetchVoisins(point) : []),
    enabled: point !== null,
  })
  return query.data ?? []
}

export function useEndroit(point: Point | null) {
  const query = useQuery({
    queryKey: ['ajout', 'endroit', ...cle(point)],
    queryFn: ({ signal }) => (point ? endroitDe(point, signal) : null),
    enabled: point !== null,
    staleTime: Infinity,
    retry: false,
  })
  return query.data ?? null
}

export function usePoser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (b: Brouillon) => {
      const images = await envoyerPhotos(b.photos)
      return ajouterLieu(b, images, await positionSiAutorisee())
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['accueil'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
    },
  })
}
