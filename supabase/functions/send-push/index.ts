// Supabase Edge Function : send-push
// POST endpoint appelé par le trigger SQL after INSERT ON notifications.
// Filtre par catégorie + préférences user, envoie via web-push, cleanup 410.
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
// @ts-expect-error: web-push has no types in npm: import context
import webpush from 'web-push'
import { categoryOf } from './categories.ts'
import { formatPayload } from './payloads.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY          = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY         = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT             = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

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

const ok = () => new Response(JSON.stringify({ ok: true }), {
  headers: { 'Content-Type': 'application/json' },
})

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
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
  await Promise.all(subList.map(async (sub) => {
    try {
      await webpush.sendNotification(
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
      await supabase
        .from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 410 || status === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else if (status === 429) {
        console.warn('rate_limited', sub.id)
      } else {
        console.error('push_failed', sub.id, err)
      }
    }
  }))

  return ok()
})
