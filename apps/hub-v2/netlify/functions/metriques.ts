// Les chiffres de Runes de Chêne pour le tableau de bord d'Obsidian (plugin Accueil, connecteur « Requête JSON »),
// sur une fenêtre de dates. Boutique : CA, commandes et pièces payées, par le jeton Shopify du Hub (pas de
// deuxième app Shopify). Appli : comptes créés au stand, ceux déjà activés (première connexion faite :
// la fiche « shopify-… » a pris l'identifiant de connexion), nouvelles fiches par origine, scans du QR Fragment.
// Lecture seule.

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
  // Shopify lit ces dates sans heure dans le fuseau de la boutique.
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

  // Les jours de Paris, comme l'exposeur de Fellowship (contrat de « Briques — la méthode ») : de minuit le
  // premier jour à minuit le lendemain du dernier, exclu. Avant : des heures sans fuseau, lues en UTC par la base.
  const de = minuitParis(debut)
  const a = minuitParis(lendemain(fin))
  const nes = `users?created_at=gte.${de}&created_at=lt.${a}`
  const stand = `${nes}&account_source=eq.stand`
  // Les nouvelles fiches par origine : stand, flyer, appli, boutique (achat ou newsletter du site, aspirés par le Hub).
  // Les membres : les nouvelles fiches déjà reliées à un accès (plus de « shopify-… »), toutes origines.
  const [inscriptions_stand, activations_stand, scans, comptes_flyer, comptes_app, comptes_boutique, membres] = await Promise.all([
    compter(stand),
    compter(`${stand}&id=not.like.shopify-*`),
    compter(`scans?quand=gte.${de}&quand=lt.${a}`),
    compter(`${nes}&account_source=eq.flyer`),
    compter(`${nes}&account_source=eq.app`),
    compter(`${nes}&account_source=eq.shopify`),
    compter(`${nes}&id=not.like.shopify-*`),
  ])
  const lus = [inscriptions_stand, activations_stand, scans, comptes_flyer, comptes_app, comptes_boutique, membres]
  if (lus.includes(null)) return repondre({ error: 'Lecture de la base impossible' }, 502)

  return repondre({
    debut, fin, ca: Math.round(ca * 100) / 100, commandes, pieces, inscriptions_stand, activations_stand, scans,
    comptes_stand: inscriptions_stand, comptes_flyer, comptes_app, comptes_boutique, membres,
  })
}

/** Minuit à Paris ce jour-là (AAAA-MM-JJ), en instant UTC ISO : 2026-11-01 → 2026-10-31T23:00:00.000Z. */
export function minuitParis(jour: string): string {
  const utc = new Date(`${jour}T00:00:00Z`)
  const lu = (tz: string) => new Date(utc.toLocaleString('en-US', { timeZone: tz })).getTime()
  return new Date(utc.getTime() - (lu('Europe/Paris') - lu('UTC'))).toISOString()
}

/** Le jour suivant (AAAA-MM-JJ). */
function lendemain(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
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
