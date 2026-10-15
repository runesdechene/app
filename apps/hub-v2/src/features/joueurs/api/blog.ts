/**
 * QUOI     — lit les articles du blog (annonces), en crée, les enregistre, les publie sur la boutique Shopify.
 * POURQUOI — les RPC sont gardées par _is_admin(). Le texte est en Markdown dans la base et part en HTML
 *            sûr vers la fonction Netlify shopify-article, qui crée ou met à jour l'article. L'article n'est marqué
 *            « publié » qu'une fois la fonction réussie ; l'erreur de ce marquage est dite (l'ancien Hub l'ignorait).
 *            Le fichier de couverture ne part qu'à l'enregistrement, l'ancien quitte le bucket une fois la base à jour.
 */
import { envoyerFichier, retirerFichier } from '@/shared/lib/envoi'
import { messageDErreur } from '@/shared/lib/erreur'
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'
import { supabase } from '@/shared/supabase/client'
import type { Tables } from '@/shared/supabase/database.types'
import { versHtml } from '../lib/markdown'
import { BUCKET, cheminDeImage } from '../lib/miseAJour'

export type Article = Tables<'announcements'>
export type TypeArticle = 'produit' | 'app' | 'marque'
export type Brouillon = {
  titre: string; type: string; texte: string; ctaUrl: string; ctaLibelle: string; fichier: File | null; retirer: boolean
}

/** Shopify a l'article mais la base ne l'a pas noté : l'identifiant sert à l'essai suivant, qui met à jour au lieu de recréer. */
export class MarquageEchoue extends Error {
  constructor(message: string, readonly articleId: string, cause: unknown) {
    super(message, { cause })
  }
}

export async function lireArticles(): Promise<Article[]> {
  const { data, error } = await supabase.rpc('list_announcements_admin')
  if (error) throw new Error(error.message)
  return data
}

export async function creerArticle(type: TypeArticle, titre: string): Promise<Article> {
  const { data, error } = await supabase.rpc('create_announcement', { p_type: type, p_title: titre.trim() })
  if (error) throw new Error(error.message)
  return data
}

// Les types générés n'admettent pas null : une couverture vide part en '' (la fonction Shopify la lit comme absente).
// push_text et insta_caption repartent tels quels.
async function ecrire(fiche: Article, b: Brouillon, couverture: string | null): Promise<Article> {
  const { data, error } = await supabase.rpc('update_announcement', {
    p_id: fiche.id, p_title: b.titre.trim(), p_body: b.texte, p_cover_image: couverture ?? '',
    p_push_text: fiche.push_text ?? '', p_insta_caption: fiche.insta_caption ?? '', p_type: b.type,
    p_cta_url: b.ctaUrl.trim(), p_cta_label: b.ctaLibelle.trim(),
  })
  if (error) throw new Error(error.message)
  return data
}

/** Ordre : envoi de la nouvelle couverture, RPC, retrait de l'ancienne. La RPC qui échoue défait l'envoi. */
export async function enregistrerArticle(fiche: Article, b: Brouillon): Promise<Article> {
  const envoyee = b.fichier ? await envoyerFichier(BUCKET, cheminDeImage(b.fichier, 'article'), b.fichier) : null
  const couverture = envoyee ?? (b.retirer ? null : fiche.cover_image)
  let article: Article
  try {
    article = await ecrire(fiche, b, couverture)
  } catch (e) {
    if (envoyee) await retirerFichier(BUCKET, envoyee).catch(() => undefined)
    throw e
  }
  if (fiche.cover_image && fiche.cover_image !== couverture) {
    try {
      await retirerFichier(BUCKET, fiche.cover_image)
    } catch (e) {
      throw new Error(`Enregistré, mais l’ancienne couverture n’a pas pu être retirée : ${messageDErreur(e)}`, { cause: e })
    }
  }
  return article
}

/** Crée l'article Shopify (sans article lié) ou le met à jour, puis marque le canal « blog » publié. */
export async function publierSurLaBoutique(article: Article): Promise<void> {
  const appel = { url: article.cta_url ?? '', libelle: article.cta_label ?? '' }
  const reponse = await appelerFonction('shopify-article', {
    methode: 'POST',
    corps: {
      announcement: { title: article.title, body_html: versHtml(article.body, appel), cover_image: article.cover_image, type: article.type },
      shopify_article_id: article.shopify_article_id,
    },
  })
  const { article_id } = await lireReponse<{ article_id: string }>(reponse)
  const { error } = await supabase.rpc('set_announcement_channel', {
    p_id: article.id, p_channel: 'blog', p_state: 'published', p_shopify_article_id: article_id,
  })
  if (error) throw new MarquageEchoue(`Publié sur la boutique, mais la base ne l’a pas noté : ${error.message}`, article_id, error)
}
