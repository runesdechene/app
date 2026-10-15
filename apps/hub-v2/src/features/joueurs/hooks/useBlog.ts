/**
 * QUOI     — les articles du blog (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  creerArticle, enregistrerArticle, lireArticles, MarquageEchoue, publierSurLaBoutique, type Article, type Brouillon, type TypeArticle,
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
// Si Shopify a l'article mais que la base ne l'a pas noté, l'essai suivant met cet article à jour : jamais un doublon.
export function usePublierArticle() {
  const client = useQueryClient()
  const dejaCree = useRef<string | null>(null)
  return useMutation({
    mutationFn: async ({ fiche, brouillon }: { fiche: Article; brouillon: Brouillon }) => {
      const enregistre = await enregistrerArticle(fiche, brouillon)
      try {
        await publierSurLaBoutique({ ...enregistre, shopify_article_id: enregistre.shopify_article_id ?? dejaCree.current })
        dejaCree.current = null
      } catch (e) {
        if (e instanceof MarquageEchoue) dejaCree.current = e.articleId
        throw e
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}
