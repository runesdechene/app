import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'

// V0.7 phase 5 — Subscribe filtré sur les types Cour de activity_log.
// V1 simplifié : toasts affichés à tout le monde sans filtrage de cible
// (live-feed public, cohérent avec le pattern usePlayer.ts existant).
// V2 : table user_notifications dédiée pour cibler exactement les concernés.

const COURT_TYPES = new Set([
  'place_court_attack',
  'place_court_high_threat',
  'place_taken_remote',
  'place_taken_remote_self',
  'place_taken_back_gps',
  'place_reaffirmed',          // V096
  'mecene_principal_gained',
])

interface ActivityLogRow {
  id: number
  type: string
  actor_id: string | null
  place_id: string | null
  data: {
    placeTitle?: string
    actorName?: string
    expeditionId?: string
    score?: number
    total?: number
    oldExpeditionId?: string
    newExpeditionId?: string
    reclaimedBy?: string
    fromVacant?: boolean
    threatsCleared?: number
  } | null
  created_at: string
}

function buildToast(row: ActivityLogRow, currentUserId: string): {
  message: string
  highlights: string[]
} | null {
  const isSelf = row.actor_id === currentUserId
  const placeTitle = row.data?.placeTitle ?? 'un lieu'
  const actorName = isSelf ? 'Vous' : (row.data?.actorName ?? "Quelqu'un")

  switch (row.type) {
    case 'place_court_attack':
      // L'attaquant a déjà son retour côté frontend (modale). Skip pour soi.
      if (isSelf) return null
      return {
        message: `⚔️ ${actorName} s'intéresse à ${placeTitle}`,
        highlights: [actorName, placeTitle],
      }
    case 'place_court_high_threat':
      // Notif au veilleur — mais on n'a pas le filtrage côté frontend en V1.
      // Affiché à tous : sert de fil d'actu "tel lieu est en pression".
      return {
        message: `🔥 ${placeTitle} est sous forte pression`,
        highlights: [placeTitle],
      }
    case 'place_taken_remote':
      // Bascule côté ancien veilleur. Affiché à tous comme drama public.
      if (isSelf) return null  // L'auteur de la bascule a déjà sa notif _self
      return {
        message: `⚡ ${actorName} a pris ${placeTitle} à distance`,
        highlights: [actorName, placeTitle],
      }
    case 'place_taken_remote_self':
      // Notif à la nouvelle expé : actor_id = celui qui a investi pour basculer.
      if (!isSelf) return null
      if (row.data?.fromVacant) {
        return {
          message: `🏴 Vous avez posé votre marque sur ${placeTitle} — allez-y physiquement pour la confirmer`,
          highlights: [placeTitle],
        }
      }
      return {
        message: `⚡ Vous tenez ${placeTitle} à distance — allez-y physiquement pour le confirmer`,
        highlights: [placeTitle],
      }
    case 'place_taken_back_gps':
      // L'ancien légitime a repris le lieu. Affiché à tous.
      if (isSelf) {
        return {
          message: `🛡️ Vous avez repris ${placeTitle} par votre marche`,
          highlights: [placeTitle],
        }
      }
      return {
        message: `🛡️ L'ancien veilleur a repris ${placeTitle}`,
        highlights: [placeTitle],
      }
    case 'place_reaffirmed': {
      // Plein-veilleur qui revient IRL et efface les menaces (V096)
      const cleared = row.data?.threatsCleared ?? 0
      if (isSelf) {
        return {
          message: cleared > 0
            ? `🛡️ Vous avez réaffirmé votre veille sur ${placeTitle} — ${cleared} menace${cleared > 1 ? 's' : ''} effacée${cleared > 1 ? 's' : ''}`
            : `🛡️ Vous êtes repassé sur ${placeTitle}`,
          highlights: [placeTitle],
        }
      }
      // Côté challengers déchus : message public discret
      return {
        message: `🛡️ ${actorName} a réaffirmé sa veille sur ${placeTitle}`,
        highlights: [actorName, placeTitle],
      }
    }
    case 'mecene_principal_gained':
      if (!isSelf) return null  // Toast perso uniquement
      return {
        message: `👑 Vous êtes désormais Mécène Principal de ${placeTitle}`,
        highlights: [placeTitle],
      }
    default:
      return null
  }
}

export function useCourtNotifications() {
  const userId = usePlayerStore(s => s.userId)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    const ch = supabase.channel(`court-notif-${userId}`)
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      (payload) => {
        const row = payload.new as ActivityLogRow
        if (!COURT_TYPES.has(row.type)) return
        const t = buildToast(row, userId)
        if (!t) return
        useToastStore.getState().addToast({
          type: 'court',
          message: t.message,
          highlights: t.highlights,
          actorId: row.actor_id ?? undefined,
          placeId: row.place_id ?? undefined,
          timestamp: Date.now(),
        })
      },
    )
    ch.subscribe()
    channelRef.current = ch

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId])
}
