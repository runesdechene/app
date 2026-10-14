/**
 * QUOI     — Shopify par le proxy Netlify : l'inventaire des Illustrations (métaobjets), la recherche d'un
 *            produit, et l'image d'une photo dans la galerie d'un produit (poser, retirer).
 * POURQUOI — le jeton Shopify reste côté serveur ; la boutique y est fixée, le client ne la nomme pas.
 *            Le type de métaobjet est `illustrations`, au PLURIEL (confirmé par sondage le 16/08) : le
 *            singulier rend une liste vide sans erreur. Une portée manquante (ACCESS_DENIED) et un
 *            inventaire vide sont des pannes lisibles, jamais « 0 ».
 */
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'

export const SHOP = 'runes-de-chene.myshopify.com'
const PORTEE_PAR_DEFAUT = 'read_metaobjects'
const TYPE_ILLUSTRATION = 'illustrations'
const CHAMP_AUDIO = 'fragment_audio'

/** Shopify refuse la lecture faute d'une portée de l'application ; `portee` la nomme. */
export class AccesShopifyRefuse extends Error {
  readonly portee: string

  constructor(messageShopify: string) {
    super(messageShopify)
    this.name = 'AccesShopifyRefuse'
    this.portee = /`([a-z_]+)`\s+access scope/i.exec(messageShopify)?.[1] ?? PORTEE_PAR_DEFAUT
  }
}

/** Shopify répond sans erreur mais sans rien : le type de métaobjet a sans doute changé. */
export class InventaireVide extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InventaireVide'
  }
}

type ErreurGraphql = { message: string; extensions?: { code?: string } }
type ReponseGraphql<T> = { data?: T; errors?: ErreurGraphql[] }

export async function graphqlShopify<T>(requete: string): Promise<T> {
  const reponse = await appelerFonction('shopify-proxy', {
    methode: 'POST',
    parametres: { endpoint: 'graphql.json' },
    corps: { query: requete },
  })
  const { data, errors } = await lireReponse<ReponseGraphql<T>>(reponse)
  if (errors?.length) {
    const refus = errors.find((e) => e.extensions?.code === 'ACCESS_DENIED')
    if (refus) throw new AccesShopifyRefuse(refus.message)
    throw new Error(errors[0]?.message ?? 'Shopify a refusé la requête')
  }
  if (!data) throw new Error('Shopify : réponse vide')
  return data
}

/** Un métaobjet Illustration tel que `synchroniser_fragments` l'attend ; '' quand un champ est vide. */
export type Illustration = {
  handle: string; nom: string; collection: string; resume: string; histoire: string
  illustration_url: string; illustration_sombre_url: string; fond_url: string; audio_url: string
  artiste: string; narrateur: string; heritage: string
}

type Champ = {
  key: string
  value: string | null
  reference: {
    image?: { url: string }; url?: string; sources?: { url: string }[]
    handle?: string; title?: string; displayName?: string; nom?: { value: string | null } | null
  } | null
}

// L'adresse d'un fichier, le nom d'un artiste, le titre d'une collection : ce que montre un champ.
function lire(champs: Champ[], cle: string): string {
  const champ = champs.find((c) => c.key === cle)
  if (!champ) return ''
  const ref = champ.reference
  if (!ref) return champ.value ?? ''
  return ref.image?.url ?? ref.url ?? ref.sources?.[0]?.url ?? ref.nom?.value ?? ref.title ?? ref.displayName ?? ''
}

const REQUETE_ILLUSTRATIONS = `{
  metaobjects(type: "${TYPE_ILLUSTRATION}", first: 100) {
    pageInfo { hasNextPage }
    nodes {
      handle
      displayName
      fields {
        key
        value
        reference {
          __typename
          ... on MediaImage { image { url } }
          ... on GenericFile { url }
          ... on Video { sources { url } }
          ... on Collection { handle title }
          ... on Metaobject { displayName nom: field(key: "nom") { value } }
        }
      }
    }
  }
}`

type Metaobjets = {
  metaobjects: {
    pageInfo: { hasNextPage: boolean }
    nodes: { handle: string; displayName: string; fields: Champ[] }[]
  }
}

export async function lireIllustrations(): Promise<Illustration[]> {
  const { metaobjects } = await graphqlShopify<Metaobjets>(REQUETE_ILLUSTRATIONS)
  if (metaobjects.pageInfo.hasNextPage) {
    throw new Error('Plus de 100 Illustrations dans Shopify : la synchro ne lit que les 100 premières')
  }
  if (metaobjects.nodes.length === 0) {
    throw new InventaireVide(`Aucune Illustration retournée par Shopify (type « ${TYPE_ILLUSTRATION} ») : le type a-t-il changé ?`)
  }
  return metaobjects.nodes.map(({ handle, displayName, fields }) => ({
    handle,
    nom: lire(fields, 'nom') || displayName,
    collection: fields.find((c) => c.key === 'collection')?.reference?.handle ?? '',
    resume: lire(fields, 'resume'),
    histoire: lire(fields, 'son_histoire'),
    illustration_url: lire(fields, 'image_pour_fond_clair'),
    illustration_sombre_url: lire(fields, 'image_pour_fond_sombre'),
    fond_url: lire(fields, 'image_fond_de_fragment'),
    audio_url: lire(fields, CHAMP_AUDIO),
    artiste: lire(fields, 'artiste'),
    narrateur: lire(fields, 'narrateur_audio'),
    heritage: lire(fields, 'collection_d_heritage'),
  }))
}

export type ProduitShopify = { id: string; titre: string; handle: string; image: string | null; prix: string | null }

type NoeudProduit = {
  legacyResourceId: string; title: string; handle: string
  featuredImage: { url: string } | null
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } } | null
}
type Produits = { products: { edges: { node: NoeudProduit }[] } }

function prix(p: NoeudProduit['priceRangeV2']): string | null {
  if (!p) return null
  const montant = Number(p.minVariantPrice.amount)
  if (!Number.isFinite(montant)) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.minVariantPrice.currencyCode || 'EUR', maximumFractionDigits: 0 }).format(montant)
}

/** Les produits dont le titre contient `terme` (8 au plus) ; en dessous de 2 caractères, rien à chercher. */
export async function chercherProduits(terme: string): Promise<ProduitShopify[]> {
  const propre = terme.trim()
  if (propre.length < 2) return []
  const titre = propre.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  const { products } = await graphqlShopify<Produits>(
    `{ products(first: 8, query: "title:*${titre}*") { edges { node { legacyResourceId title handle featuredImage { url } priceRangeV2 { minVariantPrice { amount currencyCode } } } } } }`,
  )
  return products.edges.map(({ node }) => ({
    id: node.legacyResourceId, titre: node.title, handle: node.handle,
    image: node.featuredImage?.url ?? null, prix: prix(node.priceRangeV2),
  }))
}

/** Pose l'image (adresse publique) dans la galerie du produit ; rend l'identifiant que Shopify lui donne. */
export async function pousserImage(produitId: string, url: string, alt: string): Promise<string> {
  const reponse = await appelerFonction('shopify-proxy', {
    methode: 'POST',
    parametres: { endpoint: `products/${produitId}/images.json` },
    corps: { image: { src: url, alt } },
  })
  const { image } = await lireReponse<{ image?: { id?: number } }>(reponse)
  if (!image?.id) throw new Error('Shopify n’a pas rendu l’identifiant de l’image')
  return String(image.id)
}

/**
 * Retire l'image de la galerie. Seul le 404 JSON de Shopify (« Not Found », relayé par le proxy) dit qu'elle
 * n'y est déjà plus : un 404 de Netlify (fonction absente) n'a rien dit à Shopify et reste une erreur.
 * Un 200 au corps vide est la réponse normale de Shopify à un retrait.
 */
export async function retirerImage(produitId: string, mediaId: string): Promise<void> {
  const reponse = await appelerFonction('shopify-proxy', {
    methode: 'DELETE',
    parametres: { endpoint: `products/${produitId}/images/${mediaId}.json` },
  })
  if (reponse.ok && (await reponse.clone().text()).trim() === '') return
  try {
    await lireReponse<unknown>(reponse)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (reponse.status === 404 && message === 'Not Found') return
    throw new Error(`Fiche produit Shopify : ${message}`, { cause: e })
  }
}
