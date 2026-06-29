// src/hooks/useDemoBootstrap.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isDemoMode } from '../lib/demo/isDemoMode'
import { setCached } from '../lib/demo/demoReadCache'

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string | undefined
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined

export function useDemoBootstrap(): { ready: boolean } {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isDemoMode()) { setReady(true); return }
    let cancelled = false

    async function boot() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session && DEMO_EMAIL && DEMO_PASSWORD) {
          await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
        }
        // Préchargement carte (réchauffe le cache de résilience)
        const places = await supabase.rpc('get_map_places', { p_type: 'all', p_limit: 5000 })
        if (places?.data) setCached('get_map_places', { p_type: 'all', p_limit: 5000 }, places.data)
        const veilles = await supabase.rpc('get_map_veilles', {})
        if (veilles?.data) setCached('get_map_veilles', {}, veilles.data)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  return { ready }
}
