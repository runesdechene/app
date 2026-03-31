// Netlify Function : proxy les appels API Shopify pour éviter le CORS
// Le frontend appelle cette function, elle relaye à Shopify

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const endpoint = url.searchParams.get('endpoint')
  const token = url.searchParams.get('token')
  const shop = url.searchParams.get('shop') || 'runes-de-chene.myshopify.com'
  const method = request.method

  if (!endpoint || !token) {
    return new Response(JSON.stringify({ error: 'Missing endpoint or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const shopifyUrl = `https://${shop}/admin/api/2026-01/${endpoint}`

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    }

    // Pour POST/PUT, transmettre le body
    if (method === 'POST' || method === 'PUT') {
      fetchOptions.body = await request.text()
    }

    const resp = await fetch(shopifyUrl, fetchOptions)
    const data = await resp.text()

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }

    // Retransmettre le header Link pour la pagination Shopify
    const linkHeader = resp.headers.get('link')
    if (linkHeader) {
      responseHeaders['Link'] = linkHeader
    }

    return new Response(data, {
      status: resp.status,
      headers: responseHeaders,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: `Proxy error: ${error}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

export const config = {
  path: '/.netlify/functions/shopify-proxy',
}
