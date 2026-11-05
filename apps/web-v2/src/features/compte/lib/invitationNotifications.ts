/**
 * QUOI     — quand inviter aux notifications (maquette Figma 951:3439, Uriel 05/11), et « Plus tard »
 *            gardé sur ce téléphone.
 * POURQUOI — la V2 ne demandait jamais : 52 joueurs joignables sur 5 000. On demande une fois, on
 *            ne harcèle pas : un téléphone qui a répondu n'est plus invité (accordé, `retablir`
 *            s'en charge ; refusé, seul le navigateur peut revenir dessus).
 * ATTENTION — sans stockage (navigation privée), « Plus tard » ne tient que le temps de la visite.
 */
import { coupeIci, pushDeCeTelephone, type QuelPush } from './push'

export const SEMAINE = 7 * 24 * 60 * 60 * 1000
const PLUS_TARD = 'invitation-notifications-plus-tard'

// La règle, sans navigateur.
export function aInviter(t: {
  push: QuelPush
  permission: NotificationPermission
  coupe: boolean
  plusTardLe: number | null
  maintenant: number
}): boolean {
  const repoussee = t.plusTardLe !== null && t.maintenant - t.plusTardLe < SEMAINE
  return t.push === 'possible' && t.permission === 'default' && !t.coupe && !repoussee
}

function plusTardLe(): number | null {
  try {
    const v = localStorage.getItem(PLUS_TARD)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

export function aInviterCeTelephone(): boolean {
  const push = pushDeCeTelephone()
  if (push !== 'possible') return false
  return aInviter({
    push,
    permission: Notification.permission,
    coupe: coupeIci(),
    plusTardLe: plusTardLe(),
    maintenant: Date.now(),
  })
}

export function repousserInvitation() {
  try {
    localStorage.setItem(PLUS_TARD, String(Date.now()))
  } catch {
    // Elle reviendra à la prochaine ouverture.
  }
}
