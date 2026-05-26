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
    html: `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#e3d4b6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9ddc7;background:linear-gradient(180deg,#efe4cf 0%,#e1d1b2 100%);padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#f7f1e3;border:1px solid #d8c39a;border-radius:16px;overflow:hidden;box-shadow:0 18px 44px rgba(40,30,16,0.20);">
        <tr><td style="height:6px;background:linear-gradient(90deg,#b8945a,#9a7b41,#cda86a);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:36px 40px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:6px;color:#9a7b41;text-transform:uppercase;">Runes de Chêne</div>
          <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:#b6a07a;text-transform:uppercase;margin-top:8px;">⚜&nbsp;&nbsp;Le Mouvement&nbsp;&nbsp;⚜</div>
        </td></tr>
        <tr><td align="center" style="padding:26px 44px 0;">
          <h1 style="margin:0;font-family:Georgia,'Hoefler Text',serif;font-weight:normal;font-size:30px;line-height:1.2;color:#2b2114;">Merci, ${name}.</h1>
          <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#5b4d38;">Ta contribution a été <em>adoubée</em> par notre équipe.<br>Elle rejoint désormais le Mouvement Runes de Chêne.</p>
        </td></tr>
        <tr><td align="center" style="padding:30px 0 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="152" height="152" style="width:152px;height:152px;background:#241d12;background:radial-gradient(circle at 50% 36%,#352a19,#1b150c);border:2px solid #b8945a;border-radius:50%;">
            <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:#c8ad79;text-transform:uppercase;">Créditées</div>
            <div style="font-family:Georgia,'Hoefler Text',serif;font-size:48px;line-height:1;color:#e8cd92;padding:4px 0;">+${crowns}</div>
            <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;color:#c8ad79;text-transform:uppercase;">Couronnes</div>
          </td></tr></table>
        </td></tr>
        <tr><td align="center" style="padding:16px 48px 0;">
          <p style="margin:0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#5b4d38;">Tes Couronnes de Chêne t'attendent sur <strong style="color:#2b2114;">l'application</strong>.<br>Connecte-toi avec cet email pour les dépenser.</p>
        </td></tr>
        <tr><td align="center" style="padding:28px 0 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:10px;background:#8a6d3b;background:linear-gradient(180deg,#a9874c,#876a39);box-shadow:0 6px 16px rgba(138,109,59,0.40);">
            <a href="https://app.runesdechene.com" style="display:inline-block;padding:15px 36px;font-family:Georgia,serif;font-size:16px;color:#fff7e8;text-decoration:none;letter-spacing:.5px;">Ouvrir l'application&nbsp;→</a>
          </td></tr></table>
        </td></tr>
        <tr><td align="center" style="padding:30px 48px 0;"><div style="font-size:13px;color:#c4ac80;letter-spacing:5px;">✦&nbsp;⚜&nbsp;✦</div></td></tr>
        <tr><td align="center" style="padding:14px 48px 38px;">
          <p style="margin:0;font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#9b8b6e;font-style:italic;">Tu reçois ce message car tu as partagé du contenu avec Runes de Chêne.<br>À très vite sur les chemins.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
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
