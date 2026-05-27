// apps/hub/src/lib/shopifyProducts.ts
// Recherche produits (GraphQL Admin) + push/suppression d'image (REST Admin), via le proxy admin-authed.
import { supabase } from './supabase'

const SHOP = 'runes-de-chene.myshopify.com'

export interface ShopifyProductHit {
  productId: string   // legacyResourceId numerique (ex: "7845123")
  title: string
  handle: string
  imageUrl: string | null
  price: string | null  // prix formaté, ex. "49 €"
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const jwt = session?.access_token
  if (!jwt) throw new Error('Session expiree, reconnecte-toi')
  return { Authorization: `Bearer ${jwt}` }
}

function proxyUrl(endpoint: string): string {
  return `/.netlify/functions/shopify-proxy?endpoint=${encodeURIComponent(endpoint)}&shop=${SHOP}`
}

/** Recherche les produits dont le titre contient `term` (GraphQL: bon pour la recherche partielle). */
export async function searchShopifyProducts(term: string): Promise<ShopifyProductHit[]> {
  const clean = term.trim()
  if (clean.length < 2) return []
  const escaped = clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const query = `{ products(first: 8, query: "title:*${escaped}*") { edges { node { legacyResourceId title handle featuredImage { url } priceRangeV2 { minVariantPrice { amount currencyCode } } } } } }`

  const resp = await fetch(proxyUrl('graphql.json'), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!resp.ok) throw new Error(`Recherche produit: HTTP ${resp.status}`)
  const json = await resp.json() as {
    data?: { products?: { edges?: Array<{ node: {
      legacyResourceId: string; title: string; handle: string;
      featuredImage: { url: string } | null;
      priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } } | null;
    } }> } }
  }
  const edges = json.data?.products?.edges ?? []
  return edges.map(e => {
    const mp = e.node.priceRangeV2?.minVariantPrice
    let price: string | null = null
    if (mp) {
      const amount = Number(mp.amount)
      price = Number.isFinite(amount)
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: mp.currencyCode || 'EUR', maximumFractionDigits: 0 }).format(amount)
        : null
    }
    return {
      productId: e.node.legacyResourceId,
      title: e.node.title,
      handle: e.node.handle,
      imageUrl: e.node.featuredImage?.url ?? null,
      price,
    }
  })
}

/** Pousse une image (URL publique) dans la galerie native d'un produit. Retourne l'ID image Shopify. */
export async function pushImageToProduct(productId: string, imageUrl: string, alt: string): Promise<string> {
  const resp = await fetch(proxyUrl(`products/${productId}/images.json`), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { src: imageUrl, alt } }),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Push image: HTTP ${resp.status} — ${txt.slice(0, 200)}`)
  }
  const json = await resp.json() as { image?: { id?: number } }
  const id = json.image?.id
  if (!id) throw new Error('Push image: reponse Shopify sans image.id')
  return String(id)
}

/** Supprime une image precedemment poussee. Idempotent: un 404 (deja supprimee) est tolere. */
export async function deleteProductImage(productId: string, mediaId: string): Promise<void> {
  const resp = await fetch(proxyUrl(`products/${productId}/images/${mediaId}.json`), {
    method: 'DELETE',
    headers: { ...(await authHeader()) },
  })
  if (!resp.ok && resp.status !== 404) {
    const txt = await resp.text()
    throw new Error(`Suppression image: HTTP ${resp.status} — ${txt.slice(0, 200)}`)
  }
}
