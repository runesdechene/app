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

    // Afficher le token en HTML pour copie manuelle dans Netlify env vars.
    // Pas de stockage automatique : le token doit aller dans
    // SHOPIFY_ACCESS_TOKEN côté Netlify Dashboard, puis redeploy.
    const escapedShop = shop.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!))
    const escapedToken = accessToken.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!))
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Shopify OAuth — Token généré</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 720px; margin: 40px auto; padding: 20px; color: #2a2014; background: #f7f1e3; }
  h1 { color: #6b3e1a; }
  code { display: block; background: #1a1a1a; color: #00ff88; padding: 16px; border-radius: 8px; word-break: break-all; font-size: 14px; margin: 16px 0; }
  .step { margin: 12px 0; }
  .warn { background: #fff3cd; border-left: 4px solid #d4a017; padding: 12px; border-radius: 4px; margin: 16px 0; }
</style></head>
<body>
<h1>Token Shopify généré</h1>
<p>Boutique : <strong>${escapedShop}</strong></p>
<p>Nouveau access token (visible une seule fois) :</p>
<code>${escapedToken}</code>
<div class="warn">
<strong>À faire maintenant :</strong>
<div class="step">1. Copie le token ci-dessus.</div>
<div class="step">2. Va sur Netlify Dashboard → site Hub → Site configuration → Environment variables.</div>
<div class="step">3. Édite la variable <code style="display:inline; padding:2px 6px;">SHOPIFY_ACCESS_TOKEN</code> et colle la nouvelle valeur. Save.</div>
<div class="step">4. Trigger redeploy Netlify pour que les Functions rechargent l'env (sinon les instances warm gardent l'ancien token).</div>
<div class="step">5. Test sur <a href="${url.origin}/shopify/sync">/shopify/sync</a> que la sync Shopify marche.</div>
</div>
<p style="font-size: 12px; opacity: 0.7;">Ce token n'est PAS stocké côté serveur. Si tu fermes cette page sans copier, il faudra refaire un OAuth flow pour en générer un nouveau.</p>
</body>
</html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(`OAuth callback failed: ${error}`, { status: 500 })
  }
}

export const config = {
  path: '/.netlify/functions/shopify-callback',
}
