// Les chiffres de Runes de Chêne pour le tableau de bord d'Obsidian (plugin Accueil, connecteur « Requête JSON »),
// sur une fenêtre de dates. Boutique : CA, commandes et pièces payées, par le jeton Shopify du Hub (pas de
// deuxième app Shopify). Appli : comptes créés au stand, ceux déjà activés (première connexion faite :
// la fiche « shopify-… » a pris l'identifiant de connexion), scans du QR Fragment. Lecture seule.

import crypto from 'crypto'

const BOUTIQUE = 'runes-de-chene.myshopify.com'
const DATE = /^\d{4}-\d{2}-\d{2}$/
const COMMANDES = `query($q: String!, $apres: String) {
  orders(first: 250, after: $apres, query: $q) {
    nodes { currentTotalPriceSet { shopMoney { amount } } currentSubtotalLineItemsQuantity }
    pageInfo { hasNextPage endCursor }
  }
}`

function repondre(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

/** Le jeton de l'appelant comparé à METRIQUES_JETON, en temps constant. Sans clé configurée : tout est refusé. */
function autorise(request: Request): boolean {
  const cle = process.env.METRIQUES_JETON
  if (!cle) return false
  const recu = Buffer.from((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''))
  const attendu = Buffer.from(cle)
  return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu)
}

export default async function handler(request: Request) {
  if (request.method !== 'GET') return repondre({ error: 'GET seulement' }, 405)
  if (!autorise(request)) return repondre({ error: 'Non autorisé' }, 401)
  const jeton = process.env.SHOPIFY_ACCESS_TOKEN
  if (!jeton) return repondre({ error: 'SHOPIFY_ACCESS_TOKEN manquant' }, 500)

  const url = new URL(request.url)
  const debut = url.searchParams.get('debut') ?? ''
  const fin = url.searchParams.get('fin') ?? ''
  if (!DATE.test(debut) || !DATE.test(fin)) return repondre({ error: 'debut et fin attendus en AAAA-MM-JJ' }, 400)

  // Les commandes payées (remboursements déduits par currentTotalPriceSet), créées dans la fenêtre.
  const q = `created_at:>=${debut} created_at:<=${fin}T23:59:59 (financial_status:paid OR financial_status:partially_refunded)`
  let ca = 0
  let commandes = 0
  let pieces = 0
  let apres: string | null = null
  do {
    const r = await fetch(`https://${BOUTIQUE}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: COMMANDES, variables: { q, apres } }),
    })
    if (!r.ok) return repondre({ error: `Shopify a répondu ${r.status}` }, 502)
    const json = (await r.json()) as {
      data?: { orders?: { nodes: { currentTotalPriceSet: { shopMoney: { amount: string } }; currentSubtotalLineItemsQuantity: number }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }
    }
    const orders = json.data?.orders
    if (!orders) return repondre({ error: 'Réponse Shopify illisible' }, 502)
    for (const o of orders.nodes) ca += Number(o.currentTotalPriceSet.shopMoney.amount)
    commandes += orders.nodes.length
    for (const o of orders.nodes) pieces += o.currentSubtotalLineItemsQuantity ?? 0
    apres = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null
  } while (apres)

  const de = `${debut}T00:00:00`
  const a = `${fin}T23:59:59`
  const stand = `users?account_source=eq.stand&created_at=gte.${de}&created_at=lte.${a}`
  const [inscriptions_stand, activations_stand, scans] = await Promise.all([
    compter(stand),
    compter(`${stand}&id=not.like.shopify-*`),
    compter(`scans?quand=gte.${de}&quand=lte.${a}`),
  ])
  if ([inscriptions_stand, activations_stand, scans].includes(null)) return repondre({ error: 'Lecture de la base impossible' }, 502)

  return repondre({ debut, fin, ca: Math.round(ca * 100) / 100, commandes, pieces, inscriptions_stand, activations_stand, scans })
}

/** Le nombre de lignes d'une requête PostgREST (en-tête Content-Range), sans les lire. null : échec. */
async function compter(requete: string): Promise<number | null> {
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${requete}&select=id`, {
    method: 'HEAD',
    headers: { 'apikey': cle, 'Authorization': `Bearer ${cle}`, 'Prefer': 'count=exact', 'Range': '0-0' },
  })
  const total = r.headers.get('Content-Range')?.split('/')[1]
  return r.ok && total && total !== '*' ? Number(total) : null
}

export const config = {
  path: '/.netlify/functions/metriques',
}
