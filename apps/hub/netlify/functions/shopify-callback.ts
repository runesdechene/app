// Netlify Function : échange le code OAuth Shopify contre un access token
// Le navigateur ne peut pas appeler Shopify directement (CORS)
// Cette fonction serverless fait le relais côté serveur

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const shop = url.searchParams.get('shop') || 'runes-de-chene.myshopify.com'

  if (!code) {
    return new Response('Missing code parameter', { status: 400 })
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return new Response('Missing Shopify credentials in env', { status: 500 })
  }

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token exchange failed:', error)
      return new Response(`Token exchange failed: ${error}`, { status: 500 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Rediriger vers le Hub avec le token en query param
    // Le Hub le stockera dans app_settings
    const redirectUrl = `${url.origin}/shopify/callback?token=${accessToken}&shop=${shop}`
    return Response.redirect(redirectUrl, 302)

  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(`OAuth callback failed: ${error}`, { status: 500 })
  }
}

export const config = {
  path: '/.netlify/functions/shopify-callback',
}
