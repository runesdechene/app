// Lib client Web Push — Runes de Chêne
// - subscribeUser / unsubscribeUser / syncSubscription
// - pushSupportStatus : détection iOS standalone vs unsupported vs native
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export type PushSupportStatus = 'native' | 'ios-needs-install' | 'unsupported'

export function pushSupportStatus(): PushSupportStatus {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unsupported'

  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIOS) {
    const standaloneFlag = (navigator as Navigator & { standalone?: boolean }).standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      standaloneFlag === true
    if (!isStandalone) return 'ios-needs-install'
    if (!('PushManager' in window)) return 'unsupported'
    return 'native'
  }

  if ('PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator) {
    return 'native'
  }
  return 'unsupported'
}

function urlBase64ToBuffer(b64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

// Note : on passe par les RPCs register/unregister_push_subscription
// (SECURITY DEFINER) côté serveur — pattern RdC pour toutes les écritures.
// Le user_id est dérivé de auth.uid() côté serveur, on n'a pas à le passer.
export async function subscribeUser(_userId: string): Promise<PushSubscription | null> {
  if (pushSupportStatus() !== 'native') return null
  if (!VAPID_PUBLIC_KEY) {
    console.error('[push] missing VITE_VAPID_PUBLIC_KEY')
    return null
  }

  const reg = await getRegistration()
  if (!reg) {
    console.error('[push] service worker not ready')
    return null
  }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      })
    } catch (err) {
      console.error('[push] pushManager.subscribe failed', err)
      return null
    }
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint ?? ''
  const p256dh   = json.keys?.p256dh ?? ''
  const auth     = json.keys?.auth ?? ''

  if (!endpoint || !p256dh || !auth) {
    console.error('[push] sub keys incomplete', json)
    return null
  }

  const { data, error } = await supabase.rpc('register_push_subscription', {
    p_endpoint:   endpoint,
    p_p256dh:     p256dh,
    p_auth:       auth,
    p_user_agent: navigator.userAgent,
  })
  if (error || (data && (data as { error?: string }).error)) {
    console.error('[push] register_push_subscription failed', error || data)
    return null
  }
  return sub
}

export async function unsubscribeUser(): Promise<void> {
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint })
}

// Au boot après login : aligne la sub locale avec la DB.
// - Sub navigateur absente mais permission granted → re-subscribe silencieusement
// - Sub navigateur présente → re-register (re-attribue au user_id courant)
export async function syncSubscription(userId: string): Promise<void> {
  if (pushSupportStatus() !== 'native') return
  const reg = await getRegistration()
  if (!reg) return

  const sub = await reg.pushManager.getSubscription()

  if (!sub) {
    if (Notification.permission === 'granted') {
      await subscribeUser(userId)
    }
    return
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint ?? ''
  const p256dh   = json.keys?.p256dh ?? ''
  const auth     = json.keys?.auth ?? ''
  if (!endpoint || !p256dh || !auth) return

  await supabase.rpc('register_push_subscription', {
    p_endpoint:   endpoint,
    p_p256dh:     p256dh,
    p_auth:       auth,
    p_user_agent: navigator.userAgent,
  })
}
