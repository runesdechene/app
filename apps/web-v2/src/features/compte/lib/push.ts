/**
 * QUOI     — les notifications push sur ce téléphone : ce qu'il permet, s'abonner, se
 *            désabonner, savoir s'il est abonné.
 * POURQUOI — l'abonnement appartient au service worker (src/sw.ts) ; la base garde l'adresse
 *            d'envoi par les RPC register_push_subscription / unregister_push_subscription
 *            (migration 147), et `send-push` s'en sert. La clé publique VAPID vient du .env racine,
 *            comme pour la V1.
 *            À chaque ouverture, `retablir` réinscrit l'adresse de ce téléphone : la base avait pu la
 *            perdre (service worker désinscrit du 07 au 26/10, refus d'un service de push) pendant que
 *            le téléphone, lui, restait abonné. Payé le 05/11 : 52 joueurs joignables sur 5 000.
 * ATTENTION — sur iPhone, le push n'existe que dans l'appli ajoutée à l'écran d'accueil.
 */
import { chaine, objet } from '@/shared/lib/lire'
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

// Le joueur a coupé le push sur ce téléphone : on ne le rétablit pas de soi-même.
const COUPE = 'push-coupe-ici'

function coupeIci() {
  try {
    return localStorage.getItem(COUPE) === '1'
  } catch {
    return false
  }
}

function noterCoupe(coupe: boolean) {
  try {
    if (coupe) localStorage.setItem(COUPE, '1')
    else localStorage.removeItem(COUPE)
  } catch {
    // Sans stockage, on le rétablira à la prochaine ouverture : il pourra le recouper.
  }
}

// La règle, sans navigateur : rétablir l'abonnement de ce téléphone ? Jamais de demande d'office.
export function aRetablir(t: {
  push: QuelPush
  permission: NotificationPermission
  coupe: boolean
}): boolean {
  return t.push === 'possible' && t.permission === 'granted' && !t.coupe
}

export async function retablir(): Promise<void> {
  const push = pushDeCeTelephone()
  if (push !== 'possible') return
  if (aRetablir({ push, permission: Notification.permission, coupe: coupeIci() })) await abonner()
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
  const { data, error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: endpoint ?? '',
    p_p256dh: keys?.p256dh ?? '',
    p_auth: keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
  // La fonction rend son refus ({ error }) au lieu de le lever : sans cette ligne, il passait inaperçu.
  const refus = objet(data).error
  if (refus !== undefined) throw new Error(chaine(refus))
  noterCoupe(false)
}

export async function desabonner(): Promise<void> {
  noterCoupe(true)
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await supabase.rpc('unregister_push_subscription', { p_endpoint: abonnement.endpoint })
  await abonnement.unsubscribe()
}
