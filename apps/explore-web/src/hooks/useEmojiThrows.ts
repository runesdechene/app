import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useMutedUsers } from './useMutedUsers'
import { isAllowedEmoji } from '../lib/emojiBank'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface FlyingEmoji {
  id: string
  fromUserId: string
  toUserId: string
  emoji: string
  startedAt: number
}

const MAX_CONCURRENT = 20
const ANIM_DURATION_MS = 1300
const CLIENT_THROTTLE_MS = 100 // anti-spam, max 10 throws/sec par client
const CHANNEL_NAME = 'emoji-throws'

/**
 * V0.7+ Lancer d'emoji façon Zenly. Channel Realtime broadcast pur (zéro DB).
 * Validation côté serveur via RPC validate_emoji_throw avant chaque envoi (anti-spoof).
 * Le filtrage viewport est fait par FlyingEmojiLayer (ici on accepte tous les throws non-mutés).
 */
export function useEmojiThrows() {
  const userId = usePlayerStore(s => s.userId)
  const { isMuted } = useMutedUsers()
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastThrowAtRef = useRef<number>(0)

  // Cleanup auto des animations terminées
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ANIM_DURATION_MS - 200
      setFlying(prev => prev.filter(f => f.startedAt > cutoff))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Subscribe au channel
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    })
    channel
      .on('broadcast', { event: 'throw' }, ({ payload }) => {
        const p = payload as { from?: string; to?: string; emoji?: string }
        if (!p.from || !p.to || !p.emoji) return
        if (!isAllowedEmoji(p.emoji)) return
        if (isMuted(p.from)) return
        setFlying(prev => {
          if (prev.length >= MAX_CONCURRENT) return prev
          return [...prev, {
            id: `${p.from}-${p.to}-${Date.now()}-${Math.random()}`,
            fromUserId: p.from!,
            toUserId: p.to!,
            emoji: p.emoji!,
            startedAt: Date.now(),
          }]
        })
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, isMuted])

  const throwEmoji = useCallback(async (toUserId: string, emoji: string) => {
    if (!userId) return
    if (!isAllowedEmoji(emoji)) return
    const now = Date.now()
    if (now - lastThrowAtRef.current < CLIENT_THROTTLE_MS) return
    lastThrowAtRef.current = now

    // Validation serveur (whitelist)
    const { error } = await supabase.rpc('validate_emoji_throw', { p_emoji: emoji })
    if (error) return

    // Broadcast aux autres
    if (channelRef.current && channelRef.current.state === 'joined') {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'throw',
        payload: { from: userId, to: toUserId, emoji },
      })
    }

    // Affichage local immédiat (optimiste — broadcast self:false donc pas de doublon)
    setFlying(prev => {
      if (prev.length >= MAX_CONCURRENT) return prev
      return [...prev, {
        id: `${userId}-${toUserId}-${Date.now()}-${Math.random()}`,
        fromUserId: userId,
        toUserId,
        emoji,
        startedAt: Date.now(),
      }]
    })
  }, [userId])

  return { flying, throwEmoji }
}
