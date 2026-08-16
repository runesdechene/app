// apps/hub/src/lib/shopifyIllustrations.ts
// Inventaire des metaobjets Illustration et des produits qui y sont relies, via le
// proxy admin-authed. Sert le bandeau de couverture de l'ecran Fragments audio :
// un metachamp oublie au drop rend le lecteur muet sans aucun signal.
//
// Le type de metaobjet "Illustration" n'est jamais code en dur : il est decouvert a
// chaque appel via metaobjectDefinitions (cf. plan tache 6, ruling 2). Verifie le
// 2026-08-14 par introspection directe (meme token admin que la prod) : la portee
// `read_metaobjects` manque a l'app Shopify custom. metaobjectDefinitions et la
// lecture de metaobjets par GID renvoient tous deux ACCESS_DENIED ; seule la lecture
// de produits (et de leurs metachamps) fonctionne. Voir ShopifyAccessDeniedError plus
// bas : tant que la portee n'est pas accordee, fetchIllustrations() echoue toujours
// avec cette erreur typee, et le bandeau doit degrader explicitement plutot que de
// se taire.
import { supabase } from './supabase'

const SHOP = 'runes-de-chene.myshopify.com'
const AUDIO_FIELD_KEY = 'fragment_audio' // confirme : cle par defaut de sections/rdc_motif.liquid

/** Portee Shopify constatee comme manquante lors de l'introspection du 2026-08-14. */
const SCOPE_METAOBJECTS_PAR_DEFAUT = 'read_metaobjects'

export interface IllustrationInfo {
  handle: string
  nom: string
  aAudio: boolean
}

export interface ProduitSansIllustration {
  handle: string
  titre: string
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
  const json = await resp.json() as {
    data?: T
    errors?: ShopifyGraphQLError[]
    error?: string // erreur emise par le proxy lui-meme (auth/role), pas par Shopify
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

interface MetaobjectDefinitionNode {
  type: string
  fieldDefinitions: Array<{ key: string }>
}

/**
 * Decouvre le type de metaobjet "Illustration" a l'execution, en cherchant la
 * definition dont un champ porte la cle AUDIO_FIELD_KEY. Ne devine jamais le type :
 * un type code en dur et faux renverrait une liste vide plutot qu'une erreur, ce qui
 * masquerait le probleme au lieu de le signaler (cf. plan tache 6, ruling 2).
 */
async function discoverIllustrationType(): Promise<string> {
  const query = `{
    metaobjectDefinitions(first: 25) {
      edges { node { type fieldDefinitions { key } } }
    }
  }`
  const data = await graphql<{
    metaobjectDefinitions: { edges: Array<{ node: MetaobjectDefinitionNode }> }
  }>(query)

  const trouvee = data.metaobjectDefinitions.edges.find(({ node }) =>
    node.fieldDefinitions.some((f) => f.key === AUDIO_FIELD_KEY),
  )
  if (!trouvee) {
    throw new Error(
      `Aucune definition de metaobjet ne porte le champ "${AUDIO_FIELD_KEY}" — impossible d'identifier le type Illustration.`,
    )
  }
  return trouvee.node.type
}

/** Toutes les Illustrations, avec la presence ou non d'un fichier de voix off. */
export async function fetchIllustrations(): Promise<IllustrationInfo[]> {
  const type = await discoverIllustrationType()

  const query = `{
    metaobjects(type: "${type}", first: 100) {
      edges { node { handle displayName fields { key value } } }
    }
  }`
  const data = await graphql<{
    metaobjects: { edges: Array<{ node: {
      handle: string
      displayName: string
      fields: Array<{ key: string; value: string | null }>
    } }> }
  }>(query)

  return data.metaobjects.edges.map(({ node }) => ({
    handle: node.handle,
    nom: node.displayName,
    aAudio: node.fields.some((f) => f.key === AUDIO_FIELD_KEY && !!f.value),
  }))
}

/** Produits actifs dont le metachamp custom.illustration_produit n'est pas renseigne. */
export async function fetchProduitsSansIllustration(): Promise<ProduitSansIllustration[]> {
  const query = `{
    products(first: 250) {
      edges { node {
        handle
        title
        status
        metafield(namespace: "custom", key: "illustration_produit") { value }
      } }
    }
  }`
  const data = await graphql<{
    products: { edges: Array<{ node: {
      handle: string
      title: string
      status: string
      metafield: { value: string | null } | null
    } }> }
  }>(query)

  return data.products.edges
    .filter(({ node }) => node.status === 'ACTIVE' && !node.metafield?.value)
    .map(({ node }) => ({ handle: node.handle, titre: node.title }))
}
