import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useChatStore } from '../stores/chatStore'
import { useFactionGroupStore } from '../stores/factionGroupStore'
import type { ChatMessage } from '../stores/chatStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_INITIAL = 50

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as number,
    channel: row.channel as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    factionId: (row.faction_id as string) ?? null,
    factionColor: (row.faction_color as string) ?? null,
    factionPattern: (row.faction_pattern as string) ?? null,
    content: row.content as string,
    createdAt: row.created_at as string,
  }
}

/**
 * Hook de chat — a appeler UNE SEULE FOIS au niveau App.
 * Canaux : Général, Bugs, et UN canal par Compagnie de l'utilisateur (≤2),
 * channel = companyId (= faction). Souscription Realtime par canal.
 */
export function useChat() {
  const userId = usePlayerStore(s => s.userId)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Charge les Compagnies de l'utilisateur (peuple myFactions → canaux chat).
  useEffect(() => {
    if (userId) useFactionGroupStore.getState().loadMine(userId)
  }, [userId])

  const companyIds = myFactions.map(f => f.id)
  const companyKey = companyIds.join(',')

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    const store = useChatStore.getState()
    store.pruneCompanies(companyIds)

    async function init() {
      // 1. Général
      const { data: generalData } = await supabase
        .from('chat_messages').select('*').eq('channel', 'general')
        .order('created_at', { ascending: false }).limit(MAX_INITIAL)
      if (!cancelled && generalData) store.setGeneralMessages(generalData.map(rowToMessage).reverse())

      // 2. Bugs
      const { data: bugsData } = await supabase
        .from('chat_messages').select('*').eq('channel', 'bugs')
        .order('created_at', { ascending: false }).limit(MAX_INITIAL)
      if (!cancelled && bugsData) store.setBugsMessages(bugsData.map(rowToMessage).reverse())

      // 3. Un canal par Compagnie
      for (const cid of companyIds) {
        const { data } = await supabase
          .from('chat_messages').select('*').eq('channel', cid)
          .order('created_at', { ascending: false }).limit(MAX_INITIAL)
        if (!cancelled && data) store.setCompanyMessages(cid, data.map(rowToMessage).reverse())
      }

      supabase.rpc('cleanup_old_chat_messages').then(() => {})
      if (cancelled) return

      // 4. Realtime — un filtre par canal
      const ch = supabase.channel('chat-realtime')
      ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.general' },
        (payload) => store.addGeneralMessage(rowToMessage(payload.new as Record<string, unknown>)))
      ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.bugs' },
        (payload) => store.addBugsMessage(rowToMessage(payload.new as Record<string, unknown>)))
      for (const cid of companyIds) {
        ch.on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${cid}` },
          (payload) => store.addCompanyMessage(rowToMessage(payload.new as Record<string, unknown>)))
      }
      ch.subscribe()
      channelRef.current = ch
    }

    init()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // companyKey couvre le changement de la liste des Compagnies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyKey])
}

/**
 * Envoyer un message chat. channelType : 'general' | 'bugs' | <companyId>.
 */
export async function sendChatMessage(
  content: string,
  channelType: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId, userName } = usePlayerStore.getState()
  if (!userId) return { success: false, error: 'Non connecté' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 500) {
    return { success: false, error: 'Message invalide' }
  }

  const isFixed = channelType === 'general' || channelType === 'bugs'
  const channel = channelType
  if (!channel) return { success: false, error: 'Aucun canal' }

  // Pour un canal Compagnie : couleur/embleme de cette Compagnie (affichage).
  const company = isFixed ? null : useFactionGroupStore.getState().myFactions.find(f => f.id === channelType)
  if (!isFixed && !company) return { success: false, error: 'Compagnie inconnue' }

  const displayName = userName || 'Anonyme'

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({
      channel,
      user_id: userId,
      user_name: displayName,
      faction_id: isFixed ? null : channelType,
      faction_color: company?.color ?? null,
      faction_pattern: null,
      content: trimmed,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  if (inserted) {
    const msg = rowToMessage(inserted as Record<string, unknown>)
    if (channel === 'general') useChatStore.getState().addGeneralMessage(msg)
    else if (channel === 'bugs') useChatStore.getState().addBugsMessage(msg)
    else useChatStore.getState().addCompanyMessage(msg)
  }

  return { success: true }
}
