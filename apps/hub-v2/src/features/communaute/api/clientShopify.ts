/**
 * QUOI     — ce que la boutique sait d'un client, par son e-mail : ses commandes, ce qu'il a dépensé,
 *            depuis quand il est client, et sa dernière commande en ligne (pas celles du stand).
 * POURQUOI — lu par le proxy Netlify (le jeton Shopify reste côté serveur). Une commande « en ligne »
 *            n'est pas passée à la caisse du stand (source_name ≠ « pos »). Shopify ne rend les
 *            commandes de plus de 60 jours qu'avec la portée read_all_orders : sans elle, les commandes
 *            manquent et la fiche le dit au lieu d'afficher un faux « aucune ».
 */
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'

export type CommandeEnLigne = { numero: string; date: string; produits: string[] }
export type ClientShopify = {
  commandes: number
  depense: number
  devise: string
  depuis: string
  auStand: number | null
  derniereEnLigne: CommandeEnLigne | null
  commandesLues: boolean
}

type Client = { id: number; orders_count: number; total_spent: string; currency: string; created_at: string }
type Commande = { name: string; created_at: string; source_name: string | null; line_items: { title: string }[] }

async function lire<T>(endpoint: string): Promise<T> {
  return lireReponse<T>(await appelerFonction('shopify-proxy', { parametres: { endpoint } }))
}

/** null : la boutique ne connaît pas cet e-mail. */
export async function lireClientShopify(email: string): Promise<ClientShopify | null> {
  const recherche = `customers/search.json?query=${encodeURIComponent(`email:${email}`)}&fields=id,orders_count,total_spent,currency,created_at`
  const { customers } = await lire<{ customers: Client[] }>(recherche)
  const client = customers[0]
  if (!client) return null

  // Sans la portée des commandes, la fiche garde les chiffres du client et dit ce qui manque.
  const commandes = await lire<{ orders: Commande[] }>(
    `orders.json?customer_id=${String(client.id)}&status=any&limit=250&fields=name,created_at,source_name,line_items`,
  ).then((r) => r.orders, () => null)
  const enLigne = commandes?.filter((c) => c.source_name !== 'pos') ?? []
  const derniere = enLigne[0]
  return {
    commandes: client.orders_count,
    depense: Number(client.total_spent),
    devise: client.currency,
    depuis: client.created_at,
    auStand: commandes ? commandes.length - enLigne.length : null,
    derniereEnLigne: derniere ? { numero: derniere.name, date: derniere.created_at, produits: derniere.line_items.map((l) => l.title) } : null,
    commandesLues: commandes !== null && commandes.length === client.orders_count,
  }
}
