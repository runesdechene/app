// Les chiffres de la boutique pour le tableau de bord d'Obsidian (plugin Accueil, connecteur « Requête JSON ») :
// CA et nombre de commandes payées sur une fenêtre de dates. Passe par le jeton Shopify du Hub, pour
// ne pas créer une deuxième app Shopify. Lecture seule, rien n'est écrit.

import crypto from 'crypto'

const BOUTIQUE = 'runes-de-chene.myshopify.com'
const DATE = /^\d{4}-\d{2}-\d{2}$/
const COMMANDES = `query($q: String!, $apres: String) {
  orders(first: 250, after: $apres, query: $q) {
    nodes { currentTotalPriceSet { shopMoney { amount } } }
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
  let apres: string | null = null
  do {
    const r = await fetch(`https://${BOUTIQUE}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: COMMANDES, variables: { q, apres } }),
    })
    if (!r.ok) return repondre({ error: `Shopify a répondu ${r.status}` }, 502)
    const json = (await r.json()) as {
      data?: { orders?: { nodes: { currentTotalPriceSet: { shopMoney: { amount: string } } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }
    }
    const orders = json.data?.orders
    if (!orders) return repondre({ error: 'Réponse Shopify illisible' }, 502)
    for (const o of orders.nodes) ca += Number(o.currentTotalPriceSet.shopMoney.amount)
    commandes += orders.nodes.length
    apres = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null
  } while (apres)

  return repondre({ debut, fin, ca: Math.round(ca * 100) / 100, commandes })
}

export const config = {
  path: '/.netlify/functions/metriques',
}
