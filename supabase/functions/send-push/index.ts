// Supabase Edge Function : send-push
// POST endpoint appelé par le trigger SQL after INSERT ON notifications.
// - Lit VAPID + push_trigger_secret depuis app_settings (pas de Supabase secrets car
//   l'API MCP ne les expose pas — tout en DB)
// - Vérifie l'header X-Push-Secret pour bloquer les calls non autorisés
// - Filtre par catégorie + préférences user, envoie via web-push, cleanup 410
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
// @ts-expect-error: web-push has no types in npm: import context
import webpush from 'web-push'
import { categoryOf } from './categories.ts'
import { formatPayload } from './payloads.ts'

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

interface SubRow {
  id:       number
  endpoint: string
  p256dh:   string
  auth:     string
}

interface AppConfig {
  vapid_public_key:     string
  vapid_private_key:    string
  vapid_subject:        string
  push_trigger_secret:  string
}

let cachedConfig: AppConfig | null = null

async function loadConfig(): Promise<AppConfig | null> {
  if (cachedConfig) return cachedConfig
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['vapid_public_key', 'vapid_private_key', 'vapid_subject', 'push_trigger_secret'])
  if (error || !data) {
    console.error('app_settings_lookup_failed', error)
    return null
  }
  const map = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, string>
  if (!map.vapid_public_key || !map.vapid_private_key || !map.vapid_subject || !map.push_trigger_secret) {
    console.error('app_settings_missing_keys', Object.keys(map))
    return null
  }
  cachedConfig = {
    vapid_public_key:    map.vapid_public_key,
    vapid_private_key:   map.vapid_private_key,
    vapid_subject:       map.vapid_subject,
    push_trigger_secret: map.push_trigger_secret,
  }
  webpush.setVapidDetails(
    cachedConfig.vapid_subject,
    cachedConfig.vapid_public_key,
    cachedConfig.vapid_private_key,
  )
  return cachedConfig
}

const ok = () => new Response(JSON.stringify({ ok: true }), {
  headers: { 'Content-Type': 'application/json' },
})

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const config = await loadConfig()
  if (!config) {
    return new Response('config not loaded', { status: 503 })
  }

  // Auth shared-secret : le trigger SQL envoie X-Push-Secret depuis app_config.
  const providedSecret = req.headers.get('x-push-secret')
  if (providedSecret !== config.push_trigger_secret) {
    return new Response('unauthorized', { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return new Response('bad json', { status: 400 })
  }

  const { recipient_id, type, data } = body

  // 1. Catégorisation
  const category = categoryOf(type)
  if (category === 'silent') return ok()

  // 2. Préférences user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('push_important_enabled, push_recap_enabled')
    .eq('id', recipient_id)
    .single()
  if (userErr || !user) {
    console.warn('user_lookup_failed', userErr)
    return ok()
  }
  if (category === 'important' && !user.push_important_enabled) return ok()
  if (category === 'recap'     && !user.push_recap_enabled)     return ok()

  // 3. Subscriptions actives
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipient_id)
  if (subsErr) {
    console.error('subs_lookup_failed', subsErr)
    return ok()
  }
  const subList = (subs ?? []) as SubRow[]
  if (subList.length === 0) return ok()

  // 4. Format payload
  const payload = formatPayload(type, data)
  if (!payload) return ok()
  const payloadJson = JSON.stringify(payload)

  // 5. Envoi parallèle, cleanup 410
  console.log('send-push start', { recipient_id, type, category, sub_count: subList.length, payload })

  await Promise.all(subList.map(async (sub) => {
    try {
      const result = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadJson,
        {
          TTL: 86400,
          urgency: category === 'important' ? 'high' : 'normal',
        },
      )
      console.log('push_sent_ok', {
        sub_id: sub.id,
        push_service: new URL(sub.endpoint).hostname,
        status_code: (result as { statusCode?: number })?.statusCode,
        body: (result as { body?: string })?.body,
      })
      await supabase
        .from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      const body = (err as { body?: string })?.body
      console.error('push_failed', { sub_id: sub.id, status, body, err_message: (err as Error)?.message })
      if (status === 410 || status === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return ok()
})
