// apps/hub/src/lib/shopifyIllustrations.ts
// Inventaire des metaobjets Illustration et des produits qui y sont relies, via le
// proxy admin-authed. Sert le bandeau de couverture de l'ecran Fragments audio :
// un metachamp oublie au drop rend le lecteur muet sans aucun signal.
//
// Historique de decouverte (important pour ne pas regresser) :
// - 2026-08-14, introspection directe (meme token admin que la prod) : la portee
//   `read_metaobjects` manquait a l'app Shopify custom. metaobjectDefinitions et la
//   lecture de metaobjets par GID renvoyaient tous deux ACCESS_DENIED.
// - 2026-08-16, apres que l'humain a accorde `read_metaobjects` : re-sonde a chaud.
//   `metaobjectDefinitions(first: 25)` refuse TOUJOURS — portee DIFFERENTE et
//   DISTINCTE (`read_metaobject_definitions`), non accordee et qui ne le sera pas.
//   En revanche `node(id: "gid://shopify/Metaobject/396064981259")` et
//   `metaobjects(type: "illustrations", first: 100)` repondent 200 avec les 22
//   metaobjets attendus. Le type reel est donc "illustrations" (au PLURIEL — le
//   singulier "illustration" renverrait une liste vide sans lever d'erreur, un piege
//   silencieux). Ce module n'appelle donc plus jamais metaobjectDefinitions : le type
//   est fixe ci-dessous, confirme par sondage direct, pas devine.
// - ShopifyAccessDeniedError reste le garde-fou pour `metaobjects` (et `products`) :
//   si `read_metaobjects` etait un jour retiree, ces requetes echoueraient de la meme
//   maniere et le bandeau redeviendrait exact sans changement de code. Ce n'est
//   simplement plus le chemin normal aujourd'hui.
import { supabase } from './supabase'

const SHOP = 'runes-de-chene.myshopify.com'
const AUDIO_FIELD_KEY = 'fragment_audio' // confirme : cle par defaut de sections/rdc_motif.liquid

// Type confirme par sondage direct de l'API Admin le 2026-08-16 (22 metaobjets
// retournes) — pas une supposition. Au PLURIEL : `illustration` au singulier
// renverrait une liste vide sans lever d'erreur.
const ILLUSTRATION_TYPE = 'illustrations'

/** Portee Shopify constatee comme manquante lors de l'introspection du 2026-08-14. */
const SCOPE_METAOBJECTS_PAR_DEFAUT = 'read_metaobjects'

export interface IllustrationInfo {
  handle: string
  nom: string
  aAudio: boolean
}

export interface IllustrationsResult {
  illustrations: IllustrationInfo[]
  /** true si metaobjects(first: 100) a une page suivante : la liste ci-dessus est incomplete. */
  tronque: boolean
}

export interface ProduitSansIllustration {
  handle: string
  titre: string
}

export interface ProduitsSansIllustrationResult {
  produits: ProduitSansIllustration[]
  /** true si products(first: 250) a une page suivante : le comptage ci-dessus est incomplet. */
  tronque: boolean
}

interface ShopifyGraphQLError {
  message: string
  extensions?: { code?: string }
}

/**
 * Levee quand l'Admin API refuse une lecture liee aux metaobjets faute de portee.
 * `scope` porte le nom de la portee manquante (extrait du message Shopify quand
 * possible, sinon la portee constatee lors de l'introspection du 2026-08-14).
 */
export class ShopifyAccessDeniedError extends Error {
  readonly scope: string

  constructor(shopifyMessage: string) {
    super(shopifyMessage)
    this.name = 'ShopifyAccessDeniedError'
    const trouve = shopifyMessage.match(/`([a-z_]+)`\s+access scope/i)
    this.scope = trouve ? trouve[1] : SCOPE_METAOBJECTS_PAR_DEFAUT
  }
}

/**
 * Levee quand `metaobjects(type: ILLUSTRATION_TYPE)` repond sans erreur mais avec
 * zero element. Un vrai catalogue vide serait suspect en soi, et la cause la plus
 * probable est que ILLUSTRATION_TYPE ne correspond plus au type reel cote admin —
 * dans les deux cas, ca merite un message explicite plutot qu'un silencieux
 * « 0 Illustration sans voix off » qui se lirait comme une bonne nouvelle.
 */
export class ShopifyEmptyResultError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShopifyEmptyResultError'
  }
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

async function graphql<T>(query: string): Promise<T> {
  const resp = await fetch(proxyUrl('graphql.json'), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  // Corps lu en texte d'abord. Un proxy absent ou en panne renvoie du vide ou du
  // HTML, et un resp.json() direct laisse fuir « Failed to execute 'json' on
  // 'Response' » jusqu'au bandeau. Constate a l'ecran le 2026-08-16 en local, ou
  // les fonctions Netlify ne sont pas servies : 404 a corps vide, message illisible.
  // Ce bandeau existe pour rendre les trous lisibles — il doit l'etre lui-meme.
  const brut = await resp.text()
  type ReponseGraphQL = {
    data?: T
    errors?: ShopifyGraphQLError[]
    error?: string // erreur emise par le proxy lui-meme (auth/role), pas par Shopify
  }
  let json: ReponseGraphQL
  try {
    json = JSON.parse(brut) as ReponseGraphQL
  } catch {
    throw new Error(
      resp.ok
        ? 'Shopify Admin : reponse illisible du proxy (ce n\'est pas du JSON)'
        : `Shopify Admin : HTTP ${resp.status} — le proxy n'a pas repondu`,
    )
  }
  if (json.error) throw new Error(`Proxy Shopify : ${json.error}`)
  if (json.errors?.length) {
    const refuse = json.errors.find((e) => e.extensions?.code === 'ACCESS_DENIED')
    if (refuse) throw new ShopifyAccessDeniedError(refuse.message)
    throw new Error(json.errors[0].message)
  }
  if (!resp.ok) throw new Error(`Shopify Admin: HTTP ${resp.status}`)
  if (!json.data) throw new Error('Shopify Admin: reponse vide')
  return json.data
}

/** Toutes les Illustrations, avec la presence ou non d'un fichier de voix off. */
export async function fetchIllustrations(): Promise<IllustrationsResult> {
  const query = `{
    metaobjects(type: "${ILLUSTRATION_TYPE}", first: 100) {
      edges { node { handle displayName fields { key value } } }
      pageInfo { hasNextPage }
    }
  }`
  const data = await graphql<{
    metaobjects: {
      edges: Array<{ node: {
        handle: string
        displayName: string
        fields: Array<{ key: string; value: string | null }>
      } }>
      pageInfo: { hasNextPage: boolean }
    }
  }>(query)

  if (data.metaobjects.edges.length === 0) {
    throw new ShopifyEmptyResultError(
      `Aucune Illustration retournée par Shopify (type "${ILLUSTRATION_TYPE}") — le type a-t-il changé ?`,
    )
  }

  return {
    illustrations: data.metaobjects.edges.map(({ node }) => ({
      handle: node.handle,
      nom: node.displayName,
      aAudio: node.fields.some((f) => f.key === AUDIO_FIELD_KEY && !!f.value),
    })),
    tronque: data.metaobjects.pageInfo.hasNextPage,
  }
}

/** Produits actifs dont le metachamp custom.illustration_produit n'est pas renseigne. */
export async function fetchProduitsSansIllustration(): Promise<ProduitsSansIllustrationResult> {
  const query = `{
    products(first: 250) {
      edges { node {
        handle
        title
        status
        metafield(namespace: "custom", key: "illustration_produit") { value }
      } }
      pageInfo { hasNextPage }
    }
  }`
  const data = await graphql<{
    products: {
      edges: Array<{ node: {
        handle: string
        title: string
        status: string
        metafield: { value: string | null } | null
      } }>
      pageInfo: { hasNextPage: boolean }
    }
  }>(query)

  return {
    produits: data.products.edges
      .filter(({ node }) => node.status === 'ACTIVE' && !node.metafield?.value)
      .map(({ node }) => ({ handle: node.handle, titre: node.title })),
    tronque: data.products.pageInfo.hasNextPage,
  }
}
