import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetch en batch les avatar_url d'une liste d'user IDs.
 * Retourne un Record<userId, avatarUrl | null>.
 *
 * Une seule requête SQL pour toute la liste, dédupliquée et triée pour
 * garantir un cache stable côté React (pas de re-fetch si la liste change
 * d'ordre).
 */
export function useUserAvatars(
  userIds: (string | null | undefined)[],
): Record<string, string | null> {
  const idsKey = [...new Set(userIds.filter((id): id is string => !!id))]
    .sort()
    .join(',')
  const [avatars, setAvatars] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!idsKey) return
    const ids = idsKey.split(',')
    let cancelled = false
    supabase
      .from('users')
      .select('id, avatar_url')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return
        const map: Record<string, string | null> = {}
        for (const u of data as { id: string; avatar_url: string | null }[]) {
          map[u.id] = u.avatar_url
        }
        setAvatars(map)
      })
    return () => {
      cancelled = true
    }
  }, [idsKey])

  return avatars
}
