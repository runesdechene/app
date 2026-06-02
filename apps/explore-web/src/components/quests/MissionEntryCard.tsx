import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMissionsStore } from '../../stores/missionsStore'

interface ActiveMission {
  slug: string
  title: string
  emblem: string | null
}

export function MissionEntryCard() {
  const [m, setM] = useState<ActiveMission | null>(null)
  const requestOpen = useMissionsStore((s) => s.requestOpen)

  useEffect(() => {
    supabase
      .from('missions')
      .select('slug, title, emblem')
      .eq('status', 'published')
      .order('starts_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setM((data?.[0] as ActiveMission) ?? null))
  }, [])

  if (!m) return null

  return (
    <button className="mission-entry-card" onClick={() => requestOpen(m.slug)}>
      <span className="mec-emblem">{m.emblem ?? '🎯'}</span>
      <span className="mec-title">{m.title}</span>
      <span className="mec-go">→</span>
    </button>
  )
}
