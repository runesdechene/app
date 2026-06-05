import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget, type NotificationTarget } from './notificationTarget'
import type { Notification } from '../stores/notificationStore'

function notif(type: string, data: Record<string, unknown>): Notification {
  return { id: 1, type: type as Notification['type'], data, read: false, created_at: '' }
}

describe('resolveNotificationTarget', () => {
  // Voyages : expeditionId = voyages.id → modale d'expédition.
  it('expedition_message → expedition, tab chat', () => {
    expect(resolveNotificationTarget(notif('expedition_message', { expeditionId: 'voy-1', expeditionName: 'X' }))).toEqual(
      { kind: 'expedition', id: 'voy-1', tab: 'chat' }
    )
  })

  it('expedition_join_request → expedition, tab info', () => {
    expect(resolveNotificationTarget(notif('expedition_join_request', { expeditionId: 'voy-2' }))).toEqual(
      { kind: 'expedition', id: 'voy-2', tab: 'info' }
    )
  })

  // Cour : expeditionId = expeditions.id (Cour) → DOIT ouvrir le LIEU (onglet infos),
  // surtout PAS le store voyages. C'est le cœur du bug corrigé.
  it('place_court_attack (avec expeditionId Cour) → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('place_court_attack', { placeId: 'p-1', expeditionId: 'court-exp-1' }))).toEqual(
      { kind: 'place', id: 'p-1', tab: 'infos' }
    )
  })

  it('place_court_high_threat (avec expeditionId) → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('place_court_high_threat', { placeId: 'p-2', expeditionId: 'court-exp-2', score: 5 }))).toEqual(
      { kind: 'place', id: 'p-2', tab: 'infos' }
    )
  })

  it('place_taken_back_gps (avec expeditionId) → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('place_taken_back_gps', { placeId: 'p-3', expeditionId: 'court-exp-3' }))).toEqual(
      { kind: 'place', id: 'p-3', tab: 'infos' }
    )
  })

  it('place_taken_remote_self (fromVacant, avec expeditionId) → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('place_taken_remote_self', { placeId: 'p-4', expeditionId: 'court-exp-4', fromVacant: true }))).toEqual(
      { kind: 'place', id: 'p-4', tab: 'infos' }
    )
  })

  // Notifs lieu sans expeditionId : marchaient déjà, ne pas régresser.
  it('place_taken_remote (sans expeditionId) → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('place_taken_remote', { placeId: 'p-5', newExpeditionId: 'x' }))).toEqual(
      { kind: 'place', id: 'p-5', tab: 'infos' }
    )
  })

  it('mecene_principal_gained → place, tab infos', () => {
    expect(resolveNotificationTarget(notif('mecene_principal_gained', { placeId: 'p-6' }))).toEqual(
      { kind: 'place', id: 'p-6', tab: 'infos' }
    )
  })

  // Carnets → onglet discussion.
  it('like_carnet → place, tab discussion', () => {
    expect(resolveNotificationTarget(notif('like_carnet', { placeId: 'p-7', actorId: 'u' }))).toEqual(
      { kind: 'place', id: 'p-7', tab: 'discussion' }
    )
  })

  // Sans cible exploitable → none (pas de crash, ferme juste le panneau).
  it('daily_enigma_ready → none', () => {
    expect(resolveNotificationTarget(notif('daily_enigma_ready', {}))).toEqual(
      { kind: 'none' }
    )
  })

  it('expedition_modified sans expeditionId → none', () => {
    expect(resolveNotificationTarget(notif('expedition_modified', {}))).toEqual(
      { kind: 'none' }
    )
  })
})