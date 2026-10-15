/**
 * QUOI     — les articles du blog (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  creerArticle, enregistrerArticle, lireArticles, MarquageEchoue, publierSurLaBoutique, type Article, type Brouillon, type TypeArticle,
} from '../api/blog'

const CLE = ['hub-blog']

// Articles créés chez Shopify mais pas notés par la base, par annonce. Hors du composant : fermer le tiroir
// ou changer d'article ne doit pas faire oublier l'identifiant (l'essai suivant créerait un doublon).
const dejaCrees = new Map<string, string>()
export const oublierLesArticlesCrees = () => { dejaCrees.clear() }

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
// Si Shopify a l'article mais que la base ne l'a pas noté (dejaCrees), l'essai suivant met cet article à jour : jamais un doublon.
export function usePublierArticle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ fiche, brouillon }: { fiche: Article; brouillon: Brouillon }) => {
      const enregistre = await enregistrerArticle(fiche, brouillon)
      try {
        await publierSurLaBoutique({ ...enregistre, shopify_article_id: enregistre.shopify_article_id ?? dejaCrees.get(fiche.id) ?? null })
        dejaCrees.delete(fiche.id)
      } catch (e) {
        if (e instanceof MarquageEchoue) dejaCrees.set(fiche.id, e.articleId)
        throw e
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}
