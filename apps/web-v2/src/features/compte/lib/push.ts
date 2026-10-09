/**
 * QUOI     — les notifications push sur ce téléphone : ce qu'il permet, s'abonner, se
 *            désabonner, savoir s'il est abonné.
 * POURQUOI — l'abonnement appartient au service worker (src/sw.ts) ; la base garde l'adresse
 *            d'envoi par les RPC register_push_subscription / unregister_push_subscription
 *            (migration 147), et `send-push` s'en sert. La clé publique VAPID vient du .env racine,
 *            comme pour la V1.
 * ATTENTION — sur iPhone, le push n'existe que dans l'appli ajoutée à l'écran d'accueil.
 */
import { supabase } from '@/shared/supabase/client'

const CLE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type QuelPush = 'possible' | 'installer-d-abord' | 'impossible'

// La règle, sans navigateur : ce qu'un téléphone permet.
export function quelPush(t: { userAgent: string; aLePush: boolean; installee: boolean }): QuelPush {
  const iPhone = /iPad|iPhone|iPod/.test(t.userAgent)
  if (iPhone && !t.installee) return 'installer-d-abord'
  return t.aLePush ? 'possible' : 'impossible'
}

export function pushDeCeTelephone(): QuelPush {
  return quelPush({
    userAgent: navigator.userAgent,
    aLePush: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    installee: window.matchMedia('(display-mode: standalone)').matches,
  })
}

// La clé VAPID est en base64 « url » (- et _ au lieu de + et /, sans =).
export function cleEnOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(brut, (c) => c.charCodeAt(0))
}

async function abonnementActuel(): Promise<PushSubscription | null> {
  const enregistrement = await navigator.serviceWorker.ready
  return enregistrement.pushManager.getSubscription()
}

export async function estAbonne(): Promise<boolean> {
  if (pushDeCeTelephone() !== 'possible') return false
  return (await abonnementActuel()) !== null
}

// Demande la permission si besoin, puis inscrit l'adresse d'envoi en base. Lève en cas d'échec.
export async function abonner(): Promise<void> {
  if (!CLE_VAPID) throw new Error('Clé VAPID absente')
  const enregistrement = await navigator.serviceWorker.ready
  const abonnement =
    (await enregistrement.pushManager.getSubscription()) ??
    (await enregistrement.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cleEnOctets(CLE_VAPID),
    }))
  const { endpoint, keys } = abonnement.toJSON()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: endpoint ?? '',
    p_p256dh: keys?.p256dh ?? '',
    p_auth: keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

export async function desabonner(): Promise<void> {
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await supabase.rpc('unregister_push_subscription', { p_endpoint: abonnement.endpoint })
  await abonnement.unsubscribe()
}
