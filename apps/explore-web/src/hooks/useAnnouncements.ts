import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AnnouncementDetail, AnnouncementListItem } from '../types/announcement'

/** Liste des annonces publiées (RPC publique list_published_announcements). */
export function useAnnouncementsList(limit = 30) {
  const [items, setItems] = useState<AnnouncementListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase.rpc('list_published_announcements', { p_limit: limit })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setItems((data ?? []) as AnnouncementListItem[])
  }, [limit])

  useEffect(() => { refresh() }, [refresh])
  return { items, loading, error, refresh }
}

/** Détail d'une annonce par slug (RPC publique get_announcement_by_slug). */
export function useAnnouncement(slug: string | undefined) {
  const [item, setItem] = useState<AnnouncementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase.rpc('get_announcement_by_slug', { p_slug: slug }).then(({ data, error: e }) => {
      if (cancelled) return
      setLoading(false)
      if (e) {
        setError(e.message)
        return
      }
      setItem((data ?? null) as AnnouncementDetail | null)
    })
    return () => { cancelled = true }
  }, [slug])

  return { item, loading, error }
}
