import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ShopifyCustomer {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  orders_count: number
  tags: string
  created_at: string
}

interface CrossResult {
  email: string
  shopifyName: string | null
  shopifyOrdersCount: number
  shopifyTags: string
  shopifyCreatedAt: string
  appName: string | null
  appFaction: string | null
  appGlory: number
  status: 'both' | 'shopify_only' | 'app_only'
}

type FilterMode = 'all' | 'both' | 'shopify_only' | 'app_only'

export function ShopifySync() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<CrossResult[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'shopify_access_token').single()
      .then(({ data }) => {
        if (data?.value) setToken(data.value)
        setLoading(false)
      })
  }, [])

  async function fetchAllShopifyCustomers(): Promise<ShopifyCustomer[]> {
    const all: ShopifyCustomer[] = []
    let nextUrl: string | null = 'customers.json?limit=250&fields=id,email,first_name,last_name,orders_count,tags,created_at'

    while (nextUrl) {
      const resp = await fetch(`/.netlify/functions/shopify-proxy?endpoint=${encodeURIComponent(nextUrl)}&token=${encodeURIComponent(token!)}&shop=runes-de-chene.myshopify.com`)

      if (!resp.ok) break

      const data = await resp.json()
      if (data.customers) {
        all.push(...data.customers)
      }

      // Pagination Shopify via Link header
      const linkHeader = resp.headers.get('link') || resp.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        if (match) {
          // Extraire juste le path après /admin/api/2026-01/
          const fullUrl = match[1]
          const pathMatch = fullUrl.match(/\/admin\/api\/[^/]+\/(.+)/)
          nextUrl = pathMatch ? pathMatch[1] : null
        } else {
          nextUrl = null
        }
      } else {
        nextUrl = null
      }
    }

    return all
  }

  async function runSync() {
    if (!token) return
    setSyncing(true)

    try {
      // 1. Fetch tous les clients Shopify
      const shopifyCustomers = await fetchAllShopifyCustomers()

      // 2. Fetch tous les users de l'app
      const { data: appUsers } = await supabase
        .from('users')
        .select('email_address, first_name, faction_id, notoriety_points')

      // 3. Fetch les noms de faction
      const { data: factions } = await supabase
        .from('factions')
        .select('id, title')
      const factionMap = new Map((factions ?? []).map(f => [f.id, f.title]))

      // 4. Créer les maps par email
      const shopifyMap = new Map<string, ShopifyCustomer>()
      for (const c of shopifyCustomers) {
        if (c.email) shopifyMap.set(c.email.toLowerCase(), c)
      }

      const appMap = new Map<string, { name: string | null; faction: string | null; glory: number }>()
      for (const u of (appUsers ?? []) as Array<{ email_address: string; first_name: string | null; faction_id: string | null; notoriety_points: number }>) {
        if (u.email_address) {
          appMap.set(u.email_address.toLowerCase(), {
            name: u.first_name,
            faction: u.faction_id ? (factionMap.get(u.faction_id) ?? null) : null,
            glory: u.notoriety_points || 0,
          })
        }
      }

      // 5. Croiser
      const allEmails = new Set([...shopifyMap.keys(), ...appMap.keys()])
      const crossed: CrossResult[] = []

      for (const email of allEmails) {
        const shopify = shopifyMap.get(email)
        const app = appMap.get(email)

        crossed.push({
          email,
          shopifyName: shopify ? [shopify.first_name, shopify.last_name].filter(Boolean).join(' ') || null : null,
          shopifyOrdersCount: shopify?.orders_count ?? 0,
          shopifyTags: shopify?.tags ?? '',
          shopifyCreatedAt: shopify?.created_at ?? '',
          appName: app?.name ?? null,
          appFaction: app?.faction ?? null,
          appGlory: app?.glory ?? 0,
          status: shopify && app ? 'both' : shopify ? 'shopify_only' : 'app_only',
        })
      }

      // Trier : both en premier, puis shopify_only, puis app_only
      crossed.sort((a, b) => {
        const order = { both: 0, shopify_only: 1, app_only: 2 }
        return order[a.status] - order[b.status]
      })

      setResults(crossed)
    } finally {
      setSyncing(false)
    }
  }

  const filtered = results.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return r.email.includes(s) || (r.shopifyName ?? '').toLowerCase().includes(s) || (r.appName ?? '').toLowerCase().includes(s)
    }
    return true
  })

  const counts = {
    all: results.length,
    both: results.filter(r => r.status === 'both').length,
    shopify_only: results.filter(r => r.status === 'shopify_only').length,
    app_only: results.filter(r => r.status === 'app_only').length,
  }

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ shopifyTotal: number; supabaseTotal: number; updated: number; created: number; skipped: number; toCreateCount: number; toUpdateCount: number; logs: string[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function runImport() {
    if (!token) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        setImportError('Session expirée, reconnecte-toi')
        setImporting(false)
        return
      }
      const resp = await fetch('/.netlify/functions/shopify-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, shop: 'runes-de-chene.myshopify.com' }),
      })

      const data = await resp.json()
      if (data.error) {
        setImportError(data.error)
      } else {
        setImportResult(data)
      }
    } catch (err) {
      setImportError(`${err}`)
    } finally {
      setImporting(false)
    }
  }

  // --- Batch rétroactif : synchroniser les tags source vers Shopify ---
  const [tagging, setTagging] = useState(false)
  const [tagProgress, setTagProgress] = useState({ done: 0, total: 0, errors: 0, skipped: 0 })
  const [tagErrors, setTagErrors] = useState<string[]>([])
  const [tagDone, setTagDone] = useState(false)

  async function runSourceTagging() {
    if (!token) return
    setTagging(true)
    setTagDone(false)
    setTagProgress({ done: 0, total: 0, errors: 0, skipped: 0 })
    setTagErrors([])

    try {
      // 1. Fetch tous les users Supabase avec un shopify_customer_id (paginé)
      const PAGE_SIZE = 1000
      let allAppUsers: Array<{ email_address: string; shopify_customer_id: number; account_source: string | null; created_at: string; faction_id: string | null }> = []
      let from = 0

      while (true) {
        const { data } = await supabase
          .from('users')
          .select('email_address, shopify_customer_id, account_source, created_at, faction_id')
          .not('shopify_customer_id', 'is', null)
          .range(from, from + PAGE_SIZE - 1)

        if (data && data.length > 0) {
          allAppUsers = allAppUsers.concat(data as typeof allAppUsers)
          if (data.length < PAGE_SIZE) break
          from += PAGE_SIZE
        } else {
          break
        }
      }

      if (allAppUsers.length === 0) {
        setTagProgress({ done: 0, total: 0, errors: 0, skipped: 0 })
        setTagDone(true)
        return
      }

      // 2. Fetch les noms de faction
      const { data: factionData } = await supabase.from('factions').select('id, title')
      const factionMap = new Map((factionData ?? []).map(f => [f.id, f.title]))

      // 3. Fetch tous les clients Shopify (pour comparer created_at des "both")
      const shopifyCustomers = await fetchAllShopifyCustomers()
      const shopifyMap = new Map<number, { created_at: string; tags: string }>()
      for (const c of shopifyCustomers) {
        shopifyMap.set(c.id, { created_at: c.created_at, tags: c.tags })
      }

      // 4. Calculer les tags finaux pour chaque user (ignorer ceux qui ont déjà source:)
      // On merge côté frontend car on a déjà les tags Shopify existants
      function mergeTags(existing: string, newTags: string[], removePrefixes: string[]): string {
        const tags = existing.split(',').map(t => t.trim()).filter(Boolean)
        const filtered = tags.filter(t => !removePrefixes.some(p => t.startsWith(p)))
        const tagSet = new Set(filtered)
        for (const t of newTags) tagSet.add(t)
        return Array.from(tagSet).join(', ')
      }

      type BatchItem = { customerId: number; email: string; tags: string }
      const items: BatchItem[] = []
      let skipped = 0

      for (const u of allAppUsers) {
        const shopifyCustomer = shopifyMap.get(u.shopify_customer_id)

        // Ignorer si le client Shopify a déjà un tag source:
        if (shopifyCustomer) {
          const existingTags = shopifyCustomer.tags.split(',').map(t => t.trim())
          if (existingTags.some(t => t.startsWith('source:'))) {
            skipped++
            continue
          }
        }

        // Pas de client Shopify trouvé → skip (on ne peut pas PUT sans ID)
        if (!shopifyCustomer) {
          skipped++
          continue
        }

        let sourceTag: string
        const accountSource = u.account_source || 'app'

        if (accountSource === 'both') {
          const appDate = new Date(u.created_at).getTime()
          const shopifyDate = new Date(shopifyCustomer.created_at).getTime()
          sourceTag = appDate <= shopifyDate ? 'source:app' : 'source:shopify'
        } else if (accountSource === 'shopify') {
          sourceTag = 'source:shopify'
        } else {
          sourceTag = 'source:app'
        }

        const newTags = [sourceTag]
        const removePrefixes = ['source:']

        if (u.faction_id) {
          const factionTitle = factionMap.get(u.faction_id)
          if (factionTitle) {
            const slug = factionTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            newTags.push(`heritage-${slug}`)
            removePrefixes.push('heritage-')
          }
        }

        if (accountSource !== 'shopify') {
          newTags.push('app-player')
        }

        // Merger avec les tags existants côté frontend (pas de GET nécessaire côté serveur)
        const finalTags = mergeTags(shopifyCustomer.tags, newTags, removePrefixes)

        items.push({
          customerId: u.shopify_customer_id,
          email: u.email_address,
          tags: finalTags,
        })
      }

      setTagProgress({ done: 0, total: items.length, errors: 0, skipped })

      // 5. Envoyer par batches de 25 via GraphQL (25 updates en 1 seule requête Shopify)
      let errors = 0
      const errorLogs: string[] = []
      const BATCH_SIZE = 25

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE)

        try {
          const resp = await fetch('/.netlify/functions/shopify-batch-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batch }),
          })
          const data = await resp.json()

          if (data.results) {
            for (const r of data.results as Array<{ email: string; success: boolean; reason?: string }>) {
              if (!r.success) {
                errors++
                errorLogs.push(`❌ ${r.email} — ${r.reason || 'Erreur inconnue'}`)
              }
            }
          }
        } catch (err) {
          errors += batch.length
          errorLogs.push(`❌ Batch ${i / BATCH_SIZE + 1} — Erreur réseau : ${err}`)
        }

        setTagProgress({ done: Math.min(i + BATCH_SIZE, items.length), total: items.length, errors, skipped })
        setTagErrors([...errorLogs])

        // Pause 1s entre batches pour laisser le bucket GraphQL se remplir
        if (i + BATCH_SIZE < items.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      setTagProgress({ done: items.length, total: items.length, errors, skipped })
      setTagErrors([...errorLogs])
      setTagDone(true)

    } finally {
      setTagging(false)
    }
  }

  if (loading) return <div className="section"><p>Chargement...</p></div>

  if (!token) {
    return (
      <div className="section">
        <h1>Synchronisation Shopify</h1>
        <p>Connectez d'abord Shopify depuis la page <a href="/shopify/connect">Connexion Shopify</a>.</p>
      </div>
    )
  }

  return (
    <div className="section">
      <h1>Synchronisation Shopify ↔ App</h1>

      <div className="divers-card" style={{ marginBottom: 16 }}>
        <h3>Importer dans la base de données</h3>
        <p className="divers-description">
          Importe les clients Shopify dans Supabase. Les emails existants sont liés, les nouveaux sont créés. Aucun doublon.
        </p>
        <button className="btn-primary" onClick={runImport} disabled={importing} style={{ marginBottom: 8 }}>
          {importing ? 'Import en cours... (peut prendre 1-2 min)' : 'Lancer l\'import Shopify → Supabase'}
        </button>
        {importResult && (
          <div>
            <p style={{ color: '#2a7a30', fontWeight: 600, marginBottom: 8 }}>
              ✅ {importResult.shopifyTotal} clients Shopify traités — {importResult.updated} liés, {importResult.created} créés, {importResult.skipped} déjà à jour
            </p>
            <div style={{ background: '#1a1a1a', color: '#00ff88', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {importResult.logs?.map((log, i) => (
                <div key={i}>{`> ${log}`}</div>
              ))}
            </div>
          </div>
        )}
        {importError && <p style={{ color: '#cb2020' }}>❌ {importError}</p>}
      </div>

      <div className="divers-card" style={{ marginBottom: 16 }}>
        <h3>Synchroniser les tags source → Shopify</h3>
        <p className="divers-description">
          Applique les tags <code>source:app</code> / <code>source:shopify</code> + <code>heritage-*</code> sur tous les clients Shopify liés.
          Pour les clients qui ont les deux comptes, la date de création la plus ancienne détermine la source.
        </p>
        <button className="btn-primary" onClick={runSourceTagging} disabled={tagging} style={{ marginBottom: 8 }}>
          {tagging ? `Synchronisation... ${tagProgress.done} / ${tagProgress.total}` : 'Lancer la synchronisation des tags'}
        </button>
        {tagging && tagProgress.total > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ background: 'rgba(193,154,107,0.2)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ background: '#2a7a30', height: '100%', width: `${(tagProgress.done / tagProgress.total) * 100}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#6b5a47', marginTop: 4 }}>
              {tagProgress.done} / {tagProgress.total} clients traités
              {tagProgress.errors > 0 && <span style={{ color: '#cb2020' }}> — {tagProgress.errors} erreur(s)</span>}
            </div>
          </div>
        )}
        {tagDone && (
          <p style={{ color: '#2a7a30', fontWeight: 600 }}>
            ✅ {tagProgress.total} clients traités — {tagProgress.total - tagProgress.errors} mis à jour, {tagProgress.errors} erreur(s)
            {tagProgress.skipped > 0 && <span style={{ color: '#6b5a47', fontWeight: 400 }}> — {tagProgress.skipped} ignoré(s) (déjà taggés)</span>}
          </p>
        )}
        {tagErrors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#cb2020', marginBottom: 4 }}>Détail des erreurs ({tagErrors.length}) :</p>
            <div style={{ background: '#1a1a1a', color: '#ff6b6b', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {tagErrors.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="divers-card">
        <h3>Aperçu croisé</h3>
        <button className="btn-primary" onClick={runSync} disabled={syncing} style={{ marginBottom: 16 }}>
          {syncing ? 'Chargement...' : results.length > 0 ? 'Actualiser' : 'Voir le croisement'}
        </button>

        {results.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button className={`btn-${filter === 'all' ? 'primary' : 'secondary'}`} onClick={() => setFilter('all')}>
                Tous ({counts.all})
              </button>
              <button className={`btn-${filter === 'both' ? 'primary' : 'secondary'}`} onClick={() => setFilter('both')} style={{ background: filter === 'both' ? '#2a7a30' : undefined, borderColor: '#2a7a30', color: filter === 'both' ? '#fff' : '#2a7a30' }}>
                ✅ Les deux ({counts.both})
              </button>
              <button className={`btn-${filter === 'shopify_only' ? 'primary' : 'secondary'}`} onClick={() => setFilter('shopify_only')} style={{ background: filter === 'shopify_only' ? '#b8860b' : undefined, borderColor: '#b8860b', color: filter === 'shopify_only' ? '#fff' : '#b8860b' }}>
                🛒 Shopify uniquement ({counts.shopify_only})
              </button>
              <button className={`btn-${filter === 'app_only' ? 'primary' : 'secondary'}`} onClick={() => setFilter('app_only')} style={{ background: filter === 'app_only' ? '#6b46c1' : undefined, borderColor: '#6b46c1', color: filter === 'app_only' ? '#fff' : '#6b46c1' }}>
                🗺️ App uniquement ({counts.app_only})
              </button>
            </div>

            <input
              type="search"
              placeholder="Rechercher par email ou nom..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
            />

            <table className="users-table">
              <thead>
                <tr>
                  <th>Statut</th>
                  <th>Email</th>
                  <th>Shopify</th>
                  <th>App</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(r => (
                  <tr key={r.email}>
                    <td>
                      {r.status === 'both' && <span style={{ color: '#2a7a30' }}>✅</span>}
                      {r.status === 'shopify_only' && <span style={{ color: '#b8860b' }}>🛒</span>}
                      {r.status === 'app_only' && <span style={{ color: '#6b46c1' }}>🗺️</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.email}</td>
                    <td style={{ fontSize: 11 }}>
                      {r.status !== 'app_only' ? (
                        <>
                          <div>{r.shopifyName || '—'}</div>
                          <div style={{ color: '#8A7B6A' }}>{r.shopifyOrdersCount} commande{r.shopifyOrdersCount > 1 ? 's' : ''}</div>
                          {r.shopifyTags && <div style={{ color: '#6b5a47', fontSize: 10 }}>{r.shopifyTags}</div>}
                        </>
                      ) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {r.status !== 'shopify_only' ? (
                        <>
                          <div>{r.appName || '—'}</div>
                          {r.appFaction && <div style={{ color: '#8A7B6A' }}>{r.appFaction}</div>}
                          <div style={{ color: '#b8860b' }}>🎖️ {r.appGlory}</div>
                        </>
                      ) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length > 200 && (
              <p style={{ color: '#8A7B6A', fontSize: 12, marginTop: 8 }}>
                Affichage limité à 200 résultats. Utilisez la recherche pour filtrer.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
