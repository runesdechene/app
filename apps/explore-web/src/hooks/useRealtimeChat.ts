import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ChatMessage {
  id: number
  userId: string
  content: string
  createdAt: string
}

interface Options {
  table: string          // ex. 'mission_messages'
  filterField: string    // ex. 'mission_slug'
  filterValue: string | null
  active?: boolean
}

// Subscribe AVANT le fetch initial (capture les INSERT pendant le SELECT, dédup par id).
export function useRealtimeChat({ table, filterField, filterValue, active = true }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const seen = useRef<Set<number>>(new Set())

  const push = useCallback((m: ChatMessage) => {
    if (seen.current.has(m.id)) return
    seen.current.add(m.id)
    setMessages((prev) => [...prev, m].sort((a, b) => a.id - b.id))
  }, [])

  useEffect(() => {
    if (!filterValue) return
    seen.current = new Set()
    setMessages([])
    let cancelled = false

    const channel = supabase
      .channel(`chat:${table}:${filterValue}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `${filterField}=eq.${filterValue}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          push({
            id: r.id as number,
            userId: r.user_id as string,
            content: r.content as string,
            createdAt: r.created_at as string,
          })
        },
      )
      .subscribe()

    supabase
      .from(table)
      .select('id, user_id, content, created_at')
      .eq(filterField, filterValue)
      .order('id', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return
        for (const r of data)
          push({
            id: (r as Record<string, unknown>).id as number,
            userId: (r as Record<string, unknown>).user_id as string,
            content: (r as Record<string, unknown>).content as string,
            createdAt: (r as Record<string, unknown>).created_at as string,
          })
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [table, filterField, filterValue, push])

  useEffect(() => {
    if (!active || !filterValue) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      supabase
        .from(table)
        .select('id, user_id, content, created_at')
        .eq(filterField, filterValue)
        .order('id', { ascending: true })
        .then(({ data }) => {
          if (!data) return
          for (const r of data)
            push({
              id: (r as Record<string, unknown>).id as number,
              userId: (r as Record<string, unknown>).user_id as string,
              content: (r as Record<string, unknown>).content as string,
              createdAt: (r as Record<string, unknown>).created_at as string,
            })
        })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [active, table, filterField, filterValue, push])

  return { messages }
}
