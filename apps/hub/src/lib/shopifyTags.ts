// Helper pour calculer et synchroniser les tags Shopify

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Détermine le tag source unique (canal d'acquisition) */
export function computeSourceTag(accountSource: string | null): string {
  if (accountSource === 'shopify') return 'source:shopify'
  return 'source:app'
}

/** Synchronise les tags d'un user vers son compte Shopify */
export async function syncUserTagsToShopify(user: {
  email_address: string
  shopify_customer_id?: number | null
  account_source?: string | null
  faction_title?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const tags: string[] = []
  const removePrefixes: string[] = ['source:']

  // Tag source (immuable — canal d'acquisition)
  tags.push(computeSourceTag(user.account_source ?? null))

  // Tag héritage (si faction connue)
  if (user.faction_title) {
    removePrefixes.push('heritage-')
    tags.push(`heritage-${slugify(user.faction_title)}`)
  }

  // Tag app-player (si le user a un compte app)
  if (user.account_source !== 'shopify') {
    tags.push('app-player')
  }

  const resp = await fetch('/.netlify/functions/shopify-sync-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email_address,
      shopifyCustomerId: user.shopify_customer_id ?? undefined,
      tags,
      removePrefixes,
    }),
  })

  const data = await resp.json()
  return data.success ? { success: true } : { success: false, error: data.error || data.reason }
}
