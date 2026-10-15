/**
 * QUOI     — les articles du blog (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  creerArticle, enregistrerArticle, lireArticles, publierSurLaBoutique, type Article, type Brouillon, type TypeArticle,
} from '../api/blog'

const CLE = ['hub-blog']

export function useBlog() {
  return useQuery({ queryKey: CLE, queryFn: lireArticles })
}

export function useCreerArticle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ type, titre }: { type: TypeArticle; titre: string }) => creerArticle(type, titre),
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}

export function useEnregistrerArticle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ fiche, brouillon }: { fiche: Article; brouillon: Brouillon }) => enregistrerArticle(fiche, brouillon),
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}

// Publier enregistre d'abord : la boutique reçoit ce qui est à l'écran, pas la dernière sauvegarde.
export function usePublierArticle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ fiche, brouillon }: { fiche: Article; brouillon: Brouillon }) => {
      await publierSurLaBoutique(await enregistrerArticle(fiche, brouillon))
    },
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}
