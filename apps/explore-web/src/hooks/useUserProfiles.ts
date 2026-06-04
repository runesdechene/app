import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface UserProfile { name: string | null; avatar: string | null }

/**
 * Fetch en batch le prénom + avatar d'une liste d'user IDs.
 * Retourne un Record<userId, { name, avatar }>. Une seule requête, dédupliquée
 * et triée pour un cache stable (même esprit que useUserAvatars).
 */
export function useUserProfiles(
  userIds: (string | null | undefined)[],
): Record<string, UserProfile> {
  const idsKey = [...new Set(userIds.filter((id): id is string => !!id))].sort().join(',')
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})

  useEffect(() => {
    if (!idsKey) return
    const ids = idsKey.split(',')
    let cancelled = false
    supabase
      .from('users')
      .select('id, first_name, avatar_url')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return
        const map: Record<string, UserProfile> = {}
        for (const u of data as { id: string; first_name: string | null; avatar_url: string | null }[]) {
          map[u.id] = { name: u.first_name, avatar: u.avatar_url }
        }
        setProfiles(map)
      })
    return () => { cancelled = true }
  }, [idsKey])

  return profiles
}
