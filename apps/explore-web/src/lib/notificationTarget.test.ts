// Spec exécutable du routing des notifications.
// Pas de runner frontend dans le projet → exécution one-off via esbuild :
//   npx esbuild src/lib/notificationTarget.test.ts --bundle --format=esm --outfile=tmp.mjs && node tmp.mjs
import assert from 'node:assert'
import { resolveNotificationTarget, type NotificationTarget } from './notificationTarget'
import type { Notification } from '../stores/notificationStore'

function notif(type: string, data: Record<string, unknown>): Notification {
  return { id: 1, type: type as Notification['type'], data, read: false, created_at: '' }
}

const cases: Array<{ name: string; notif: Notification; expect: NotificationTarget }> = [
  // Voyages : expeditionId = voyages.id → modale d'expédition.
  {
    name: 'expedition_message → expedition, tab chat',
    notif: notif('expedition_message', { expeditionId: 'voy-1', expeditionName: 'X' }),
    expect: { kind: 'expedition', id: 'voy-1', tab: 'chat' },
  },
  {
    name: 'expedition_join_request → expedition, tab info',
    notif: notif('expedition_join_request', { expeditionId: 'voy-2' }),
    expect: { kind: 'expedition', id: 'voy-2', tab: 'info' },
  },
  // Cour : expeditionId = expeditions.id (Cour) → DOIT ouvrir le LIEU (onglet infos),
  // surtout PAS le store voyages. C'est le cœur du bug corrigé.
  {
    name: 'place_court_attack (avec expeditionId Cour) → place, tab infos',
    notif: notif('place_court_attack', { placeId: 'p-1', expeditionId: 'court-exp-1' }),
    expect: { kind: 'place', id: 'p-1', tab: 'infos' },
  },
  {
    name: 'place_court_high_threat (avec expeditionId) → place, tab infos',
    notif: notif('place_court_high_threat', { placeId: 'p-2', expeditionId: 'court-exp-2', score: 5 }),
    expect: { kind: 'place', id: 'p-2', tab: 'infos' },
  },
  {
    name: 'place_taken_back_gps (avec expeditionId) → place, tab infos',
    notif: notif('place_taken_back_gps', { placeId: 'p-3', expeditionId: 'court-exp-3' }),
    expect: { kind: 'place', id: 'p-3', tab: 'infos' },
  },
  {
    name: 'place_taken_remote_self (fromVacant, avec expeditionId) → place, tab infos',
    notif: notif('place_taken_remote_self', { placeId: 'p-4', expeditionId: 'court-exp-4', fromVacant: true }),
    expect: { kind: 'place', id: 'p-4', tab: 'infos' },
  },
  // Notifs lieu sans expeditionId : marchaient déjà, ne pas régresser.
  {
    name: 'place_taken_remote (sans expeditionId) → place, tab infos',
    notif: notif('place_taken_remote', { placeId: 'p-5', newExpeditionId: 'x' }),
    expect: { kind: 'place', id: 'p-5', tab: 'infos' },
  },
  {
    name: 'mecene_principal_gained → place, tab infos',
    notif: notif('mecene_principal_gained', { placeId: 'p-6' }),
    expect: { kind: 'place', id: 'p-6', tab: 'infos' },
  },
  // Carnets → onglet carnets.
  {
    name: 'like_carnet → place, tab carnets',
    notif: notif('like_carnet', { placeId: 'p-7', actorId: 'u' }),
    expect: { kind: 'place', id: 'p-7', tab: 'carnets' },
  },
  // Sans cible exploitable → none (pas de crash, ferme juste le panneau).
  {
    name: 'daily_enigma_ready → none',
    notif: notif('daily_enigma_ready', {}),
    expect: { kind: 'none' },
  },
  {
    name: 'expedition_modified sans expeditionId → none',
    notif: notif('expedition_modified', {}),
    expect: { kind: 'none' },
  },
]

let failures = 0
for (const c of cases) {
  try {
    assert.deepStrictEqual(resolveNotificationTarget(c.notif), c.expect)
    console.log(`✓ ${c.name}`)
  } catch (e) {
    failures++
    console.error(`✗ ${c.name}\n  ${(e as Error).message}`)
  }
}
if (failures > 0) {
  console.error(`\n${failures} test(s) en échec`)
  process.exit(1)
}
console.log(`\n${cases.length} tests OK`)
