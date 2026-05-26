// Supabase Edge Function : send-email
// POST appelé par le trigger SQL email_on_notification (after INSERT ON notifications).
// - Lit resend_api_key + email_from + email_trigger_secret depuis app_settings (tout en DB).
// - Vérifie X-Email-Secret. Brique 1 : ne gère que le type 'contribution_approved'.
// - Envoie via l'API REST Resend. Spec : docs/superpowers/specs/2026-05-26-ugc-mouvement-model-design.md
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface RequestBody {
  notification_id: number
  recipient_id:    string
  type:            string
  data:            Record<string, unknown>
}
interface EmailConfig {
  resend_api_key:       string
  email_from:           string
  email_trigger_secret: string
}

let cachedConfig: EmailConfig | null = null
async function loadConfig(): Promise<EmailConfig | null> {
  if (cachedConfig) return cachedConfig
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from', 'email_trigger_secret'])
  if (error || !data) { console.error('app_settings_lookup_failed', error); return null }
  const map = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, string>
  if (!map.resend_api_key || !map.email_from || !map.email_trigger_secret) {
    console.error('app_settings_missing_keys', Object.keys(map)); return null
  }
  cachedConfig = {
    resend_api_key:       map.resend_api_key,
    email_from:           map.email_from,
    email_trigger_secret: map.email_trigger_secret,
  }
  return cachedConfig
}

const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })

function renderContributionApproved(firstName: string, crowns: number): { subject: string; html: string } {
  const name = firstName?.trim() || 'Ami du Mouvement'
  // Tonalité pensée pour la majorité (~90% de comptes déjà existants, clients Shopify/stand
  // avec fragments activés) : on n'introduit pas l'appli comme à un inconnu, on invite à se
  // (re)connecter. La ligne « connecte-toi avec cet email » couvre aussi les ~10% de comptes neufs.
  return {
    subject: 'Ta contribution rejoint le Mouvement ⚜️',
    html: `<!doctype html><html><body style="margin:0;background:#f4efe6;font-family:Georgia,serif;color:#2b2218">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <h1 style="font-size:24px;margin:0 0 8px">Merci, ${name}.</h1>
    <p style="font-size:16px;line-height:1.6">Ta contribution vient d'être adoubée par notre équipe et rejoint <strong>Le Mouvement Runes de Chêne</strong>.</p>
    <div style="margin:24px 0;padding:18px 22px;background:#2b2218;color:#e9d9b6;border-radius:10px;text-align:center">
      <div style="font-size:14px;letter-spacing:.05em;text-transform:uppercase;opacity:.8">Créditées sur ton compte</div>
      <div style="font-size:28px;font-weight:bold;margin-top:4px">+${crowns} Couronnes de Chêne</div>
    </div>
    <p style="font-size:16px;line-height:1.6">Retrouve-les sur <strong>La Carte</strong> — connecte-toi avec cet email pour les dépenser.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="https://app.runesdechene.com" style="display:inline-block;background:#8a6d3b;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px">Ouvrir La Carte →</a>
    </p>
    <p style="font-size:13px;color:#8a7d68;line-height:1.5">Tu reçois cet email parce que tu as partagé du contenu avec Runes de Chêne. À très vite sur les chemins.</p>
  </div></body></html>`,
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const config = await loadConfig()
  if (!config) return new Response('config not loaded', { status: 503 })

  const providedSecret = req.headers.get('x-email-secret')
  if (providedSecret !== config.email_trigger_secret) return new Response('unauthorized', { status: 401 })

  let body: RequestBody
  try { body = await req.json() as RequestBody } catch { return new Response('bad json', { status: 400 }) }

  if (body.type !== 'contribution_approved') return ok()

  const { data: user, error } = await supabase
    .from('users')
    .select('email_address, first_name')
    .eq('id', body.recipient_id)
    .single()
  if (error || !user?.email_address) { console.warn('user_lookup_failed', error); return ok() }

  const crowns = Number((body.data as { crowns?: number })?.crowns ?? 0)
  const { subject, html } = renderContributionApproved(user.first_name ?? '', crowns)

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.email_from, to: user.email_address, subject, html }),
  })
  if (!resp.ok) {
    console.error('resend_failed', resp.status, await resp.text())
    return ok()
  }
  console.log('email_sent_ok', { recipient_id: body.recipient_id })
  return ok()
})
