// Netlify Function: publie/met à jour un article de blog Shopify (miroir public
// d'une annonce). Sync à sens unique Hub -> Shopify. Auth admin requise.
// Mirroir des patterns existants (requireAdmin, json, SHOPIFY_ACCESS_TOKEN, API 2026-01).
// NB: le rendu Markdown -> HTML est fait côté Hub (renderMarkdown) et envoyé en
// body_html ; on n'importe AUCUN package npm ici (les fonctions sans import sont
// les seules qui bundlent proprement dans ce repo).

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const SHOP = process.env.SHOPIFY_SHOP || 'runes-de-chene.myshopify.com'
const API = '2026-01'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function requireAdmin(request: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!bearer) return { error: 'Missing Authorization header', status: 401 }
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearer}` },
  })
  if (!userResp.ok) return { error: 'Invalid session', status: 401 }
  const user = await userResp.json() as { id?: string }
  if (!user?.id) return { error: 'Invalid session', status: 401 }
  const roleResp = await fetch(`${SUPABASE_URL}/rest/v1/users?select=role&id=eq.${user.id}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const rows = await roleResp.json() as Array<{ role?: string }>
  if (!rows[0] || rows[0].role !== 'admin') return { error: 'Forbidden — admin only', status: 403 }
  return { userId: user.id }
}

function shopify(endpoint: string, init: RequestInit) {
  return fetch(`https://${SHOP}/admin/api/${API}/${endpoint}`, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN!,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

interface AnnouncementInput {
  title: string
  body_html: string       // HTML déjà rendu côté Hub
  cover_image?: string | null
  type?: string
}

async function resolveBlogId(): Promise<string | null> {
  // 1) app_settings.shopify_blog_id ; 2) premier blog Shopify
  const sresp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=value&key=eq.shopify_blog_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const srows = await sresp.json() as Array<{ value?: string }>
  const configured = srows[0]?.value
  if (configured) return configured
  const bresp = await shopify('blogs.json', { method: 'GET' })
  if (!bresp.ok) return null
  const blogs = await bresp.json() as { blogs?: Array<{ id: number }> }
  return blogs.blogs?.[0]?.id ? String(blogs.blogs[0].id) : null
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!SHOPIFY_TOKEN) return json({ error: 'SHOPIFY_ACCESS_TOKEN not configured' }, 500)

  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  let payload: { announcement: AnnouncementInput; shopify_article_id?: string | null }
  try {
    payload = await request.json() as { announcement: AnnouncementInput; shopify_article_id?: string | null }
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const { announcement, shopify_article_id } = payload
  if (!announcement?.title) return json({ error: 'title_required' }, 400)

  const blogId = await resolveBlogId()
  if (!blogId) return json({ error: 'no_shopify_blog' }, 500)

  const articleBody = {
    article: {
      title: announcement.title,
      body_html: announcement.body_html ?? '',
      ...(announcement.cover_image ? { image: { src: announcement.cover_image } } : {}),
      tags: announcement.type ? `annonce,${announcement.type}` : 'annonce',
    },
  }

  try {
    const resp = shopify_article_id
      ? await shopify(`blogs/${blogId}/articles/${shopify_article_id}.json`, { method: 'PUT', body: JSON.stringify(articleBody) })
      : await shopify(`blogs/${blogId}/articles.json`, { method: 'POST', body: JSON.stringify(articleBody) })
    const data = await resp.json() as { article?: { id?: number } }
    if (!resp.ok || !data.article?.id) {
      return json({ error: 'shopify_error', detail: data }, 502)
    }
    return json({ article_id: String(data.article.id) })
  } catch (e) {
    return json({ error: `shopify_request_failed: ${e}` }, 502)
  }
}

export const config = { path: '/.netlify/functions/shopify-article' }
