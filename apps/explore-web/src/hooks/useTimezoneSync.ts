import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

/**
 * V0.7+ Sync de la timezone du device → users.timezone Postgres.
 * Utilisé par increment_quest_progress / get_user_quests_today pour calculer
 * la date locale du user (reset minuit local). Non-bloquant : si l'appel échoue,
 * le serveur tombe sur le default 'Europe/Paris'.
 */
export function useTimezoneSync() {
  const userId = usePlayerStore(s => s.userId)

  useEffect(() => {
    if (!userId) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    void supabase.rpc('update_user_timezone', { p_timezone: tz }).then(({ error }) => {
      if (error) console.warn('[useTimezoneSync] update_user_timezone failed', error)
    })
  }, [userId])
}
