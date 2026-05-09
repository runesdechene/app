// Lib client Web Push — Runes de Chêne
// - subscribeUser / unsubscribeUser / syncSubscription
// - pushSupportStatus : détection iOS standalone vs unsupported vs native
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { create } from 'zustand'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

// État global partagé : "il existe une push subscription navigateur active".
// Mis à jour à chaque subscribe/unsubscribe pour que tous les composants UI
// (PushSettings dans ProfileMenu et MobileHeader) reflètent l'état réel
// même si l'action vient d'un autre composant (ex: PushAutoPrompt).
interface PushSubStore {
  hasSub: boolean
  setHasSub: (v: boolean) => void
}
export const usePushSubStore = create<PushSubStore>((set) => ({
  hasSub: false,
  setHasSub: (v) => set({ hasSub: v }),
}))

// Flag local : "l'utilisateur a explicitement désactivé les notifs depuis Settings".
// Stocke un timestamp pour expirer après 30 jours — au-delà on lui re-propose
// (au cas où il aurait changé d'avis depuis). Empêche syncSubscription /
// PushAutoPrompt de re-créer une sub silencieusement après un reload tant que
// le cooldown court.
const USER_DISABLED_KEY = 'push_user_disabled'
const USER_DISABLED_COOLDOWN_MS = 30 * 24 * 3600 * 1000  // 30 jours

export function isUserDisabled(): boolean {
  try {
    const v = localStorage.getItem(USER_DISABLED_KEY)
    if (!v) return false
    const ts = Number(v)
    if (!Number.isFinite(ts) || ts <= 0) return false
    return (Date.now() - ts) < USER_DISABLED_COOLDOWN_MS
  } catch { return false }
}

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
  // L'user vient d'activer explicitement → on lève le flag "désactivé"
  try { localStorage.removeItem(USER_DISABLED_KEY) } catch { /* noop */ }
  usePushSubStore.getState().setHasSub(true)
  return sub
}

export async function unsubscribeUser(): Promise<void> {
  // Marque l'intention AVANT toute action async — comme ça même si l'unsub
  // navigateur échoue, le sync auto au boot ne re-créera pas une sub.
  try { localStorage.setItem(USER_DISABLED_KEY, String(Date.now())) } catch { /* noop */ }
  usePushSubStore.getState().setHasSub(false)
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
  // Si l'user a désactivé explicitement, on respecte — pas de re-sub silencieux.
  if (isUserDisabled()) return
  const reg = await getRegistration()
  if (!reg) return

  const sub = await reg.pushManager.getSubscription()

  if (!sub) {
    usePushSubStore.getState().setHasSub(false)
    if (Notification.permission === 'granted') {
      await subscribeUser(userId)
    }
    return
  }
  usePushSubStore.getState().setHasSub(true)

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
